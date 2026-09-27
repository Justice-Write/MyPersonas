import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.115.0';
import {McpServer} from 'https://esm.sh/@modelcontextprotocol/sdk@1.30.0/server/mcp.js?target=deno';
import {WebStandardStreamableHTTPServerTransport} from 'https://esm.sh/@modelcontextprotocol/sdk@1.30.0/server/webStandardStreamableHttp.js?target=deno';
import {z} from 'https://esm.sh/zod@4.5.4';
import {createMyPersonasTools} from '../_shared/mcp-tools.js';
import {boundedJson,hashDeveloperKey} from '../_shared/developer.ts';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const origins=new Set(['https://mypersonas.online','https://www.mypersonas.online','https://aliaspaces.com','https://www.aliaspaces.com']);
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'',headers:Record<string,string>={'Cache-Control':'no-store',Vary:'Origin'};
 if(origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type,mcp-protocol-version,accept','Access-Control-Allow-Methods':'POST, OPTIONS'});
 const reply=(status:number,message:string)=>new Response(JSON.stringify({error:message}),{status,headers:{...headers,'Content-Type':'application/json'}});
 if(origin&&!origins.has(origin))return reply(403,'origin_not_allowed');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return new Response(null,{status:405,headers:{...headers,Allow:'POST, OPTIONS'}});
 const key=req.headers.get('Authorization')?.match(/^Bearer (mp_dev_[a-f0-9]{64})$/)?.[1];if(!key)return reply(401,'invalid_developer_key');
 const hash=await hashDeveloperKey(key),lookup=await admin.from('developer_keys').select('scopes').eq('key_hash',hash).maybeSingle();
 if(lookup.error)return reply(503,'authorization_unavailable');if(!lookup.data?.scopes?.length)return reply(401,'invalid_developer_key');
 // MCP transport requests consume quota. The called REST operation reserves its
 // own request too and independently checks the exact tool scope and persona.
 const auth=await admin.rpc('developer_authorize',{p_hash:hash,p_scope:lookup.data.scopes[0]});
 if(auth.error||!auth.data)return reply(503,'authorization_unavailable');if(auth.data.error)return reply(auth.data.status,auth.data.error);
 let body;try{body=await boundedJson(req,30000);}catch{return reply(400,'invalid_mcp_request');}
 const server=createMyPersonasTools({McpServer,z,key}),transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 try{
  await server.connect(transport);const response=await transport.handleRequest(req,{parsedBody:body});
  // JSON mode completes the response before releasing request-local credentials.
  const bytes=await response.arrayBuffer();return new Response(bytes.byteLength?bytes:null,{status:response.status,headers:{...Object.fromEntries(response.headers),...headers}});
 }catch{return reply(503,'mcp_request_unavailable');}finally{await server.close();}
});

