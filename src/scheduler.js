const timers = new Map();

function startTimer(chatId, delayMs, onExpiry) {
  cancelTimer(chatId);
  const timeoutId = setTimeout(() => {
    timers.delete(chatId);
    onExpiry(chatId);
  }, delayMs);
  timers.set(chatId, timeoutId);
}

function cancelTimer(chatId) {
  const existing = timers.get(chatId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(chatId);
  }
}

function resumeTimers(users, onExpiry) {
  for (const user of users) {
    if (!user.last_smoke_time || !user.interval_minutes) continue;

    const smokedAt = new Date(user.last_smoke_time).getTime();
    const intervalMs = user.interval_minutes * 60 * 1000;
    const elapsed = Date.now() - smokedAt;
    const remaining = intervalMs - elapsed;

    if (remaining <= 0) {
      onExpiry(user.chat_id);
    } else {
      startTimer(user.chat_id, remaining, onExpiry);
    }
  }
}

module.exports = { startTimer, cancelTimer, resumeTimers };
