#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="sandbox-overlord"
APP_LABEL="app=web-term-overlord"
CONTAINER="web-term-overlord"

REMOTE_DB="/app/logs.db"
REMOTE_BACKUP="/tmp/logs-backup.db"

BACKUP_DIR="."
RETENTION_DAYS=30

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_name="logs.db-${timestamp}"
local_db="${BACKUP_DIR}/${backup_name}.db"
local_gz="${local_db}.gz"
local_sha="${local_gz}.sha256"

mkdir -p "$BACKUP_DIR"

pod="$(
  kubectl get pod -n "$NAMESPACE" \
    -l "$APP_LABEL" \
    -o jsonpath='{.items[0].metadata.name}'
)"

if [[ -z "$pod" ]]; then
  echo "No pod found for label $APP_LABEL in namespace $NAMESPACE" >&2
  exit 1
fi

echo "Using pod: $pod"

kubectl exec -n "$NAMESPACE" "$pod" -c "$CONTAINER" -- \
  sqlite3 "$REMOTE_DB" ".backup '$REMOTE_BACKUP'"

kubectl cp \
  "$NAMESPACE/$pod:$REMOTE_BACKUP" \
  "$local_db" \
  -c "$CONTAINER"

kubectl exec -n "$NAMESPACE" "$pod" -c "$CONTAINER" -- \
  rm -f "$REMOTE_BACKUP"

sqlite3 "$local_db" "PRAGMA integrity_check;" | grep -qx "ok"

gzip -f "$local_db"
sha256sum "$local_gz" >"$local_sha"

find "$BACKUP_DIR" -type f -name 'logs.db-*.db.gz' -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'logs.db-*.db.gz.sha256' -mtime +"$RETENTION_DAYS" -delete

echo "Backup complete: $local_gz"
