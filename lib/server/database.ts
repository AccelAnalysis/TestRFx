import postgres from "postgres";

let databaseClient: ReturnType<typeof postgres> | undefined;

export class DatabaseConfigurationError extends Error {
  constructor(message = "DATABASE_URL is required for this operation.") {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new DatabaseConfigurationError();

  if (!databaseClient) {
    const maxConnections = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "5", 10);
    databaseClient = postgres(connectionString, {
      max: Number.isFinite(maxConnections) && maxConnections > 0 ? maxConnections : 5,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  return databaseClient;
}
