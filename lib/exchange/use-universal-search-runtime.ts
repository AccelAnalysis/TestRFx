"use client";

import { useCallback, useEffect, useState } from "react";
import type { DrawerResultStatus, ExchangeLens, ExchangeRecord, ExchangeSearchState, RecentSearch, SavedSearch } from "./contracts";
import { createSavedSearchThroughService, deleteSavedSearchThroughService, loadSearchLibrary, recordRecentSearchThroughService, runSavedSearchAlertsThroughService, searchExchangeThroughService, updateSavedSearchThroughService } from "./search-client";

export interface UniversalSearchRuntime {
  records:ExchangeRecord[];total:number;mapped:number;offMap:number;hasMore:boolean;nextCursor?:string;facets:Record<string,Array<{value:string;count:number}>>;status:DrawerResultStatus;error?:string;initialized:boolean;
}
const emptyRuntime:UniversalSearchRuntime={records:[],total:0,mapped:0,offMap:0,hasMore:false,facets:{},status:"loading",initialized:false};

export function useUniversalSearchRuntime({enabled,lens,state}:{enabled:boolean;lens:ExchangeLens;state:ExchangeSearchState}){
  const[runtime,setRuntime]=useState<UniversalSearchRuntime>(emptyRuntime);const[saved,setSaved]=useState<SavedSearch[]>([]);const[recent,setRecent]=useState<RecentSearch[]>([]);const[refreshKey,setRefreshKey]=useState(0);const[libraryKey,setLibraryKey]=useState(0);const[loadingMore,setLoadingMore]=useState(false);
  const loadLibrary=useCallback(async()=>{if(!enabled)return;const library=await loadSearchLibrary(lens);setSaved(library.saved);setRecent(library.recent);},[enabled,lens]);
  useEffect(()=>{if(!enabled){setRuntime(emptyRuntime);return;}let active=true;setRuntime((current)=>({...current,status:current.initialized?"refreshing":"loading",error:undefined,hasMore:false,nextCursor:undefined}));const timer=window.setTimeout(()=>{void searchExchangeThroughService(lens,state,undefined,30).then((response)=>{if(!active)return;setRuntime({records:response.results.map((item)=>item.record),total:response.total,mapped:response.mapped,offMap:response.offMap,hasMore:Boolean(response.hasMore),nextCursor:response.nextCursor,facets:response.facets??{},status:"ready",initialized:true});}).catch((error)=>{if(!active)return;setRuntime({records:[],total:0,mapped:0,offMap:0,hasMore:false,facets:{},status:navigator.onLine?"error":"offline",error:error instanceof Error?error.message:"Universal Search failed.",initialized:true});});},180);return()=>{active=false;window.clearTimeout(timer);};},[enabled,lens,state,refreshKey]);
  useEffect(()=>{let active=true;if(!enabled)return;void loadLibrary().catch(()=>{if(active){setSaved([]);setRecent([]);}});return()=>{active=false;};},[enabled,lens,libraryKey,loadLibrary]);
  async function loadMore(){if(!enabled||loadingMore||!runtime.nextCursor)return;setLoadingMore(true);try{const response=await searchExchangeThroughService(lens,state,runtime.nextCursor,30);setRuntime((current)=>{const seen=new Set(current.records.map((record)=>record.id));const appended=response.results.map((item)=>item.record).filter((record)=>!seen.has(record.id));return{...current,records:[...current.records,...appended],total:response.total,mapped:response.mapped,offMap:response.offMap,hasMore:Boolean(response.hasMore),nextCursor:response.nextCursor,facets:{...current.facets,...(response.facets??{})},status:"ready",initialized:true};});}finally{setLoadingMore(false);}}
  async function recordRecent(searchState:ExchangeSearchState,resultCount=runtime.total){if(!enabled)return;await recordRecentSearchThroughService(lens,searchState,resultCount);setLibraryKey((value)=>value+1);}
  async function saveSearch(name:string,searchState:ExchangeSearchState){if(!enabled)return;await createSavedSearchThroughService(name,lens,searchState);setLibraryKey((value)=>value+1);}
  async function updateSaved(id:string,patch:{name?:string;state?:ExchangeSearchState;alertEnabled?:boolean}){if(!enabled)return;await updateSavedSearchThroughService(id,patch);setLibraryKey((value)=>value+1);}
  async function deleteSaved(id:string){if(!enabled)return;await deleteSavedSearchThroughService(id);setLibraryKey((value)=>value+1);}
  async function runAlerts(){if(!enabled)return[];const result=await runSavedSearchAlertsThroughService();setLibraryKey((value)=>value+1);return result.evaluations;}
  return{runtime,saved,recent,loadingMore,loadMore,recordRecent,saveSearch,updateSaved,deleteSaved,runAlerts,retry:()=>setRefreshKey((value)=>value+1),refreshLibrary:()=>setLibraryKey((value)=>value+1)};
}
