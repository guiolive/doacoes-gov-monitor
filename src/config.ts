export const config = {
  telegramToken: process.env.TELEGRAM_TOKEN ?? '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? '',
  telegramThreadId: process.env.TELEGRAM_THREAD_ID ?? '',
  checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_SEC ?? '300') * 1000,
  idsFile: process.env.IDS_FILE ?? './ids_notificados.json',
};

export function validateConfig(): void {
  if (!config.telegramToken || config.telegramToken === 'SEU_TOKEN_AQUI') {
    throw new Error('❌ Configure TELEGRAM_TOKEN no .env');
  }
  if (!config.telegramChatId || config.telegramChatId === 'SEU_CHAT_ID_AQUI') {
    throw new Error('❌ Configure TELEGRAM_CHAT_ID no .env');
  }
}
