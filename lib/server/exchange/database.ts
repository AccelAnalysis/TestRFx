import postgres from "postgres";

export class ExchangeServiceUnavailableError extends Error {
  constructor(message = "The Exchange database service is not configured.") {
    super(message);
    this.name = "ExchangeServiceUnavailableError";
  }
}

let database: ReturnType<typeof postgres> | undefined;

export function getExchangeDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new ExchangeServiceUnavailableError();

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
