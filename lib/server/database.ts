import postgres from "postgres";

export class DatabaseServiceUnavailableError extends Error {
  constructor(message = "The RFxchange database service is not configured.") {
    super(message);
    this.name = "DatabaseServiceUnavailableError";
  }
}

let database: ReturnType<typeof postgres> | undefined;

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new DatabaseServiceUnavailableError();

  if (!database) {
    database = postgres(connectionString, {
      max: 6,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
    });
  }

  return database;
}
