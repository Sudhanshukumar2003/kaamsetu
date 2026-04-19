const app    = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { pool } = require('./db/pool');

const server = app.listen(config.port, () => {
  logger.info('KaamSetu API running', { port: config.port, env: config.env, pid: process.pid });
});

const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down`);
  server.close(async () => {
    await pool.end();
    logger.info('Shutdown complete');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (r) => logger.error('UnhandledRejection', { reason: String(r) }));
process.on('uncaughtException', (err) => { logger.error('UncaughtException', { err: err.message }); process.exit(1); });
