import {createClient} from "https://esm.sh/@supabase/supabase-js@2.115.0";
import {requireAal2} from "../_shared/aal2.ts";
import {boundedJson} from "../_shared/developer.ts";
import {OPENART,oauthHash,oauthRandom,openArtAuthorize,validateOpenArtToken} from "../_shared/openart-auth.ts";
import {revokeOpenArtTokens as revoke} from "../_shared/openart-revoke.ts";
const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
// Public OAuth client registered with OpenArt on 2026-09-05; not a secret.
const clientId="2GfAWLZxf0PmmgrWnAhP";
const callback="https://nwsqyuucwzihruszocge.supabase.co/functions/v1/openart-connect/callback";
const origins=new Set(["https://mypersonas.online","https://www.mypersonas.online","https://aliaspaces.com","https://www.aliaspaces.com"]);
async function operation(action:string,owner:string|null=null,state:string|null=null,data:unknown={}){
 const result=await admin.rpc("openart_connection_service",{p_action:action,p_owner:owner,p_state:state,p_data:data});if(result.error)throw new Error("OpenArt connection could not be updated.");return result.data;
}
Deno.serve(async req=>{
 const url=new URL(req.url),origin=req.headers.get("Origin")||"";
 const headers:Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store","Referrer-Policy":"no-referrer",Vary:"Origin"};
 if(origins.has(origin))Object.assign(headers,{"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"});
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==="GET"&&url.pathname.endsWith("/callback")){
  const page=(message:string,status=200)=>new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MyPersonas · OpenArt</title><body><h1>MyPersonas &amp; OpenArt</h1><p>${message}</p><p>You can close this page and return to the app.</p></body></html>`,{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"}});
  const state=url.searchParams.getAll("state"),codes=url.searchParams.getAll("code");
  if(state.length!==1||!/^[a-f0-9]{64}$/.test(state[0]))return page("This authorization link is invalid. Start again in MyPersonas.",400);
  if(url.searchParams.has("error"))return page("Authorization was declined. Your existing connection has not changed.",400);
  if(codes.length!==1||codes[0].length<1||codes[0].length>2048)return page("The authorization code is missing or invalid.",400);
  let tokens:ReturnType<typeof validateOpenArtToken>|undefined;
  try{
   const hash=await oauthHash(state[0]),pending=await operation("consume",null,hash);
   const response=await fetch(OPENART.token,{method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"authorization_code",client_id:clientId,redirect_uri:callback,code:codes[0],code_verifier:pending.verifier,resource:OPENART.resource})});
   if(!response.ok)return page("OpenArt could not finish authorization. Start a new connection in MyPersonas.",400);
   tokens=validateOpenArtToken(await boundedJson(response,24000),clientId);await operation("save",pending.owner,hash,tokens);
   return page("OpenArt is connected. Your existing projects and credits remain in your OpenArt account. Return to MyPersonas and refresh the connection.");
  }catch{
   if(tokens){try{await revoke(tokens);}catch{return page("OpenArt approved a connection, but it could not be saved or revoked. Remove MyPersonas in your OpenArt account settings before reconnecting.",503);}}
   return page("This connection could not be completed. Start a new authorization in MyPersonas.",400);
  }
 }
 if(origin&&!origins.has(origin))return reply(403,{error:"Origin not allowed"});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply(405,{error:"Use POST"});
 const guard=await requireAal2(req,admin);if(!guard.ok)return reply(guard.status,{error:guard.error});
 let body;try{body=await boundedJson(req,1024);}catch{return reply(400,{error:"Invalid request"});}
 try{
  if(body.action==="status")return reply(200,await operation("status",guard.user.id));
  if(body.action==="start"){
   const state=oauthRandom(),verifier=oauthRandom();await operation("begin",guard.user.id,await oauthHash(state),{verifier});
   return reply(200,{url:await openArtAuthorize(clientId,callback,state,verifier)});
  }
  if(body.action==="disconnect"){
   const connection=await operation("credentials",guard.user.id);
   if(!connection?.tokens){await operation("forget",guard.user.id);return reply(200,{disconnected:true});}
   const lease=await operation("lease",guard.user.id);
   if(lease?.busy)throw new Error("OpenArt is refreshing. Retry disconnection shortly.");
   try{
    await revoke(lease.tokens);
    await operation("forget",guard.user.id,null,{lease_id:lease.lease_id});
    return reply(200,{disconnected:true});
   }finally{await operation("release",guard.user.id,null,{lease_id:lease.lease_id});}
  }
  return reply(400,{error:"Unknown action"});
 }catch(error){return reply(503,{error:(error as Error).message});}
});

