import "server-only";

import mongoose from "mongoose";

import { parseMongoConfig } from "@/lib/config/research";

type MongoCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongo = globalThis as typeof globalThis & {
  mongooseCache?: MongoCache;
};

const cache: MongoCache = globalForMongo.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (process.env.NODE_ENV !== "production") {
  globalForMongo.mongooseCache = cache;
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    const { mongodbUri } = parseMongoConfig();
    cache.promise = mongoose.connect(mongodbUri).then((instance) => instance);
  }

  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
}

export function getMongoCacheSnapshot() {
  return {
    hasConn: cache.conn !== null,
    hasPromise: cache.promise !== null,
  };
}

export function resetMongoCache() {
  cache.conn = null;
  cache.promise = null;
}
