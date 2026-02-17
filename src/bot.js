const TelegramBot = require('node-telegram-bot-api');
const { config } = require('./config');
const { getUser, upsertUser, setUserState, setSmoked, getUsersInState } = require('./db');
const { startTimer, cancelTimer, resumeTimers } = require('./scheduler');

let bot;

// --- Keyboard factories ---

function mainMenuKeyboard(user) {
  const buttons = [[{ text: '⏱ Schedule', callback_data: 'schedule' }]];
  if (user && user.interval_minutes && user.state === 'idle') {
    buttons.push([{ text: '☀️ Start the Day', callback_data: 'start_day' }]);
  }
  if (user && user.state !== 'idle') {
    buttons.push([{ text: '🛑 Stop Schedule', callback_data: 'stop_schedule' }]);
  }
  return { inline_keyboard: buttons };
}

function intervalKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '30m', callback_data: 'interval_30' },
        { text: '45m', callback_data: 'interval_45' },
        { text: '1h', callback_data: 'interval_60' },
      ],
      [
        { text: '2h', callback_data: 'interval_120' },
        { text: '3h', callback_data: 'interval_180' },
        { text: '4h', callback_data: 'interval_240' },
      ],
    ],
  };
}

function smokeActionKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '✅ I smoked', callback_data: 'i_smoked' }],
      [{ text: '🌙 Last smoke of the day', callback_data: 'last_smoke' }],
    ],
  };
}

// --- Timer expiry ---

function handleTimerExpiry(chatId) {
  const user = getUser(chatId);
  if (!user || user.state !== 'smoking_interval') return;

  setUserState(chatId, 'can_smoke');
  bot.sendMessage(chatId, '🚬 You can smoke now!', {
    reply_markup: smokeActionKeyboard(),
  }).catch((err) => console.error('Failed to send smoke notification:', err.message));
}

// --- Helpers ---

function formatInterval(minutes) {
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function safeEditMessage(chatId, messageId, text, replyMarkup) {
  return bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  }).catch((err) => {
    if (!err.message.includes('message is not modified')) {
      console.error('Edit message error:', err.message);
    }
  });
}

// --- Bot setup ---

function createBot() {
  bot = new TelegramBot(config.botToken, { polling: true });

  // /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const user = upsertUser(chatId);
    bot.sendMessage(chatId, 'Welcome to Smoke Control! 🚭\nManage your smoking schedule below.', {
      reply_markup: mainMenuKeyboard(user),
    });
  });

  // Callback query handler
  bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    bot.answerCallbackQuery(query.id).catch(() => {});

    if (data === 'schedule') {
      handleSchedule(chatId, messageId);
    } else if (data.startsWith('interval_')) {
      const minutes = parseInt(data.split('_')[1], 10);
      handleIntervalChoice(chatId, messageId, minutes);
    } else if (data === 'i_smoked') {
      handleISmoked(chatId, messageId);
    } else if (data === 'last_smoke') {
      handleLastSmoke(chatId, messageId);
    } else if (data === 'start_day') {
      handleStartDay(chatId, messageId);
    } else if (data === 'stop_schedule') {
      handleStopSchedule(chatId, messageId);
    }
  });

  // Resume timers for users who were mid-interval when server stopped
  const intervalUsers = getUsersInState('smoking_interval');
  if (intervalUsers.length > 0) {
    console.log(`Resuming timers for ${intervalUsers.length} user(s)`);
    resumeTimers(intervalUsers, handleTimerExpiry);
  }

  return bot;
}

// --- Callback handlers ---

function handleSchedule(chatId, messageId) {
  const user = upsertUser(chatId);
  setUserState(chatId, 'waiting_interval_choice');
  safeEditMessage(chatId, messageId, 'How often would you like to smoke?', intervalKeyboard());
}

function handleIntervalChoice(chatId, messageId, minutes) {
  const user = getUser(chatId);
  if (!user || user.state !== 'waiting_interval_choice') return;

  upsertUser(chatId, { interval_minutes: minutes, state: 'can_smoke' });
  safeEditMessage(
    chatId,
    messageId,
    `Interval set to ${formatInterval(minutes)}.\n\n🚬 You can smoke now!`,
    smokeActionKeyboard()
  );
}

function handleISmoked(chatId, messageId) {
  const user = getUser(chatId);
  if (!user || user.state !== 'can_smoke') return;

  setSmoked(chatId);
  const updatedUser = getUser(chatId);
  const intervalMs = updatedUser.interval_minutes * 60 * 1000;
  startTimer(chatId, intervalMs, handleTimerExpiry);

  safeEditMessage(
    chatId,
    messageId,
    `✅ Noted! Next smoke in ${formatInterval(updatedUser.interval_minutes)}. I'll notify you when it's time.`
  );
}

function handleLastSmoke(chatId, messageId) {
  const user = getUser(chatId);
  if (!user || user.state !== 'can_smoke') return;

  cancelTimer(chatId);
  setUserState(chatId, 'idle');
  safeEditMessage(chatId, messageId, '🌙 Done for the day! Use /start when you\'re ready tomorrow.');
}

function handleStartDay(chatId, messageId) {
  const user = getUser(chatId);
  if (!user || user.state !== 'idle' || !user.interval_minutes) return;

  setUserState(chatId, 'can_smoke');
  safeEditMessage(
    chatId,
    messageId,
    `☀️ New day! Interval: ${formatInterval(user.interval_minutes)}.\n\n🚬 You can smoke now!`,
    smokeActionKeyboard()
  );
}

function handleStopSchedule(chatId, messageId) {
  const user = getUser(chatId);
  if (!user || user.state === 'idle') return;

  cancelTimer(chatId);
  setUserState(chatId, 'idle');
  safeEditMessage(chatId, messageId, '🛑 Schedule stopped. Use /start to begin again.');
}

module.exports = { createBot };
