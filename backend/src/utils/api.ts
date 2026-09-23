import type { Response } from 'express';

export const success = (res: Response, data: unknown = {}, message = 'OK', status = 200) => res.status(status).json({ success: true, message, data });
export const failure = (res: Response, message: string, status = 400) => res.status(status).json({ success: false, message });

export const fileCategory = (mime: string) => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('document') || mime.includes('text') || mime.includes('spreadsheet') || mime.includes('presentation')) return 'document';
  return 'other';
};
