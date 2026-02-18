import { z } from "zod";

const envSchema = z.object({
  DISCOGS_TOKEN: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  BANDCAMP_WISHLIST_URL: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default("DigQueue"),
  DATABASE_URL: z.string().default("./db/digqueue.db"),
});

export const env = envSchema.parse({
  DISCOGS_TOKEN: process.env.DISCOGS_TOKEN,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  BANDCAMP_WISHLIST_URL: process.env.BANDCAMP_WISHLIST_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  DATABASE_URL: process.env.DATABASE_URL,
});
