import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUserId = process.env.SUPABASE_APP_USER_ID;
const sqlitePath = process.env.SQLITE_PATH || "db/digqueue.db";

if (!supabaseUrl || !serviceRoleKey || !appUserId) {
  console.error("Missing env. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_APP_USER_ID");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const db = new Database(sqlitePath, { readonly: true });

const tableConfigs = [
  { table: "labels", pk: "id", addUserId: true, bools: ["active"] },
  { table: "releases", pk: "id", addUserId: true, bools: ["details_fetched", "youtube_matched", "listened", "wishlist"] },
  { table: "tracks", pk: "id", addUserId: true, bools: ["listened", "saved", "wishlist"] },
  { table: "youtube_matches", pk: "id", addUserId: true, bools: ["embeddable", "chosen"] },
  { table: "release_signals", pk: "release_id", addUserId: true, bools: [] },
  { table: "queue_items", pk: "id", addUserId: true, bools: [] },
  { table: "feedback_events", pk: "id", addUserId: true, bools: [] },
  { table: "api_cache", pk: "key", addUserId: true, bools: [] },
  { table: "app_secrets", pk: "id", addUserId: true, bools: [] },
];

function normalizeRow(row, { addUserId, bools }) {
  const normalized = { ...row };
  for (const field of bools) {
    if (field in normalized) normalized[field] = Boolean(normalized[field]);
  }
  if (addUserId) normalized.user_id = appUserId;
  return normalized;
}

async function upsertInBatches(table, rows, pk) {
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: pk, ignoreDuplicates: false });
    if (error) {
      throw new Error(`[${table}] upsert failed at rows ${i}-${i + chunk.length - 1}: ${error.message}`);
    }
  }
}

async function run() {
  for (const config of tableConfigs) {
    const rawRows = db.prepare(`select * from ${config.table}`).all();
    const rows = rawRows.map((row) => normalizeRow(row, config));
    console.log(`Importing ${config.table}: ${rows.length} rows`);
    if (rows.length > 0) {
      await upsertInBatches(config.table, rows, config.pk);
    }
  }

  const { error: rpcError } = await supabase.rpc("reset_identity_sequences");
  if (rpcError) {
    throw new Error(`reset_identity_sequences failed: ${rpcError.message}`);
  }

  console.log("Import completed and identity sequences reset.");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
