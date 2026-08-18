import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | undefined;

export class ExchangeServiceUnavailableError extends Error {
  constructor(message = "RFxchange persistence is not configured.") {
    super(message);
    this.name = "ExchangeServiceUnavailableError";
  }
}

export function exchangeDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getExchangePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new ExchangeServiceUnavailableError();
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "disable" ? false : process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DATABASE_POOL_MAX ?? 8),
    });
  }
  return pool;
}

export async function withExchangeTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getExchangePool().connect();
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

export async function exchangeQuery<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getExchangePool().query<T>(text, values);
}
