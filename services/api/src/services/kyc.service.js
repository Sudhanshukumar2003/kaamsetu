const axios  = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const idfyClient = axios.create({
  baseURL: config.idfy.baseUrl,
  headers: {
    'account-id': config.idfy.accountId,
    'api-key':    config.idfy.apiKey,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

const initiateAadhaarOTP = async (aadhaarNumber) => {
  if (!config.idfy.apiKey || config.env === 'development') {
    logger.debug('KYC initiate (mock)', { last4: aadhaarNumber.slice(-4) });
    return { requestId: `mock-req-${Date.now()}` };
  }
  const response = await idfyClient.post('/v3/tasks/sync/verify_with_source/ind_aadhaar', {
    task_id: `ks-${Date.now()}`, group_id: 'kaamsetu',
    data: { id_number: aadhaarNumber, advanced_details: { consent: 'Y' } },
  });
  const requestId = response.data?.result?.extraction_output?.request_id;
  if (!requestId) throw new Error('Failed to initiate Aadhaar OTP');
  return { requestId };
};

const verifyAadhaarOTP = async (requestId, otp, selfieBase64) => {
  if (!config.idfy.apiKey || config.env === 'development') {
    logger.debug('KYC verify (mock)');
    return { success: true, name: 'Test User', dob: '1990-01-01', faceMatchScore: 0.95 };
  }
  try {
    const otpResp = await idfyClient.post('/v3/tasks/sync/verify_with_source/ind_aadhaar_otp', {
      task_id: `ks-otp-${Date.now()}`, group_id: 'kaamsetu',
      data: { request_id: requestId, otp },
    });
    const extraction = otpResp.data?.result?.extraction_output;
    if (!extraction || otpResp.data?.result?.status !== 'id_verification_success') {
      return { success: false, error: 'Aadhaar OTP verification failed' };
    }
    let faceMatchScore = null;
    if (selfieBase64 && extraction.face_image) {
      try {
        const faceResp = await idfyClient.post('/v3/tasks/sync/verify/face', {
          task_id: `ks-face-${Date.now()}`, group_id: 'kaamsetu',
          data: { document1: selfieBase64, document2: extraction.face_image },
        });
        faceMatchScore = faceResp.data?.result?.output?.confidence || null;
        if (faceMatchScore && faceMatchScore < 0.6) {
          return { success: false, error: 'Face does not match Aadhaar photo' };
        }
      } catch (e) { logger.warn('Face match skipped', { err: e.message }); }
    }
    return { success: true, name: extraction.name, dob: extraction.dob, faceMatchScore };
  } catch (err) {
    logger.error('IDfy error', { err: err.message });
    return { success: false, error: 'KYC service error' };
  }
};

module.exports = { initiateAadhaarOTP, verifyAadhaarOTP };
