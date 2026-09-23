import mongoose from 'mongoose';
import { config } from '../config';

if (!config.databaseUrl) {
  throw new Error('Missing environment variable: DATABASE_URL');
}

export const initializeDatabase = async (): Promise<typeof mongoose> => {
  try {
    const conn = await mongoose.connect(config.databaseUrl, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`Connected to MongoDB Atlas: ${conn.connection.host}`);
    return conn;
  } catch (error: any) {
    console.error('MongoDB Atlas connection failed:', error?.message || error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
};