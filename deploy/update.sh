#!/usr/bin/env bash
# Updates a running AURALIS server to the latest code (run from the repo root):
#
#   sudo bash deploy/update.sh
#
# Takes a backup first, pulls the latest commit, rebuilds, and restarts.
# Database migrations are applied automatically when the app container starts.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml)

echo "==> Backing up before the update"
./scripts/backup.sh

echo "==> Pulling the latest code"
git pull --ff-only

echo "==> Rebuilding and restarting"
"${COMPOSE[@]}" up -d --build
docker image prune -f >/dev/null

"${COMPOSE[@]}" ps
echo "✅ Update complete"
