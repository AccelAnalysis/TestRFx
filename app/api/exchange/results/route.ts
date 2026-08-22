import { NextRequest, NextResponse } from "next/server";
import type { ExchangeLens, ExchangeViewerContext } from "@/lib/exchange/contracts";
import { searchStateFromParams } from "@/lib/exchange/search";
import { lensDefinitions } from "@/lib/exchange/lenses";
import { ExchangeForbiddenError, ExchangeUnauthorizedError, resolveExchangeActor } from "@/lib/server/exchange/actor";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import { ServiceConfigurationError } from "@/lib/server/postgres";
import { searchExchange } from "@/lib/server/exchange/search-service";

export const dynamic = "force-dynamic";
const lenses=new Set<ExchangeLens>(["rfx","resources","intelligence","capabilities"]);
function viewer(actor:Awaited<ReturnType<typeof resolveExchangeActor>>):ExchangeViewerContext{const write=actor.role==="owner"||actor.role==="admin"||actor.permissions.includes("exchange:write");return{canIssueRfx:write||actor.permissions.includes("rfx:write"),canRespondRfx:true,canOfferResources:write||actor.permissions.includes("resources:write"),canRequestResources:true,canContributeIntelligence:write||actor.permissions.includes("intelligence:write"),canManageCapabilities:write||actor.permissions.includes("capabilities:write"),organization:{name:actor.organizationName}};}
function errorResponse(error:unknown){if(error instanceof ExchangeUnauthorizedError)return NextResponse.json({error:error.message},{status:401});if(error instanceof ExchangeForbiddenError)return NextResponse.json({error:error.message},{status:403});if(error instanceof DatabaseServiceUnavailableError||error instanceof ServiceConfigurationError)return NextResponse.json({error:error.message,service:"postgresql"},{status:503});console.error(error);return NextResponse.json({error:"Universal Search failed."},{status:500});}

export async function GET(request:NextRequest){
  try{
    const lensParam=request.nextUrl.searchParams.get("lens")??"rfx";if(!lenses.has(lensParam as ExchangeLens))return NextResponse.json({error:"Unsupported lens"},{status:400});const lens=lensParam as ExchangeLens;const actor=await resolveExchangeActor(request);const state=searchStateFromParams(request.nextUrl.searchParams);const cursor=request.nextUrl.searchParams.get("cursor")??undefined;const requestedLimit=Number(request.nextUrl.searchParams.get("limit")??"30");const response=await searchExchange({actor,lens,state,cursor,limit:Number.isFinite(requestedLimit)?requestedLimit:30});const records=response.results.map((item)=>item.record);
    return NextResponse.json({...response,records,summary:{total:response.total,mapped:response.mapped,offMap:response.offMap},actions:lensDefinitions[lens].actions(viewer(actor)),catalogMode:"postgresql",persistence:"postgresql"},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return errorResponse(error);}
}
