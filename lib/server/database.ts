import postgres, { type Sql } from "postgres";

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("DATABASE_URL is not configured for this environment.");
    this.name = "DatabaseConfigurationError";
  }
}

let client: Sql | null = null;

export function getDatabase(): Sql {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new DatabaseConfigurationError();

  if (!client) {
    client = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ...(process.env.NODE_ENV === "production" ? { ssl: "require" as const } : {}),
    });
  }

  return client;
}
