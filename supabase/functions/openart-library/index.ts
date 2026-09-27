import {createClient} from "https://esm.sh/@supabase/supabase-js@2.115.0";
import {requireAal2} from "../_shared/aal2.ts";
import {boundedJson} from "../_shared/developer.ts";
import {readOpenArt} from "../_shared/openart-client.ts";
const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const origins=new Set(["https://mypersonas.online","https://www.mypersonas.online","https://aliaspaces.com","https://www.aliaspaces.com"]);
Deno.serve(async req=>{
 const origin=req.headers.get("Origin")||"",headers:Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store",Vary:"Origin"};
 if(origins.has(origin))Object.assign(headers,{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"});
 const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,{error:"Origin not allowed"});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply(405,{error:"Use POST"});
 const guard=await requireAal2(req,admin);if(!guard.ok)return reply(guard.status,{error:guard.error});
 let body;try{body=await boundedJson(req,12000);}catch{return reply(400,{error:"Invalid request"});}
 if(typeof body.action!=="string"||!["account","projects","models","creations","form","quote"].includes(body.action))return reply(400,{error:"Unsupported library operation"});
 const args:Record<string,unknown>={};
 if(["projects","creations"].includes(body.action)){
  args.limit=20;if(body.cursor!==undefined){if(typeof body.cursor!=="string"||body.cursor.length>1000)return reply(400,{error:"Invalid cursor"});args.cursor=body.cursor;}
 }
 if(body.action==="creations"){
  if(typeof body.projectId!=="string"||!body.projectId||body.projectId.length>128)return reply(400,{error:"Choose an OpenArt project"});args.projectId=body.projectId;
 }
 if(["form","quote"].includes(body.action)){
  if(typeof body.model!=="string"||!body.model||body.model.length>128||typeof body.mode!=="string"||body.mode.length>64)return reply(400,{error:"Choose a model and mode"});args.model=body.model;args.mode=body.mode;
  if(body.action==="quote"){if(!body.params||typeof body.params!=="object"||Array.isArray(body.params))return reply(400,{error:"Choose generation settings"});args.params=body.params;}
 }
 try{return reply(200,{result:await readOpenArt(admin,guard.user.id,body.action,args)});}
 catch{return reply(503,{error:"OpenArt could not load this view. Refresh the connection or reconnect your account."});}
});

