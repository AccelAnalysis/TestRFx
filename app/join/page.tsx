import { redirect } from "next/navigation";

type Query = Record<string, string | string[] | undefined>;

export default async function JoinPage({ searchParams }: { searchParams: Promise<Query> }) {
  const incoming = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(incoming)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  const suffix = query.toString();
  redirect(`/register${suffix ? `?${suffix}` : ""}`);
}
