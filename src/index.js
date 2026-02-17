const express = require('express');
const { config, validateConfig } = require('./config');
const { initDb } = require('./db');
const { createBot } = require('./bot');

validateConfig();
initDb();

const app = express();

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

const bot = createBot();
console.log('Telegram bot started (polling)');

const server = app.listen(config.port, () => {
  console.log(`HTTP server listening on port ${config.port}`);
});

function shutdown() {
  console.log('Shutting down...');
  bot.stopPolling();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
