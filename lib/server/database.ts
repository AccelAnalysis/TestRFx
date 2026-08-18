import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

let pool: Pool | undefined;

export class DatabaseUnavailableError extends Error {
  constructor(message = "RFxchange database is not configured.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabasePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new DatabaseUnavailableError();
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" },
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return getDatabasePool().query<T>(text, values);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>) {
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
