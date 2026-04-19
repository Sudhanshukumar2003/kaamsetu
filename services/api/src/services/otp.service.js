const crypto  = require('crypto');
const { query } = require('../db/pool');
const config  = require('../config');
const logger  = require('../utils/logger');

let twilioClient = null;
const getTwilio = () => {
  if (!twilioClient && config.twilio.accountSid) {
    twilioClient = require('twilio')(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
};

const generateOTP = () => {
  if (config.otp.testMode) return '123456';
  return crypto.randomInt(100000, 999999).toString();
};

const sendOTP = async (phone, purpose = 'login') => {
  // Expire any existing OTPs for this phone+purpose
  await query(
    `UPDATE otp_codes SET is_used = true
     WHERE phone = $1 AND purpose = $2 AND is_used = false`,
    [phone, purpose]
  );

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + config.otp.ttlSeconds * 1000);

  await query(
    `INSERT INTO otp_codes (phone, code, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [phone, code, purpose, expiresAt]
  );

  if (!config.otp.testMode) {
    const twilio = getTwilio();
    if (twilio) {
      try {
        await twilio.messages.create({
          from: config.twilio.smsFrom,
          to:   `+91${phone}`,
          body: `Your KaamSetu OTP is ${code}. Valid for 5 minutes. Do not share with anyone.`,
        });
      } catch (err) {
        logger.error('Twilio SMS failed', { phone, err: err.message });
        // Don't throw — log and continue (for dev)
      }
    }
  }

  logger.info('OTP sent', { phone, purpose, testMode: config.otp.testMode });
  return { expiresAt };
};

const verifyOTP = async (phone, code, purpose = 'login') => {
  // In test mode with the magic code, always succeed (allows tests without DB OTP row)
  if (config.otp.testMode && code === '123456') {
    return { valid: true };
  }
  const result = await query(
    `SELECT id, attempts FROM otp_codes
     WHERE phone = $1 AND purpose = $2 AND is_used = false AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose]
  );

  if (result.rows.length === 0) {
    return { valid: false, reason: 'OTP expired or not found' };
  }

  const otp = result.rows[0];

  if (otp.attempts >= config.otp.maxAttempts) {
    return { valid: false, reason: 'Too many attempts' };
  }

  // Increment attempts
  await query(
    `UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`,
    [otp.id]
  );

  const stored = await query(
    `SELECT code FROM otp_codes WHERE id = $1`, [otp.id]
  );

  if (stored.rows[0].code !== code) {
    return { valid: false, reason: 'Invalid OTP' };
  }

  // Mark used
  await query(`UPDATE otp_codes SET is_used = true WHERE id = $1`, [otp.id]);

  return { valid: true };
};

module.exports = { sendOTP, verifyOTP };
