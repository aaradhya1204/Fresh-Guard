import * as dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Ensure Postgres timestamps are parsed into valid JS Dates.
// Postgres `timestamp` (OID 1114) is often returned as `YYYY-MM-DD HH:mm:ss` (no timezone),
// which the JS Date parser can treat as invalid. We normalize to UTC by inserting `T` and `Z`.
function parsePgTimestamp(value: string, assumeUtcWhenNoTz: boolean) {
  // Normalize `YYYY-MM-DD HH:mm:ss[.ffffff][(+|-)HH[MM]|(+|-)HH:MM|Z]`.
  let v = value.replace(" ", "T");

  // Trim microseconds (keep milliseconds only) because JS only supports 3 fractional digits.
  v = v.replace(/\.(\d{3})\d+/, ".$1");

  // Normalize timezone offsets:
  // - +0530 -> +05:30
  v = v.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  // - +00 -> +00:00
  v = v.replace(/([+-]\d{2})$/, "$1:00");

  const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(v);
  if (!hasTz && assumeUtcWhenNoTz) {
    v += "Z";
  }

  // Return a normalized string. Drizzle's timestamp column will convert this to a Date.
  // Keeping this as a string avoids edge cases where a Date object becomes Invalid Date
  // and serializes to null in JSON.
  const d = new Date(v);
  if (isNaN(d.getTime())) {
    console.warn("Failed to normalize Postgres timestamp", {
      value,
      normalized: v,
      assumeUtcWhenNoTz,
    });
  }

  return v;
}

pg.types.setTypeParser(1114, (value) => parsePgTimestamp(value, true));
pg.types.setTypeParser(1184, (value) => parsePgTimestamp(value, false));

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                    // Limit concurrent connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Fail fast if DB unreachable
});

// Prevent pool errors from crashing the process
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

export const db = drizzle(pool, { schema });
