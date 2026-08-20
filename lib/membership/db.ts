import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { MembershipServiceError } from "@/lib/membership/contracts";

let pool: Pool | null = null;

export function getMembershipPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new MembershipServiceError(
      "MEMBERSHIP_DATABASE_NOT_CONFIGURED",
      "RFxchange membership persistence is not configured for this runtime.",
      503,
    );
  }

  if (!pool) {
    pool = new Pool({ connectionString, max: 10 });
  }

  return pool;
}

export async function queryMembership<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getMembershipPool().query<T>(text, values);
}

export async function withMembershipTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getMembershipPool().connect();
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
