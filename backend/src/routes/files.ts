import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { FileModel, IFile } from '../models/File';
import { authenticate } from '../middleware/auth';
import { config } from '../config';
import { deleteTelegramMessage, downloadFromTelegram, uploadToTelegram } from '../services/telegramService';
import { failure, fileCategory, success } from '../utils/api';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxFileSize } });

const publicFile = (file: IFile) => ({
  _id: file._id.toString(),
  originalName: file.originalName,
  mimeType: file.mimeType,
  size: Number(file.size),
  fileType: file.fileType,
  telegramMessageId: Number(file.telegramMessageId),
  createdAt: file.createdAt,
  updatedAt: file.updatedAt,
});

const isObjectId = (value: string) => mongoose.Types.ObjectId.isValid(value);

router.use(authenticate);

// 1. LIST FILES
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 24)));
    const search = String(req.query.search ?? '').trim();
    const type = req.query.type && req.query.type !== 'all' ? String(req.query.type) : null;

    const queryFilter: any = { userId: new mongoose.Types.ObjectId(req.userId) };

    if (search) {
      queryFilter.originalName = { $regex: search, $options: 'i' };
    }

    if (type) {
      queryFilter.fileType = type;
    }

    const sortKey = ['original_name', 'size', 'created_at'].includes(String(req.query.sort))
      ? String(req.query.sort)
      : 'created_at';
    const sortField = sortKey === 'original_name' ? 'originalName' : sortKey === 'size' ? 'size' : 'createdAt';
    const sortDir = req.query.order === 'asc' ? 1 : -1;

    const [files, total] = await Promise.all([
      FileModel.find(queryFilter)
        .sort({ [sortField]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit),
      FileModel.countDocuments(queryFilter),
    ]);

    return success(res, {
      files: files.map(publicFile),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
});

// 2. FILE STATS
export const stats = async (
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
) => {
  try {
    const result = await FileModel.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
      {
        $group: {
          _id: '$fileType',
          count: { $sum: 1 },
          size: { $sum: '$size' },
        },
      },
    ]);

    const data = { total: 0, size: 0, image: 0, video: 0, document: 0, audio: 0 };

    for (const row of result) {
      const count = Number(row.count);
      const size = Number(row.size);
      data.total += count;
      data.size += size;
      if (row._id in data) {
        data[row._id as keyof typeof data] = count;
      }
    }

    return success(res, data);
  } catch (error) {
    return next(error);
  }
};

router.get('/stats', stats);

// 3. UPLOAD FILES
router.post('/upload', upload.array('files', 10), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) return failure(res, 'Choose at least one file.');

    const saved: ReturnType<typeof publicFile>[] = [];

    for (const file of files) {
      const remote = await uploadToTelegram(file);

      const created = new FileModel({
        userId: new mongoose.Types.ObjectId(req.userId),
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        fileType: fileCategory(file.mimetype),
        telegramMessageId: remote.messageId,
        telegramFileId: remote.fileId,
        telegramFileUniqueId: remote.fileUniqueId,
        telegramChatId: config.telegramChannelId,
      });

      await created.save();
      saved.push(publicFile(created));
    }

    return success(res, { files: saved }, `${saved.length} file(s) uploaded.`, 201);
  } catch (error) {
    return next(error);
  }
});

// 4. GET FILE DETAILS
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!isObjectId(req.params.id) || !userId || !isObjectId(userId)) return failure(res, 'File not found.', 404);
    const file = await FileModel.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: new mongoose.Types.ObjectId(userId),
    });
    if (!file) return failure(res, 'File not found.', 404);
    return success(res, { file: publicFile(file) });
  } catch (error) {
    return next(error);
  }
});

// 5. DOWNLOAD FILE
router.get('/:id/download', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!isObjectId(req.params.id) || !userId || !isObjectId(userId)) return failure(res, 'File not found.', 404);
    const file = await FileModel.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: new mongoose.Types.ObjectId(userId),
    });
    if (!file) return failure(res, 'File not found.', 404);

    const remote = await downloadFromTelegram(file.telegramFileId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    remote.stream.pipe(res);
  } catch (error) {
    return next(error);
  }
});

// 6. DELETE FILE
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!isObjectId(req.params.id) || !userId || !isObjectId(userId)) return failure(res, 'File not found.', 404);
    const file = await FileModel.findOne({
      _id: new mongoose.Types.ObjectId(req.params.id),
      userId: new mongoose.Types.ObjectId(userId),
    });
    if (!file) return failure(res, 'File not found.', 404);

    await deleteTelegramMessage(Number(file.telegramMessageId));
    await FileModel.deleteOne({ _id: file._id });

    return success(res, {}, 'File deleted.');
  } catch (error) {
    return next(error);
  }
});

export default router;
