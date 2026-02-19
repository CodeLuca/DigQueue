#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <postgres-connection-url> <snapshot-dir> <app-user-id>"
  echo "Example: $0 \"$SUPABASE_DB_URL\" db/snapshots/2026-02-18-pre-supabase 0e31abc1-380d-4a3e-866c-48a02a36c6e3"
  exit 1
fi

DB_URL="$1"
SNAPSHOT_DIR="$2"
APP_USER_ID="$3"

if [[ ! -d "$SNAPSHOT_DIR/csv" ]]; then
  echo "Snapshot directory missing csv folder: $SNAPSHOT_DIR/csv"
  exit 1
fi

PSQL_BIN="${PSQL_BIN:-}"
if [[ -z "$PSQL_BIN" ]]; then
  if command -v psql >/dev/null 2>&1; then
    PSQL_BIN="$(command -v psql)"
  elif [[ -x "/opt/homebrew/opt/libpq/bin/psql" ]]; then
    PSQL_BIN="/opt/homebrew/opt/libpq/bin/psql"
  else
    echo "psql not found. Install PostgreSQL client tools or set PSQL_BIN."
    exit 1
  fi
fi

"$PSQL_BIN" "$DB_URL" -v snapshot_dir="$SNAPSHOT_DIR" -v app_user_id="$APP_USER_ID" -f supabase/import/load_snapshot.sql

echo "Import completed from $SNAPSHOT_DIR for user $APP_USER_ID"
