import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const formatMongoTarget = (mongoUri: string): string => {
  try {
    const url = new URL(mongoUri);
    const port = url.port ? `:${url.port}` : '';
    return `${url.protocol}//${url.hostname}${port}${url.pathname}`;
  } catch {
    return 'the configured MONGODB_URI';
  }
};

const getConnectionFailureReason = (error: unknown, mongoUri: string): string => {
  const message = error instanceof Error ? error.message : String(error);
  const target = formatMongoTarget(mongoUri);

  if (/ECONNREFUSED/i.test(message)) {
    return `No MongoDB server is accepting connections at ${target}. Start MongoDB, or change MONGODB_URI to a running MongoDB instance.`;
  }

  if (/EPERM/i.test(message)) {
    return `The operating system blocked the connection to ${target}. Check local firewall, container, or sandbox networking settings.`;
  }

  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return `The MongoDB host in ${target} could not be resolved. Check the hostname in MONGODB_URI and your network connection.`;
  }

  if (/authentication failed|auth failed/i.test(message)) {
    return `MongoDB rejected the configured credentials for ${target}. Check the username, password, and authSource in MONGODB_URI.`;
  }

  if (/timed out|timeout/i.test(message)) {
    return `The connection to ${target} timed out. Check that MongoDB is running and reachable from this machine.`;
  }

  return `Unable to connect to ${target}. Check MONGODB_URI and the MongoDB server logs.`;
};

export const connectDatabase = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  try {
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB connected successfully (${formatMongoTarget(mongoUri)})`);
  } catch (error) {
    const reason = mongoUri
      ? getConnectionFailureReason(error, mongoUri)
      : 'MONGODB_URI is not defined in environment variables. Add it to backend/.env.';
    console.error(`MongoDB connection failed: ${reason}`);
    throw new Error(reason);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected successfully');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
  }
};
