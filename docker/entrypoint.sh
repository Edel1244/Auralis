#!/bin/sh
# AURALIS container entrypoint: apply pending database migrations, then start the server.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi
if [ -z "$AUTH_SECRET" ] || [ ${#AUTH_SECRET} -lt 32 ]; then
  echo "AUTH_SECRET must be set to a random string of at least 32 characters" >&2
  exit 1
fi

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "Applying database migrations…"
  node /opt/prisma/node_modules/prisma/build/index.js migrate deploy --schema=/app/prisma/schema.prisma
fi

exec "$@"
