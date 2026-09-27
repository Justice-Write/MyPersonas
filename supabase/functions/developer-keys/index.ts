import {createClient} from "https://esm.sh/@supabase/supabase-js@2.115.0";
import {requireAal2} from "../_shared/aal2.ts";
import {boundedJson,generateDeveloperKey,hashDeveloperKey,keyRequest,developerHeaders} from "../_shared/developer.ts";
const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const origins=new Set(["https://mypersonas.online","https://www.mypersonas.online","https://aliaspaces.com","https://www.aliaspaces.com"]);
Deno.serve(async req=>{
  const origin=req.headers.get("Origin")||"",headers:Record<string,string>={...developerHeaders,Vary:"Origin"};
  if(origins.has(origin))Object.assign(headers,{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"});
  const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
  if(origin&&!origins.has(origin))return reply(403,{error:"Origin not allowed"});
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return reply(405,{error:"Use POST"});
  const guard=await requireAal2(req,admin);if(!guard.ok)return reply(guard.status,{error:guard.error});
  const owner=guard.user.id;let body;
  try{body=await boundedJson(req);}catch{return reply(400,{error:"Invalid request"});}
  if(body.action==="list"){
    const result=await admin.from("developer_keys").select("id,label,prefix,scopes,persona_ids,created_at,expires_at,revoked_at,last_used_at").eq("owner",owner).order("created_at",{ascending:false}).limit(100);
    return result.error?reply(503,{error:"Keys unavailable"}):reply(200,{keys:result.data});
  }
  if(body.action==="revoke"){
    if(typeof body.id!=="string"||!/^[a-f0-9-]{36}$/i.test(body.id))return reply(400,{error:"Invalid key ID"});
    const result=await admin.from("developer_keys").update({revoked_at:new Date().toISOString()}).eq("owner",owner).eq("id",body.id).is("revoked_at",null).select("id");
    return result.error?reply(503,{error:"Revocation failed"}):reply(200,{revoked:true});
  }
  if(body.action!=="create")return reply(400,{error:"Unknown action"});
  let input;try{input=keyRequest(body);}catch(error){return reply(400,{error:(error as Error).message});}
  const entitlement=await admin.from("developer_entitlements").select("owner").eq("owner",owner).eq("enabled",true).gt("valid_until",new Date().toISOString()).maybeSingle();
  if(entitlement.error)return reply(503,{error:"Access status unavailable"});
  if(!entitlement.data)return reply(403,{error:"An active developer plan is required."});
  const people=await admin.from("personas").select("id").eq("owner",owner).in("id",input.persona_ids);
  if(people.error)return reply(503,{error:"Personas unavailable"});
  if(people.data.length!==input.persona_ids.length)return reply(404,{error:"Persona not found"});
  const token=generateDeveloperKey();
  const result=await admin.rpc("developer_issue_key",{p_owner:owner,p_label:input.label,p_hash:await hashDeveloperKey(token),p_prefix:token.slice(0,12),p_scopes:input.scopes,p_personas:input.persona_ids});
  if(result.error)return reply(409,{error:"Key could not be issued. Check your plan and personas, or revoke an unused key (20 active keys maximum)."});
  return reply(201,{key:result.data,secret:token,notice:"Copy this secret now. It cannot be retrieved again."});
});

