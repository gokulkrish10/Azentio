import {createClient} from '@supabase/supabase-js';
import {authConfig} from '@/server/supabase';
import {enquirySchema} from '@/shared/contracts';
import type {Database} from '@/shared/database.types';
import {body,failure,HttpError,json,originCheck} from '@/server/http';
export const runtime='nodejs';
export async function POST(request:Request){try{originCheck(request);const payload=enquirySchema.parse(await body(request));const {url,key}=authConfig();const db=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await db.rpc('enquire',{p_payload:payload});if(error)throw new HttpError(error.code==='54000'?429:503,'ENQUIRY_UNAVAILABLE');return json(data,202);}catch(e){return failure(e);}}
