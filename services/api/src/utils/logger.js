const winston = require('winston');
const config  = require('../config');

const fmt = winston.format;

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: fmt.combine(
    fmt.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    fmt.errors({ stack: true }),
    config.env === 'production'
      ? fmt.json()
      : fmt.combine(fmt.colorize(), fmt.printf(({ timestamp, level, message, ...meta }) => {
          const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `${timestamp} ${level}: ${message}${extras}`;
        }))
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
