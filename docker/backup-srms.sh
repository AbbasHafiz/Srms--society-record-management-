#!/bin/bash
# Daily backup of Postgres (pg_dump) and uploaded files.
# Install: sudo cp docker/backup-srms.sh /usr/local/sbin/backup-srms.sh
#          sudo chmod +x /usr/local/sbin/backup-srms.sh
# Cron (root): 15 2 * * * /usr/local/sbin/backup-srms.sh
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/srms/docker-compose.prod.yml}"
COMPOSE_DIR="$(dirname "$COMPOSE_FILE")"
BACKUP_ROOT="${BACKUP_ROOT:-/var/srms/backups}"
UPLOAD_DIR="${UPLOAD_DIR:-/var/srms/uploads}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F)"

mkdir -p "$BACKUP_ROOT"

if [ -f "$COMPOSE_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$COMPOSE_DIR/.env"
  set +a
fi

cd "$COMPOSE_DIR"
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U "${POSTGRES_USER:-society}" -d "${POSTGRES_DB:-society_records}" \
  | gzip > "$BACKUP_ROOT/db-$STAMP.sql.gz"

if [ -d "$UPLOAD_DIR" ]; then
  tar -C "$(dirname "$UPLOAD_DIR")" -czf "$BACKUP_ROOT/uploads-$STAMP.tar.gz" "$(basename "$UPLOAD_DIR")"
fi

find "$BACKUP_ROOT" -type f -mtime "+$KEEP_DAYS" -delete
echo "Backup complete: $BACKUP_ROOT/db-$STAMP.sql.gz"
