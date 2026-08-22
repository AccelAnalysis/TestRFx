import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { runSavedSearchAlerts } from "@/lib/server/exchange/search-alert-service";
import { searchErrorResponse } from "@/lib/server/exchange/search-http";

export const dynamic="force-dynamic";
export async function POST(request:NextRequest){try{const actor=await resolveExchangeActor(request);return NextResponse.json({evaluations:await runSavedSearchAlerts(actor)});}catch(error){return searchErrorResponse(error);}}
