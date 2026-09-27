import {Client} from "https://esm.sh/@modelcontextprotocol/sdk@1.30.0/client/index.js?target=deno";
import {StreamableHTTPClientTransport} from "https://esm.sh/@modelcontextprotocol/sdk@1.30.0/client/streamableHttp.js?target=deno";
import type {SupabaseClient} from "https://esm.sh/@supabase/supabase-js@2.115.0";
import {OPENART,validateOpenArtToken} from "./openart-auth.ts";
import {boundedJson} from "./developer.ts";

async function credentialOperation(admin:SupabaseClient,action:string,owner:string,data:unknown={}){
 const result=await admin.rpc("openart_connection_service",{p_action:action,p_owner:owner,p_data:data});if(result.error)throw new Error("OpenArt connection storage is unavailable.");return result.data;
}
export async function openArtAccessToken(admin:SupabaseClient,owner:string):Promise<string>{
 const record=await credentialOperation(admin,"credentials",owner);
 if(!record?.tokens?.access_token)throw new Error("Connect OpenArt first.");
 if(Date.parse(record.expires_at)>Date.now()+60000)return record.tokens.access_token;
 const lease=await credentialOperation(admin,"lease",owner);if(lease?.busy)throw new Error("OpenArt authorization is refreshing. Retry shortly.");
 try{
  if(Date.parse(lease.expires_at)>Date.now()+60000)return lease.tokens.access_token;
  if(!lease.tokens?.refresh_token)throw new Error("Reconnect OpenArt to renew access.");
  const response=await fetch(OPENART.token,{method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:lease.tokens.refresh_token,client_id:lease.tokens.client_id,resource:OPENART.resource})});
  if(!response.ok)throw new Error("OpenArt authorization expired. Reconnect your account.");
  const raw=await boundedJson(response,24000),tokens=validateOpenArtToken({...raw,refresh_token:raw.refresh_token||lease.tokens.refresh_token},lease.tokens.client_id);
  await credentialOperation(admin,"refresh",owner,{lease_id:lease.lease_id,tokens});return tokens.access_token;
 }finally{await credentialOperation(admin,"release",owner,{lease_id:lease.lease_id});}
}

const tools:Record<string,string[]>={
 account:["openart_account_get","account_get"],projects:["openart_project_list","project_list"],
 models:["openart_model_list","model_list"],creations:["openart_creation_list","creation_list"],
 form:["openart_model_form_get","model_form_get"],quote:["openart_model_cost","model_cost"],
 image:["openart_generate_image","generate_image"],video:["openart_generate_video","generate_video"],
 generation:["openart_creation_get","creation_get"]
};
export async function readOpenArt(admin:SupabaseClient,owner:string,action:string,args:Record<string,unknown>){
 if(!['account','projects','models','creations','form','quote'].includes(action))throw new Error('Use the approved generation workflow.');
 return await callOpenArt(admin,owner,action,args);
}
export async function callOpenArt(admin:SupabaseClient,owner:string,action:string,args:Record<string,unknown>){
 if(!Object.hasOwn(tools,action))throw new Error("This OpenArt operation is not available.");
 const token=await openArtAccessToken(admin,owner),client=new Client({name:"MyPersonas",version:"0.1.0"});
 const transport=new StreamableHTTPClientTransport(new URL(OPENART.resource),{requestInit:{headers:{Authorization:"Bearer "+token},redirect:"error"}});
 try{
  await client.connect(transport,{timeout:20000});const catalog=await client.listTools(undefined,{timeout:20000});
  const name=tools[action].find(candidate=>catalog.tools.some(tool=>tool.name===candidate));
  if(!name)throw new Error("This operation is not exposed by your OpenArt connection.");
  const result=await client.callTool({name,arguments:args},undefined,{timeout:25000});
  if(result.isError)throw new Error("OpenArt could not complete this request. Check your account and retry.");
  return result;
 }finally{await client.close();}
}

