#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.end())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done

echo "Applying database schema..."
npx prisma db push --accept-data-loss

USER_COUNT=$(node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query('SELECT COUNT(*)::int AS n FROM \"User\"'))
  .then((res) => { console.log(res.rows[0].n); return client.end(); })
  .catch((err) => { console.error(err); process.exit(1); });
")

if [ "$USER_COUNT" = "0" ]; then
  echo "Database empty — running seed..."
  npm run db:seed
else
  echo "Database already has $USER_COUNT user(s) — skipping seed."
fi

exec "$@"
