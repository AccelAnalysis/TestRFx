import "server-only";
import postgres from "postgres";

export class ServiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceConfigurationError";
  }
}

let client: ReturnType<typeof postgres> | undefined;

export function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new ServiceConfigurationError("DATABASE_URL is required for the authenticated Exchange runtime.");
  }

  if (!client) {
    client = postgres(databaseUrl, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
    });
  }

  return client;
}
