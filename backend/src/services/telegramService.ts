import axios from 'axios';
import FormData from 'form-data';
import type { Readable } from 'node:stream';
import { config } from '../config';

const api = () => {
  if (!config.telegramToken || !config.telegramChannelId) throw new Error('Telegram storage is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID.');
  return `https://api.telegram.org/bot${config.telegramToken}`;
};

export const uploadToTelegram = async (file: Express.Multer.File) => {
  const form = new FormData();
  form.append('chat_id', config.telegramChannelId);
  form.append('document', file.buffer, { filename: file.originalname, contentType: file.mimetype });
  const { data } = await axios.post(`${api()}/sendDocument`, form, { headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 120000 });
  if (!data.ok) throw new Error('Telegram rejected the upload.');
  const document = data.result.document;
  return { messageId: data.result.message_id as number, fileId: document.file_id as string, fileUniqueId: document.file_unique_id as string, chatId: config.telegramChannelId };
};

export const downloadFromTelegram = async (fileId: string): Promise<{ stream: Readable; size?: number }> => {
  const info = await axios.get(`${api()}/getFile`, { params: { file_id: fileId } });
  if (!info.data.ok) throw new Error('Telegram file reference is unavailable.');
  const response = await axios.get(`https://api.telegram.org/file/bot${config.telegramToken}/${info.data.result.file_path}`, { responseType: 'stream', timeout: 120000 });
  return { stream: response.data as Readable, size: Number(response.headers['content-length']) || undefined };
};

export const deleteTelegramMessage = async (messageId: number) => {
  const { data } = await axios.post(`${api()}/deleteMessage`, { chat_id: config.telegramChannelId, message_id: messageId });
  if (!data.ok) throw new Error('Telegram could not delete the stored message.');
};
