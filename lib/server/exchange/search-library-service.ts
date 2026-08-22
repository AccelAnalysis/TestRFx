import type { ExchangeLens, ExchangeSearchState, RecentSearch, SavedSearch, SearchLibrary } from "@/lib/exchange/contracts";
import { normalizeSearchState } from "@/lib/exchange/search";
import type { ExchangeServerActor } from "@/lib/server/exchange/actor";
import { query } from "@/lib/server/postgres";

export class SearchLibraryServiceError extends Error { constructor(public readonly status: number, message: string) { super(message); this.name = "SearchLibraryServiceError"; } }
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function iso(value:Date|string){const date=value instanceof Date?value:new Date(value);return date.toISOString();}
function requireId(id:string){if(!UUID.test(id))throw new SearchLibraryServiceError(400,"Saved search ID is invalid.");return id;}

export async function listSearchLibrary(actor:ExchangeServerActor,lens:ExchangeLens):Promise<SearchLibrary>{
  const [savedResult,recentResult]=await Promise.all([
    query<{id:string;name:string;lens:ExchangeLens;state:unknown;alert_enabled:boolean;created_at:Date|string;updated_at:Date|string}>(`SELECT id::text,name,lens,state,alert_enabled,created_at,updated_at FROM saved_searches WHERE user_id=$1::uuid AND lens=$2 ORDER BY updated_at DESC LIMIT 100`,[actor.userId,lens]),
    query<{id:string;lens:ExchangeLens;state:unknown;occurred_at:Date|string}>(`SELECT id::text,lens,state,occurred_at FROM search_activity WHERE user_id=$1::uuid AND lens=$2 AND event_name='SearchSubmitted' ORDER BY occurred_at DESC LIMIT 25`,[actor.userId,lens]),
  ]);
  const saved:SavedSearch[]=savedResult.rows.map((row)=>({id:row.id,name:row.name,lens:row.lens,state:normalizeSearchState(row.state),alertEnabled:row.alert_enabled,createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)}));
  const recent:RecentSearch[]=recentResult.rows.map((row)=>({id:row.id,lens:row.lens,state:normalizeSearchState(row.state),createdAt:iso(row.occurred_at)}));
  return{saved,recent};
}

export async function createSavedSearch(actor:ExchangeServerActor,input:{name:string;lens:ExchangeLens;state:ExchangeSearchState;alertEnabled?:boolean}){
  const name=input.name.trim().slice(0,120);if(!name)throw new SearchLibraryServiceError(400,"Saved searches require a name.");
  const result=await query<{id:string;name:string;lens:ExchangeLens;state:unknown;alert_enabled:boolean;created_at:Date|string;updated_at:Date|string}>(`INSERT INTO saved_searches(user_id,organization_id,name,lens,state,alert_enabled) VALUES($1::uuid,$2::uuid,$3,$4,$5::jsonb,$6) RETURNING id::text,name,lens,state,alert_enabled,created_at,updated_at`,[actor.userId,actor.organizationId,name,input.lens,JSON.stringify(normalizeSearchState(input.state)),Boolean(input.alertEnabled)]);
  const row=result.rows[0];return{id:row.id,name:row.name,lens:row.lens,state:normalizeSearchState(row.state),alertEnabled:row.alert_enabled,createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)} satisfies SavedSearch;
}

export async function updateSavedSearch(actor:ExchangeServerActor,id:string,patch:{name?:string;state?:ExchangeSearchState;alertEnabled?:boolean}){
  requireId(id);const current=await query<{name:string;state:unknown;alert_enabled:boolean}>(`SELECT name,state,alert_enabled FROM saved_searches WHERE id=$1::uuid AND user_id=$2::uuid LIMIT 1`,[id,actor.userId]);if(!current.rowCount)return undefined;const existing=current.rows[0];const name=patch.name===undefined?existing.name:patch.name.trim().slice(0,120);if(!name)throw new SearchLibraryServiceError(400,"Saved searches require a name.");const state=patch.state===undefined?normalizeSearchState(existing.state):normalizeSearchState(patch.state);const alertEnabled=patch.alertEnabled===undefined?existing.alert_enabled:Boolean(patch.alertEnabled);
  const updated=await query<{id:string;name:string;lens:ExchangeLens;state:unknown;alert_enabled:boolean;created_at:Date|string;updated_at:Date|string}>(`UPDATE saved_searches SET name=$3,state=$4::jsonb,alert_enabled=$5,updated_at=now() WHERE id=$1::uuid AND user_id=$2::uuid RETURNING id::text,name,lens,state,alert_enabled,created_at,updated_at`,[id,actor.userId,name,JSON.stringify(state),alertEnabled]);const row=updated.rows[0];return{id:row.id,name:row.name,lens:row.lens,state:normalizeSearchState(row.state),alertEnabled:row.alert_enabled,createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)} satisfies SavedSearch;
}
export async function deleteSavedSearch(actor:ExchangeServerActor,id:string){requireId(id);const result=await query(`DELETE FROM saved_searches WHERE id=$1::uuid AND user_id=$2::uuid`,[id,actor.userId]);return Boolean(result.rowCount);}
export async function recordRecentSearch(actor:ExchangeServerActor,input:{lens:ExchangeLens;state:ExchangeSearchState;resultCount:number}){await query(`INSERT INTO search_activity(event_name,user_id,organization_id,lens,state,result_count) VALUES('SearchSubmitted',$1::uuid,$2::uuid,$3,$4::jsonb,$5)`,[actor.userId,actor.organizationId,input.lens,JSON.stringify(normalizeSearchState(input.state)),Math.max(0,Math.floor(input.resultCount))]);}
export async function getAlertSearches(actor:ExchangeServerActor){const result=await query<{id:string;lens:ExchangeLens;state:unknown;result_fingerprint:string|null}>(`SELECT id::text,lens,state,result_fingerprint FROM saved_searches WHERE user_id=$1::uuid AND alert_enabled=true ORDER BY updated_at`,[actor.userId]);return result.rows.map((row)=>({id:row.id,lens:row.lens,state:normalizeSearchState(row.state),resultFingerprint:row.result_fingerprint}));}
export async function recordAlertEvaluation(actor:ExchangeServerActor,input:{id:string;fingerprint:string;changed:boolean;resultCount:number;previousFingerprint:string|null}){requireId(input.id);await query(`UPDATE saved_searches SET result_fingerprint=$3,last_checked_at=now(),updated_at=updated_at WHERE id=$1::uuid AND user_id=$2::uuid`,[input.id,actor.userId,input.fingerprint]);await query(`INSERT INTO search_activity(event_name,user_id,organization_id,lens,state,result_count) SELECT $3,$2::uuid,$4::uuid,lens,state,$5 FROM saved_searches WHERE id=$1::uuid AND user_id=$2::uuid`,[input.id,actor.userId,input.changed&&input.previousFingerprint?'SavedSearchChanged':'SavedSearchChecked',actor.organizationId,input.resultCount]);}
