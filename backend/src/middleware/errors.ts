import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error instanceof Error ? error.message : error);
  const status = error?.statusCode ?? (error?.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const message = status === 413 ? 'File is too large.' : status === 500 ? 'Something went wrong. Please try again.' : error.message;
  res.status(status).json({ success: false, message });
};
