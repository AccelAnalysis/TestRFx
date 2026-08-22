import { NextRequest, NextResponse } from "next/server";
import type { ExchangeSearchState } from "@/lib/exchange/contracts";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { deleteSavedSearch, updateSavedSearch } from "@/lib/server/exchange/search-library-service";
import { searchErrorResponse } from "@/lib/server/exchange/search-http";

export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function PATCH(request:NextRequest,{params}:Context){try{const actor=await resolveExchangeActor(request);const {id}=await params;const body=await request.json().catch(()=>({})) as {name?:unknown;state?:unknown;alertEnabled?:unknown};const saved=await updateSavedSearch(actor,id,{name:typeof body.name==="string"?body.name:undefined,state:body.state&&typeof body.state==="object"?body.state as ExchangeSearchState:undefined,alertEnabled:typeof body.alertEnabled==="boolean"?body.alertEnabled:undefined});if(!saved)return NextResponse.json({error:"Saved search not found."},{status:404});return NextResponse.json({saved});}catch(error){return searchErrorResponse(error);}}
export async function DELETE(request:NextRequest,{params}:Context){try{const actor=await resolveExchangeActor(request);const {id}=await params;const deleted=await deleteSavedSearch(actor,id);if(!deleted)return NextResponse.json({error:"Saved search not found."},{status:404});return NextResponse.json({deleted:true});}catch(error){return searchErrorResponse(error);}}
