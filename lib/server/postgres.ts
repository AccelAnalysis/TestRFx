import { Pool, type PoolClient, type QueryResultRow } from "pg";

export class ExchangeServiceUnavailableError extends Error {
  constructor(message = "The Exchange data service is not configured.") {
    super(message);
    this.name = "ExchangeServiceUnavailableError";
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __rfxchangePool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new ExchangeServiceUnavailableError("DATABASE_URL is required for the production Exchange service.");

  return new Pool({
    connectionString,
    max: Number(process.env.RFXCHANGE_DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });
}

export function getDatabasePool() {
  if (!globalThis.__rfxchangePool) globalThis.__rfxchangePool = createPool();
  return globalThis.__rfxchangePool;
}

export async function queryDatabase<Row extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return getDatabasePool().query<Row>(text, values);
}

export async function withDatabaseTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getDatabasePool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
