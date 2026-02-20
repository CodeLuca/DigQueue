import type { Config } from "drizzle-kit";
import { getRequiredDatabaseUrl } from "./lib/db-url";

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: getRequiredDatabaseUrl(),
  },
} satisfies Config;
