
import "dotenv/config";
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export async function getRecords(prefix) {
  const keys = await redis.keys(`${prefix}:*`);

  if (!keys.length) {
    return [];
  }

  const records = await Promise.all(
    keys.map((key) => redis.get(key))
  );

  return records.filter(Boolean);
}
