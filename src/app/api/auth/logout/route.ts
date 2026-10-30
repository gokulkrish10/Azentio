import {identity} from '@/server/auth';
import {failure,json,originCheck} from '@/server/http';
export async function POST(request:Request){try{originCheck(request);const {db}=await identity();const {error}=await db.auth.signOut();if(error) throw error;return json({ok:true});}catch(e){return failure(e);}}
