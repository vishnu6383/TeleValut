import mongoose, { Schema, Document } from 'mongoose';

export interface IFile extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  fileType: string;
  telegramMessageId: number;
  telegramFileId: string;
  telegramFileUniqueId: string | null;
  telegramChatId: string;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
      index: true,
    },
    telegramMessageId: {
      type: Number,
      required: true,
    },
    telegramFileId: {
      type: String,
      required: true,
    },
    telegramFileUniqueId: {
      type: String,
      default: null,
    },
    telegramChatId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast querying and sorting
FileSchema.index({ userId: 1, createdAt: -1 });
FileSchema.index({ userId: 1, fileType: 1 });
FileSchema.index({ userId: 1, originalName: 'text' });

export const FileModel = mongoose.models.File || mongoose.model<IFile>('File', FileSchema);
