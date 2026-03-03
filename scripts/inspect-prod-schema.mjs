import postgres from "postgres";

const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("No DB URL in Railway env");

const sql = postgres(url, { ssl: "require", prepare: false, max: 1 });

const tables = await sql`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name in ('app_secrets','worker_locks','api_rate_limits','release_signals')
  order by table_name
`;
console.log("tables", tables);

const appSecretsCols = await sql`
  select column_name, data_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'app_secrets'
  order by ordinal_position
`;
console.log("app_secrets", appSecretsCols);

await sql.end();
