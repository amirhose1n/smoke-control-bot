require('dotenv').config();

const config = {
  botToken: process.env.BOT_TOKEN,
  port: parseInt(process.env.PORT, 10) || 3000,
  databasePath: process.env.DATABASE_PATH || './data/smoke.db',
};

function validateConfig() {
  if (!config.botToken) {
    throw new Error('BOT_TOKEN environment variable is required');
  }
}

module.exports = { config, validateConfig };
