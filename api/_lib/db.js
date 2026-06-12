const { Pool } = require('pg');

// 🔒 SECURITY: connection string comes from the Vercel environment variable
// DATABASE_URL — set this in Vercel: Settings -> Environment Variables,
// using your Neon POOLED connection string (host contains "-pooler").
// ⚠️ Rotate the Neon password — the old one was committed to a public repo.

// 🚀 PERF: one pool shared by every /api/* function, reused across warm
// invocations via `global` so we don't reconnect on every request.
let pool = global._pgPool;
if (!pool) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });
  global._pgPool = pool;
}

module.exports = pool;