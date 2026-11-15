import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, vi } from "vitest";

// Set before the app loads, so the real .env values are never used
process.env.NODE_ENV = "test";
process.env.ACCESS_TOKEN_SECRETE = "test-access-secret";
process.env.REFRESH_TOKEN_SECRETE = "test-refresh-secret";
process.env.MONGO_URI = "mongodb://never-used-in-tests";

// Fake ImageKit: no real uploads during tests
vi.mock("../src/services/imageStorage.service.js", () => {
  let counter = 0;
  return {
    uploadImage: vi.fn(async () => {
      counter += 1;
      return { url: `https://ik.test/img${counter}.png`, fileId: `file${counter}` };
    }),
    uploadImages: vi.fn(async (files) =>
      files.map(() => {
        counter += 1;
        return { url: `https://ik.test/img${counter}.png`, fileId: `file${counter}` };
      }),
    ),
    deleteImages: vi.fn(async () => {}),
  };
});

let replSet;

beforeAll(async () => {
  // Replica set, because bookings use MongoDB transactions
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await mongoose.connection.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});
