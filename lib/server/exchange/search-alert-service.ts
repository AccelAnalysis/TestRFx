import { createHash } from "node:crypto";
import type { ExchangeServerActor } from "@/lib/server/exchange/actor";
import { query } from "@/lib/server/postgres";
import { getAlertSearches, recordAlertEvaluation } from "@/lib/server/exchange/search-library-service";
import { searchExchange } from "@/lib/server/exchange/search-service";

type FingerprintRow=[string,string,string|undefined,string[]];
async function completeResultSet(actor:ExchangeServerActor,lens:Parameters<typeof searchExchange>[0]["lens"],state:Parameters<typeof searchExchange>[0]["state"]){
  let cursor:string|undefined;const rows:FingerprintRow[]=[];
  do{
    const page=await searchExchange({actor,lens,state,cursor,limit:100});
    for(const result of page.results){const row:FingerprintRow=[result.record.id,result.record.title,result.record.card?.status?.label,[...result.record.metadata].sort()];rows.push(row);}
    cursor=page.nextCursor;
  }while(cursor);
  rows.sort((a,b)=>a[0].localeCompare(b[0]));
  return rows;
}
function fingerprint(rows:FingerprintRow[]){return createHash("sha256").update(JSON.stringify(rows)).digest("hex");}

export async function runSavedSearchAlerts(actor:ExchangeServerActor){
  const searches=await getAlertSearches(actor);const evaluations=[] as Array<{id:string;changed:boolean;resultCount:number}>;
  for(const saved of searches){
    const rows=await completeResultSet(actor,saved.lens,saved.state);const next=fingerprint(rows);const changed=Boolean(saved.resultFingerprint&&saved.resultFingerprint!==next);
    await recordAlertEvaluation(actor,{id:saved.id,fingerprint:next,changed,resultCount:rows.length,previousFingerprint:saved.resultFingerprint});
    if(changed){await query(`INSERT INTO activity_events(event_name,actor_user_id,organization_id,payload) VALUES('SavedSearchChanged',$1::uuid,$2::uuid,$3::jsonb)`,[actor.userId,actor.organizationId,JSON.stringify({savedSearchId:saved.id,lens:saved.lens,resultCount:rows.length,previousFingerprint:saved.resultFingerprint,fingerprint:next})]);}
    evaluations.push({id:saved.id,changed,resultCount:rows.length});
  }
  return evaluations;
}
