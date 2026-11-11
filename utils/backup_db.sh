#!/usr/bin/env bash
# Daily backup of the Vision Qro database (includes the n8n state stored in it).
#
# Low footprint by design: the dump is streamed through gzip at low CPU/IO
# priority, written atomically, validated, and old files are pruned.
#
# Configuration (environment variables, all optional):
#   BACKUP_DIR      where to store dumps         (default: <repo>/backups)
#   DB_CONTAINER    postgres container name      (default: vision_qro_db)
#   RETENTION_DAYS  local retention in days      (default: 14)
#   RCLONE_REMOTE   e.g. "gdrive-crypt:vision-qro"; if set, the new dump is
#                   copied there and remote files older than RETENTION_DAYS
#                   are removed. Requires rclone to be configured.
#
# Cron example (03:00 every day):
#   0 3 * * * /home/jetson/Vision_Qro_bak/utils/backup_db.sh >> /home/jetson/Vision_Qro_bak/backups/backup.log 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)/backups}"
DB_CONTAINER="${DB_CONTAINER:-vision_qro_db}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FINAL="${BACKUP_DIR}/vision_qro_backup_${STAMP}.sql.gz"
TMP="${FINAL}.part"

mkdir -p "$BACKUP_DIR"
trap 'rm -f "$TMP"' EXIT

echo "[$(date -Is)] Starting backup of ${DB_CONTAINER}"

# Credentials come from the container's own environment; nothing is hardcoded.
docker exec "$DB_CONTAINER" sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h localhost -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | nice -n 19 gzip > "$TMP"

# Refuse to keep an empty or corrupt dump.
gzip -t "$TMP"
if [ "$(stat -c %s "$TMP")" -lt 1024 ]; then
  echo "Dump is suspiciously small, aborting" >&2
  exit 1
fi

mv "$TMP" "$FINAL"
chmod 600 "$FINAL"
echo "OK local: $FINAL ($(du -h "$FINAL" | cut -f1))"

# Local retention
find "$BACKUP_DIR" -type f -name 'vision_qro_backup_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

# Optional offsite copy (Google Drive through rclone)
if [ -n "${RCLONE_REMOTE:-}" ]; then
  nice -n 19 rclone copyto "$FINAL" "${RCLONE_REMOTE}/$(basename "$FINAL")" --transfers 1 --bwlimit 2M
  rclone delete "$RCLONE_REMOTE" --min-age "${RETENTION_DAYS}d" --include 'vision_qro_backup_*.sql.gz'
  echo "OK remote: ${RCLONE_REMOTE}"
fi
