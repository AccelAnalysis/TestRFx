import { NextResponse } from "next/server";
import { ExchangeForbiddenError, ExchangeUnauthorizedError } from "@/lib/server/exchange/actor";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import { ServiceConfigurationError } from "@/lib/server/postgres";
import { SearchLibraryServiceError } from "@/lib/server/exchange/search-library-service";

export function searchErrorResponse(error:unknown){
  if(error instanceof SearchLibraryServiceError)return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof ExchangeUnauthorizedError)return NextResponse.json({error:error.message},{status:401});
  if(error instanceof ExchangeForbiddenError)return NextResponse.json({error:error.message},{status:403});
  if(error instanceof DatabaseServiceUnavailableError||error instanceof ServiceConfigurationError)return NextResponse.json({error:error.message,service:"postgresql"},{status:503});
  console.error(error);return NextResponse.json({error:"Universal Search service failed."},{status:500});
}
