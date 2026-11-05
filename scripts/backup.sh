#!/bin/sh
# Backs up an AURALIS Docker Compose deployment: PostgreSQL dump + media volume.
#
#   ./scripts/backup.sh            # writes ./backups/<timestamp>/
#
# Restore:
#   gunzip -c backups/<ts>/db.sql.gz | docker compose exec -T db psql -U auralis -d auralis
#   docker run --rm -v auralis_media:/data -v "$PWD/backups/<ts>":/b alpine tar xzf /b/media.tar.gz -C /data
#
# Schedule it with cron/systemd timers and copy ./backups off the machine.
set -eu
TS=$(date +%Y%m%d-%H%M%S)
OUT="backups/$TS"
mkdir -p "$OUT"

echo "Dumping database…"
docker compose exec -T db pg_dump -U auralis -d auralis --no-owner | gzip > "$OUT/db.sql.gz"

echo "Archiving media volume…"
VOLUME=$(docker volume ls --format '{{.Name}}' | grep '_media$' | head -n1)
docker run --rm -v "$VOLUME":/data:ro -v "$PWD/$OUT":/b alpine tar czf /b/media.tar.gz -C /data storage

echo "Backup written to $OUT"
ls -lh "$OUT"
