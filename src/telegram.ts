import axios from 'axios';
import { config } from './config';

export async function sendMessage(text: string, parseMode = 'HTML'): Promise<boolean> {
  const data: Record<string, unknown> = {
    chat_id: config.telegramChatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  };

  if (config.telegramThreadId) {
    data.message_thread_id = parseInt(config.telegramThreadId);
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${config.telegramToken}/sendMessage`,
      data,
      { timeout: 30_000 }
    );
    return true;
  } catch (err) {
    console.error('[telegram] Erro ao enviar mensagem:', err);
    return false;
  }
}

export async function getChatUpdates(): Promise<void> {
  try {
    const { data } = await axios.get(
      `https://api.telegram.org/bot${config.telegramToken}/getUpdates`,
      { timeout: 30_000 }
    );
    const updates = data.result ?? [];
    if (updates.length === 0) {
      console.log('Nenhuma mensagem encontrada. Envie uma mensagem ao bot primeiro.');
      return;
    }
    for (const update of updates) {
      const msg = update.message ?? update.channel_post;
      if (msg) {
        const threadId = msg.message_thread_id;
        console.log(`chat_id: ${msg.chat.id}${threadId ? ` | message_thread_id: ${threadId}` : ''} | tipo: ${msg.chat.type} | nome: ${msg.chat.title ?? msg.chat.first_name ?? ''}`);
      }
    }
  } catch (err) {
    console.error('Erro ao obter updates:', err);
  }
}
