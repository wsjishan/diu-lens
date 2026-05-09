#!/usr/bin/env bash
set -euo pipefail

# DIU Lens Backup Script Recommendations
# This script performs a backup of the PostgreSQL database and the image storage directory.
# It should be run via cron (e.g., daily at 2 AM).

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/diu-lens}"
DB_CONTAINER="${DB_CONTAINER:-diu-lens-db-1}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-diu_lens}"
STORAGE_PATH="${STORAGE_PATH:-/app/storage}"

DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="$BACKUP_ROOT/$DATE"

mkdir -p "$BACKUP_DIR"

echo "Starting backup for DIU Lens at $DATE"

# 1. Database Backup
# We use pg_dumpall or pg_dump to backup the database.
DB_BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql.gz"
echo "Backing up database to $DB_BACKUP_FILE..."
if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$DB_BACKUP_FILE"; then
  echo "✅ Database backup successful."
else
  echo "❌ Database backup failed!"
  exit 1
fi

# 2. Storage Backup
# We use rsync or tar to backup the uploaded and processed images.
# In production, consider sending this to an S3 bucket or similar offsite storage.
STORAGE_BACKUP_FILE="$BACKUP_DIR/storage_backup_$DATE.tar.gz"
echo "Backing up storage directory to $STORAGE_BACKUP_FILE..."
if tar -czf "$STORAGE_BACKUP_FILE" -C "$(dirname "$STORAGE_PATH")" "$(basename "$STORAGE_PATH")"; then
  echo "✅ Storage backup successful."
else
  echo "❌ Storage backup failed!"
  exit 1
fi

# 3. Cleanup Old Backups (Keep last 7 days)
echo "Cleaning up backups older than 7 days..."
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;
echo "✅ Cleanup complete."

echo "Backup process completed successfully."
