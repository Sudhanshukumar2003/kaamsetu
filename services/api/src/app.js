require('dotenv').config();
const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

const config  = require('./config');
const logger  = require('./utils/logger');
const resp_   = require('./utils/response');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (config.env !== 'production') return cb(null, true);
    if (config.cors.origins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Raw body for Razorpay webhook
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.env !== 'test') {
  app.use(morgan('combined', { stream: { write: (m) => logger.http(m.trim()) } }));
}

const globalLimiter = rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter   = rateLimit({ windowMs: 10*60*1000, max: 10,  standardHeaders: true, legacyHeaders: false });
if (config.env !== 'test') {
  app.use('/api', globalLimiter);
  app.use('/api/auth/send-otp',   authLimiter);
  app.use('/api/auth/verify-otp', authLimiter);
}

app.get('/health', async (req, res) => {
  try {
    await require('./db/pool').pool.query('SELECT 1');
    res.json({ status: 'ok', env: config.env, uptime: Math.floor(process.uptime()) });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'KaamSetu API is running',
    health: '/health',
    base: '/api',
  });
});

app.use('/api/auth',     require('./routes/auth.routes'));
app.use('/api/workers',  require('./routes/worker.routes'));
app.use('/api/hirers',   require('./routes/hirer.routes'));
app.use('/api/gigs',     require('./routes/gig.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/reviews',  require('./routes/review.routes'));
app.use('/api/trades',   require('./routes/trades.routes'));
app.use('/api/admin',    require('./routes/admin.routes'));

app.use((req, res) => resp_.notFound(res, `Route ${req.method} ${req.path} not found`));

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { message: err.message, path: req.path });
  resp_.error(res, config.env === 'production' ? 'Internal server error' : err.message, err.statusCode || 500);
});

module.exports = app;
