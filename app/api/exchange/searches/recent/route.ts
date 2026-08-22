import { NextRequest, NextResponse } from "next/server";
import type { ExchangeLens, ExchangeSearchState } from "@/lib/exchange/contracts";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { recordRecentSearch } from "@/lib/server/exchange/search-library-service";
import { searchErrorResponse } from "@/lib/server/exchange/search-http";

export const dynamic="force-dynamic";
const lenses=new Set<ExchangeLens>(["rfx","resources","intelligence","capabilities"]);
export async function POST(request:NextRequest){try{const actor=await resolveExchangeActor(request);const body=await request.json().catch(()=>null) as {lens?:unknown;state?:unknown;resultCount?:unknown}|null;const lens=typeof body?.lens==="string"?body.lens as ExchangeLens:"rfx";if(!lenses.has(lens))return NextResponse.json({error:"Unsupported lens"},{status:400});const resultCount=Number(body?.resultCount??0);await recordRecentSearch(actor,{lens,state:(body?.state??{}) as ExchangeSearchState,resultCount:Number.isFinite(resultCount)?resultCount:0});return NextResponse.json({recorded:true},{status:201});}catch(error){return searchErrorResponse(error);}}
