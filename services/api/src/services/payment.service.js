const Razorpay = require('razorpay');
const { query, transaction } = require('../db/pool');
const config  = require('../config');
const logger  = require('../utils/logger');

let rzpClient = null;
const getRazorpay = () => {
  if (!rzpClient && config.razorpay.keyId) {
    rzpClient = new Razorpay({
      key_id:     config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return rzpClient;
};

// Calculate platform fee and worker amount
const calculateAmounts = (grossAmountPaise) => {
  const platformFee   = Math.round(grossAmountPaise * config.razorpay.feePercent / 100);
  const workerAmount  = grossAmountPaise - platformFee;
  return { platformFee, workerAmount };
};

// Called when hirer selects worker and wants to pay
const createEscrowOrder = async (gigId, hirerId, workerId, grossAmountPaise) => {
  const { platformFee, workerAmount } = calculateAmounts(grossAmountPaise);
  const rzp = getRazorpay();

  let razorpayOrderId = null;

  if (rzp) {
    try {
      const order = await rzp.orders.create({
        amount:   grossAmountPaise,
        currency: 'INR',
        receipt:  `gig_${gigId.slice(0, 8)}`,
        notes: {
          gig_id:    gigId,
          hirer_id:  hirerId,
          worker_id: workerId,
        },
      });
      razorpayOrderId = order.id;
    } catch (err) {
      logger.error('Razorpay order creation failed', { err: err.message });
      // In dev/test mode, we allow proceeding without Razorpay
      if (config.env === 'production') throw err;
    }
  }

  const autoHoldEscrow = config.env !== 'production' || !razorpayOrderId;

  const payment = await transaction(async (client) => {
    const workerProfile = await client.query(
      'SELECT id FROM worker_profiles WHERE id = $1', [workerId]
    );
    const wbd = await client.query(
      'SELECT upi_id FROM worker_bank_details WHERE worker_id = $1', [workerId]
    );

    const p = (await client.query(
      `INSERT INTO payments (
         gig_id, hirer_id, worker_id,
         gross_amount, platform_fee, worker_amount,
         razorpay_order_id, status, worker_upi_id, escrow_held_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        gigId, hirerId, workerId,
        grossAmountPaise, platformFee, workerAmount,
        razorpayOrderId,
        autoHoldEscrow ? 'escrow_held' : 'pending',
        wbd.rows[0]?.upi_id || null,
        autoHoldEscrow ? new Date() : null,
      ]
    )).rows[0];

    // Update gig status to 'matched' once payment record created
    await client.query(
      `UPDATE gigs SET status = 'matched', matched_at = NOW() WHERE id = $1`,
      [gigId]
    );

    return p;
  });

  logger.info('Escrow order created', { gigId, paymentId: payment.id, grossAmountPaise });
  return {
    paymentId:      payment.id,
    razorpayOrderId,
    grossAmount:    grossAmountPaise,
    platformFee,
    workerAmount,
    currency:       'INR',
  };
};

// Called after Razorpay webhook confirms payment captured
const confirmEscrow = async (paymentId, razorpayPaymentId) => {
  await query(
    `UPDATE payments SET
       status            = 'escrow_held',
       razorpay_payment_id = $2,
       escrow_held_at    = NOW(),
       updated_at        = NOW()
     WHERE id = $1`,
    [paymentId, razorpayPaymentId]
  );
  logger.info('Escrow confirmed', { paymentId });
};

// Called when hirer confirms job completion
const releaseEscrow = async (paymentId) => {
  const payment = (await query(
    'SELECT * FROM payments WHERE id = $1', [paymentId]
  )).rows[0];

  if (!payment) throw new Error('Payment not found');
  if (payment.status !== 'escrow_held') {
    throw new Error(`Cannot release: payment status is ${payment.status}`);
  }

  const rzp = getRazorpay();
  let payoutId = null;

  if (rzp && payment.worker_upi_id) {
    try {
      // Razorpay Payout API (requires Razorpay X account)
      const payout = await rzp.payouts.create({
        account_number: config.razorpay.payoutAccountNumber,
        fund_account: {
          account_type: 'vpa',
          vpa:          { address: payment.worker_upi_id },
          contact: {
            name:    'Worker',
            type:    'vendor',
            contact: '',
            email:   '',
          },
        },
        amount:      payment.worker_amount,
        currency:    'INR',
        mode:        'UPI',
        purpose:     'payout',
        queue_if_low_balance: true,
        reference_id: payment.id,
        narration:   'KaamSetu gig payment',
      });
      payoutId = payout.id;
    } catch (err) {
      logger.error('Razorpay payout failed', { err: err.message, paymentId });
      if (config.env === 'production') throw err;
    }
  }

  await query(
    `UPDATE payments SET
       status               = 'escrow_released',
       razorpay_payout_id   = $2,
       payout_initiated_at  = NOW(),
       escrow_released_at   = NOW(),
       updated_at           = NOW()
     WHERE id = $1`,
    [paymentId, payoutId]
  );

  logger.info('Escrow released', { paymentId, workerAmount: payment.worker_amount, payoutId });
  return { workerAmount: payment.worker_amount, payoutId };
};

// Razorpay webhook signature verification
const verifyWebhookSignature = (body, signature, secret) => {
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');
  return expected === signature;
};

module.exports = { createEscrowOrder, confirmEscrow, releaseEscrow, verifyWebhookSignature, calculateAmounts };
