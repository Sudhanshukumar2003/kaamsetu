const { query } = require('../db/pool');
const config    = require('../config');
const logger    = require('../utils/logger');

let twilioClient = null;
const getTwilio = () => {
  if (!twilioClient && config.twilio.accountSid) {
    twilioClient = require('twilio')(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
};

const sendWhatsApp = async (phone, message) => {
  const twilio = getTwilio();
  if (!twilio) { logger.debug('WhatsApp (mock)', { phone, msg: message.slice(0,60) }); return; }
  try {
    await twilio.messages.create({ from: config.twilio.whatsappFrom, to: `whatsapp:+91${phone}`, body: message });
  } catch (err) { logger.error('WhatsApp failed', { phone, err: err.message }); }
};

const sendPush = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) { logger.debug('Push (mock)', { title }); return; }
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) return;
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k,v]) => [k, String(v)])),
      android: { priority: 'high' },
    });
  } catch (err) { logger.error('Push failed', { err: err.message }); }
};

const saveNotification = async (userId, channel, type, title, body, data = {}) => {
  try {
    await query(
      `INSERT INTO notifications (user_id,channel,type,title,body,data,status) VALUES ($1,$2,$3,$4,$5,$6,'queued')`,
      [userId, channel, type, title, body, JSON.stringify(data)]
    );
  } catch (err) { logger.error('Save notification failed', { err: err.message }); }
};

const getUserContact = async (userId) => {
  const { rows } = await query('SELECT phone, fcm_token, whatsapp_optin FROM users WHERE id = $1', [userId]);
  return rows[0] || null;
};

const notifyGigAccepted = async (gigId, workerUserId) => {
  try {
    const gig = (await query(
      `SELECT g.title, g.start_date, g.agreed_amount, hp.user_id AS hirer_user_id
       FROM gigs g JOIN hirer_profiles hp ON hp.id = g.hirer_id WHERE g.id = $1`, [gigId]
    )).rows[0];
    if (!gig) return;
    const hirer = await getUserContact(gig.hirer_user_id);
    if (!hirer) return;
    const amtRs = (gig.agreed_amount / 100).toLocaleString('en-IN');
    const msg = `✅ *KaamSetu Alert*\nWorker accepted: *${gig.title}*\nAmount: ₹${amtRs}\nPlease complete payment to confirm.`;
    if (hirer.whatsapp_optin) await sendWhatsApp(hirer.phone, msg);
    if (hirer.fcm_token) await sendPush(hirer.fcm_token, 'Worker Accepted!', gig.title, { gigId, type: 'gig_accepted' });
    await saveNotification(gig.hirer_user_id, 'whatsapp', 'gig_accepted', 'Worker Accepted!', msg, { gigId });
  } catch (err) { logger.error('notifyGigAccepted', { err: err.message }); }
};

const notifyNewGigMatch = async (gigId, workerUserId) => {
  try {
    const gig = (await query(
      `SELECT g.title, g.city, g.start_date, g.budget_min, g.budget_max, t.name_hi AS trade_name
       FROM gigs g JOIN trades t ON t.id = g.trade_id WHERE g.id = $1`, [gigId]
    )).rows[0];
    if (!gig) return;
    const worker = await getUserContact(workerUserId);
    if (!worker) return;
    const minRs = (gig.budget_min / 100).toLocaleString('en-IN');
    const maxRs = (gig.budget_max / 100).toLocaleString('en-IN');
    const msg = `🔔 *नया काम! KaamSetu*\nकाम: ${gig.trade_name || gig.title}\nशहर: ${gig.city}\nबजट: ₹${minRs}–₹${maxRs}\nApp खोलें और Accept करें!`;
    if (worker.whatsapp_optin) await sendWhatsApp(worker.phone, msg);
    if (worker.fcm_token) await sendPush(worker.fcm_token, 'नया काम!', `${gig.city}`, { gigId, type: 'new_gig' });
    await saveNotification(workerUserId, 'whatsapp', 'new_gig_match', 'नया काम!', msg, { gigId });
  } catch (err) { logger.error('notifyNewGigMatch', { err: err.message }); }
};

const notifyCheckin = async (gigId, distanceM) => {
  try {
    const gig = (await query(
      `SELECT g.title, hp.user_id AS hirer_user_id FROM gigs g JOIN hirer_profiles hp ON hp.id = g.hirer_id WHERE g.id = $1`, [gigId]
    )).rows[0];
    if (!gig) return;
    const hirer = await getUserContact(gig.hirer_user_id);
    if (!hirer) return;
    const msg = `📍 *KaamSetu — Worker Checked In*\nJob: ${gig.title}\n${distanceM <= 500 ? '✅ On site.' : `⚠️ ${distanceM}m away.`}`;
    if (hirer.whatsapp_optin) await sendWhatsApp(hirer.phone, msg);
    if (hirer.fcm_token) await sendPush(hirer.fcm_token, 'Worker Checked In', gig.title, { gigId, type: 'checkin' });
  } catch (err) { logger.error('notifyCheckin', { err: err.message }); }
};

const notifyWorkerComplete = async (gigId) => {
  try {
    const { rows } = await query(
      `SELECT g.title, g.agreed_amount, hp.user_id AS hirer_user_id, wu.full_name AS worker_name
       FROM gigs g
       JOIN hirer_profiles hp ON hp.id = g.hirer_id
       JOIN worker_profiles wp ON wp.id = g.worker_id
       JOIN users wu ON wu.id = wp.user_id WHERE g.id = $1`, [gigId]
    );
    if (!rows.length) return;
    const gig = rows[0];
    const hirer = await getUserContact(gig.hirer_user_id);
    if (!hirer) return;
    const amtRs = (gig.agreed_amount / 100).toLocaleString('en-IN');
    const msg = `✅ *KaamSetu — Job Complete*\n${gig.worker_name} has finished: "${gig.title}"\nConfirm in app to release ₹${amtRs}.`;
    if (hirer.whatsapp_optin) await sendWhatsApp(hirer.phone, msg);
    if (hirer.fcm_token) await sendPush(hirer.fcm_token, 'Confirm Job Completion', `Release ₹${amtRs}`, { gigId, type: 'job_complete' });
    await saveNotification(gig.hirer_user_id, 'whatsapp', 'job_complete', 'Job Complete', msg, { gigId });
  } catch (err) { logger.error('notifyWorkerComplete', { err: err.message }); }
};

const notifyPaymentReleased = async (gigId) => {
  try {
    const { rows } = await query(
      `SELECT g.title, g.agreed_amount, wp.user_id AS worker_user_id
       FROM gigs g JOIN worker_profiles wp ON wp.id = g.worker_id WHERE g.id = $1`, [gigId]
    );
    if (!rows.length) return;
    const gig = rows[0];
    const worker = await getUserContact(gig.worker_user_id);
    if (!worker) return;
    const amtRs = Math.round(gig.agreed_amount * 0.9 / 100).toLocaleString('en-IN');
    const msg = `💰 *Payment Released! KaamSetu*\nबधाई हो! ₹${amtRs} आपके UPI पर भेज दिए गए।\nकाम: ${gig.title}`;
    if (worker.whatsapp_optin) await sendWhatsApp(worker.phone, msg);
    if (worker.fcm_token) await sendPush(worker.fcm_token, '💰 Payment Released!', `₹${amtRs} sent`, { gigId, type: 'payment_released' });
    await saveNotification(gig.worker_user_id, 'whatsapp', 'payment_released', 'Payment Released!', msg, { gigId });
  } catch (err) { logger.error('notifyPaymentReleased', { err: err.message }); }
};

module.exports = { sendWhatsApp, sendPush, notifyGigAccepted, notifyNewGigMatch, notifyCheckin, notifyWorkerComplete, notifyPaymentReleased };
