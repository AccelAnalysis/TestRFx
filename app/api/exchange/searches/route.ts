import { NextRequest, NextResponse } from "next/server";
import type { ExchangeLens, ExchangeSearchState } from "@/lib/exchange/contracts";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { createSavedSearch, listSearchLibrary } from "@/lib/server/exchange/search-library-service";
import { searchErrorResponse } from "@/lib/server/exchange/search-http";

export const dynamic="force-dynamic";
const lenses=new Set<ExchangeLens>(["rfx","resources","intelligence","capabilities"]);
export async function GET(request:NextRequest){try{const actor=await resolveExchangeActor(request);const lens=(request.nextUrl.searchParams.get("lens")??"rfx") as ExchangeLens;if(!lenses.has(lens))return NextResponse.json({error:"Unsupported lens"},{status:400});return NextResponse.json(await listSearchLibrary(actor,lens),{headers:{"Cache-Control":"no-store"}});}catch(error){return searchErrorResponse(error);}}
export async function POST(request:NextRequest){try{const actor=await resolveExchangeActor(request);const body=await request.json().catch(()=>null) as {name?:unknown;lens?:unknown;state?:unknown;alertEnabled?:unknown}|null;const lens=typeof body?.lens==="string"?body.lens as ExchangeLens:"rfx";if(!lenses.has(lens))return NextResponse.json({error:"Unsupported lens"},{status:400});const name=typeof body?.name==="string"?body.name:"";const state=(body?.state??{}) as ExchangeSearchState;const saved=await createSavedSearch(actor,{name,lens,state,alertEnabled:body?.alertEnabled===true});return NextResponse.json({saved},{status:201});}catch(error){return searchErrorResponse(error);}}
