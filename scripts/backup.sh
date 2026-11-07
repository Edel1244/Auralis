#!/bin/sh
# Backs up an AURALIS Docker Compose deployment: PostgreSQL dump + media volume.
#
#   ./scripts/backup.sh                 # writes ./backups/<timestamp>/
#   KEEP_DAYS=14 ./scripts/backup.sh    # also deletes backups older than 14 days
#
# Restore (stop the app first: docker compose stop app):
#   gunzip -c backups/<ts>/db.sql.gz | docker compose exec -T db psql -U auralis -d auralis
#   docker run --rm -v <project>_media:/data -v "$PWD/backups/<ts>":/b alpine tar xzf /b/media.tar.gz -C /data
#
# Schedule it with cron/systemd timers and copy ./backups off the machine.
set -eu
cd "$(dirname "$0")/.."

TS=$(date +%Y%m%d-%H%M%S)
OUT="backups/$TS"
mkdir -p "$OUT"

echo "Dumping database…"
docker compose exec -T db pg_dump -U auralis -d auralis --no-owner | gzip > "$OUT/db.sql.gz"

echo "Archiving media volume…"
# Find this project's media volume via Compose labels (not by name guessing).
PROJECT=$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')
VOLUME=$(docker volume ls -q \
  --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:-$PROJECT}" \
  --filter "label=com.docker.compose.volume=media" | head -n1)
if [ -z "$VOLUME" ]; then
  echo "Media volume not found for project ${COMPOSE_PROJECT_NAME:-$PROJECT}" >&2
  exit 1
fi
# Archive the whole volume (works even before the first upload creates storage/).
docker run --rm -v "$VOLUME":/data:ro -v "$PWD/$OUT":/b alpine tar czf /b/media.tar.gz -C /data .

if [ -n "${KEEP_DAYS:-}" ]; then
  echo "Removing backups older than ${KEEP_DAYS} days…"
  find backups -mindepth 1 -maxdepth 1 -type d -mtime "+${KEEP_DAYS}" -exec rm -rf {} +
fi

echo "Backup written to $OUT"
ls -lh "$OUT"
