function isPostgresUrl(value: string): boolean {
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

export function resolveDatabaseUrl() {
  const url =
    process.env.SUPABASE_DB_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL;

  if (!url) {
    return undefined;
  }

  if (!isPostgresUrl(url)) {
    throw new Error(
      "Database URL must be a postgres connection string via SUPABASE_DB_URL/POSTGRES_URL/DATABASE_URL.",
    );
  }

  return url;
}

export function getRequiredDatabaseUrl() {
  const url = resolveDatabaseUrl();
  if (!url) {
    throw new Error(
      "Missing database URL. Set SUPABASE_DB_URL (preferred) or POSTGRES_URL/DATABASE_URL to a Supabase Postgres connection string.",
    );
  }
  return url;
}
