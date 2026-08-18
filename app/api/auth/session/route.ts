import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthenticatedSession, endAuthenticatedSession, IdentitySessionError, SESSION_COOKIE_NAME, verifyAuthenticatedSession } from "@/lib/identity/session";
import { sanitizeReturnTo } from "@/lib/identity/login";

function noStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { idToken?: unknown; challengeId?: unknown; rememberDevice?: unknown; returnTo?: unknown } | null;
  if (!body || typeof body.idToken !== "string" || typeof body.challengeId !== "string") return noStore({ error: "Invalid session request." }, 400);

  try {
    const result = await createAuthenticatedSession({
      idToken: body.idToken,
      challengeId: body.challengeId,
      rememberDevice: body.rememberDevice === true,
      returnTo: sanitizeReturnTo(typeof body.returnTo === "string" ? body.returnTo : undefined),
      userAgent: request.headers.get("user-agent") ?? undefined,
      country: request.headers.get("x-country-code") ?? request.headers.get("cf-ipcountry") ?? undefined,
    });
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, result.sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(result.expiresAt),
    });
    return noStore({ status: "authenticated", destination: result.destination, expiresAt: result.expiresAt });
  } catch (error) {
    if (error instanceof IdentitySessionError) {
      const status = error.code === "restricted" ? 403 : error.code === "invalid_challenge" ? 410 : 401;
      return noStore({ error: error.message, code: error.code }, status);
    }
    return noStore({ error: "RFxchange could not establish the authenticated session." }, 503);
  }
}

async function currentSession(touch: boolean) {
  const store = await cookies();
  const sessionCookie = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return noStore({ error: "No active RFxchange session." }, 401);
  try {
    const identity = await verifyAuthenticatedSession(sessionCookie, touch);
    return noStore({ status: "active", userId: identity.userId, activeOrganizationId: identity.activeOrganizationId ?? null });
  } catch (error) {
    const response = noStore({ error: error instanceof Error ? error.message : "Session unavailable." }, 401);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export async function GET() {
  return currentSession(false);
}

export async function PATCH() {
  return currentSession(true);
}

export async function DELETE(request: NextRequest) {
  const store = await cookies();
  const sessionCookie = store.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie) await endAuthenticatedSession(sessionCookie, request.nextUrl.searchParams.get("all") === "1");
  const response = noStore({ status: "signed_out" });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
