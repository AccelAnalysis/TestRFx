import { Pool, type PoolConfig } from "pg";

export class DatabaseUnavailableError extends Error {
  code = "database_unavailable" as const;
  constructor(message = "RFxchange database is not configured.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

type GlobalWithPool = typeof globalThis & { __rfxchangePgPool?: Pool };

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPostgresPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new DatabaseUnavailableError();

  const globalStore = globalThis as GlobalWithPool;
  if (globalStore.__rfxchangePgPool) return globalStore.__rfxchangePgPool;

  const config: PoolConfig = {
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 8),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  };
  if (process.env.DATABASE_SSL === "require") config.ssl = { rejectUnauthorized: false };

  const pool = new Pool(config);
  if (process.env.NODE_ENV !== "production") globalStore.__rfxchangePgPool = pool;
  return pool;
}
