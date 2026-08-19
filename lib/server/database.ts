import postgres from "postgres";

export class DatabaseServiceUnavailableError extends Error {
  constructor(message = "The RFxchange database service is not configured.") {
    super(message);
    this.name = "DatabaseServiceUnavailableError";
  }
}

export class DatabaseConfigurationError extends DatabaseServiceUnavailableError {
  constructor(message = "DATABASE_URL is required for this operation.") {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

let database: ReturnType<typeof postgres> | undefined;

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new DatabaseConfigurationError();

  if (!database) {
    const configuredPoolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "6", 10);
    const maxConnections = Number.isFinite(configuredPoolMax) && configuredPoolMax > 0 ? configuredPoolMax : 6;
    database = postgres(connectionString, {
      max: maxConnections,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
    });
  }

  return database;
}
