import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";
import { collectResearch, crossrefUrl, researchQuery } from "../_shared/research.ts";
import {boundedJson} from "../_shared/developer.ts";

const origins=new Set(["https://mypersonas.online","https://www.mypersonas.online","https://aliaspaces.com","https://www.aliaspaces.com"]);
const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async req=>{
  const origin=req.headers.get("Origin")||"";
  const headers: Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
  if(origins.has(origin))Object.assign(headers,{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"});
  const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!origins.has(origin))return reply(403,{error:"Origin not allowed"});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return reply(405,{error:"Use POST"});
  const token=req.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if(!token)return reply(401,{error:"Sign in to collect research."});
  const {data:auth,error:authError}=await admin.auth.getUser(token);
  if(authError||!auth.user)return reply(401,{error:"Sign in again to collect research."});
  let body;
  try {body=await boundedJson(req,2048);}
  catch{return reply(400,{error:"Invalid research request."});}
  if(typeof body.personaId!=="string"||!/^[-0-9a-f]{36}$/i.test(body.personaId))return reply(400,{error:"Choose a persona."});
  let topic:string;
  try{topic=researchQuery(body.topic);crossrefUrl(topic,body.days);}
  catch(error){return reply(400,{error:(error as Error).message});}
  const {data:reserved,error:reserveError}=await admin.rpc("research_begin_collection",{p_owner:auth.user.id,p_persona:body.personaId});
  if(reserveError)return reply(reserveError.message.includes("persona_not_found")?404:503,{error:"Research collection is unavailable for this persona."});
  if(!reserved)return reply(429,{error:"Wait 30 seconds between research searches."});
  try{
    const articles=await collectResearch(topic,body.days);
    const saved=await admin.rpc("research_finish_collection",{p_owner:auth.user.id,p_persona:body.personaId,p_token:reserved,p_topic:topic,p_articles:articles});
    if(saved.error)return reply(503,{error:"Articles could not be saved. Check that this persona is still available, then retry."});
    return reply(200,{found:articles.length,source:"Crossref",evidence:"Bibliographic metadata; full text and factual claims have not been reviewed."});
  }catch(error){return reply(502,{error:error instanceof SyntaxError?"The research source returned invalid data.":(error as Error).message});}
});
