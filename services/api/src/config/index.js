require('dotenv').config();

const required = (key) => {
  const val = process.env[key];
  if (!val && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return val;
};

const config = {
  env:  process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),

  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    name:     process.env.DB_NAME     || 'kaamsetu',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret:         process.env.JWT_SECRET         || 'dev-secret-change-in-production',
    expiresIn:      process.env.JWT_EXPIRES_IN     || '30d',
    refreshSecret:  process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '90d',
  },

  otp: {
    ttlSeconds:  parseInt(process.env.OTP_TTL_SECONDS  || '300'),  // 5 min
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3'),
    testMode:    process.env.OTP_TEST_MODE === 'true',  // use 123456 for dev
  },

  twilio: {
    accountSid:          process.env.TWILIO_ACCOUNT_SID,
    authToken:           process.env.TWILIO_AUTH_TOKEN,
    whatsappFrom:        process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
    smsFrom:             process.env.TWILIO_SMS_FROM,
  },

  razorpay: {
    keyId:     process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    // Platform fee = 10%
    feePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '10'),
  },

  idfy: {
    apiKey:    process.env.IDFY_API_KEY,
    accountId: process.env.IDFY_ACCOUNT_ID,
    baseUrl:   process.env.IDFY_BASE_URL || 'https://eve.idfy.com',
  },

  aws: {
    region:         process.env.AWS_REGION          || 'ap-south-1',
    accessKeyId:    process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket:       process.env.AWS_S3_BUCKET        || 'kaamsetu-media-dev',
    cloudfrontUrl:  process.env.AWS_CLOUDFRONT_URL,
  },

  firebase: {
    credentialsPath: process.env.FIREBASE_CREDENTIALS_PATH,
  },

  geo: {
    maxMatchRadiusKm: parseInt(process.env.MAX_MATCH_RADIUS_KM || '10'),
    checkinMaxDistanceM: parseInt(process.env.CHECKIN_MAX_DISTANCE_M || '500'),
  },

  pagination: {
    defaultLimit: 20,
    maxLimit:     100,
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002').split(','),
  },
};

module.exports = config;
