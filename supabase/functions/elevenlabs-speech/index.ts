import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.115.0';
import {requireAal2} from '../_shared/aal2.ts';
import {boundedJson} from '../_shared/developer.ts';
import {ELEVENLABS,elevenJson} from '../_shared/elevenlabs.ts';
import {speechRequest,speechQuote,speechBytes} from '../_shared/elevenlabs-speech.ts';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
const origins=new Set(['https://mypersonas.online','https://www.mypersonas.online','https://aliaspaces.com','https://www.aliaspaces.com']);
async function operation(owner:string,action:string,id:string|null=null,data:unknown={}){const r=await admin.rpc('elevenlabs_job_service',{p_owner:owner,p_action:action,p_id:id,p_data:data});if(r.error)throw new Error('The speech job could not be updated. Refresh its status before continuing.');return r.data;}
async function credentials(owner:string){const r=await admin.rpc('elevenlabs_connection_service',{p_owner:owner,p_action:'credentials'});if(r.error||!r.data?.key)throw new Error('Connect ElevenLabs before creating speech.');return r.data.key as string;}
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'',headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin'};
 if(origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'});
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,{error:'Origin not allowed'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,{error:'Use POST'});
 const guard=await requireAal2(req,admin);if(!guard.ok)return reply(guard.status,{error:guard.error});const owner=guard.user.id;
 let body;try{body=await boundedJson(req,16000);}catch{return reply(400,{error:'Invalid request'});}
 try{
  if(body.action==='list'){const r=await admin.from('elevenlabs_jobs').select('*').eq('owner',owner).order('created_at',{ascending:false}).limit(30);if(r.error)throw new Error('Speech history could not be loaded.');return reply(200,{jobs:r.data});}
  if(body.action==='quote'){
   const request=speechRequest(body),key=await credentials(owner);
   const response=await fetch(ELEVENLABS+'/v1/models',{headers:{'xi-api-key':key},redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok){await response.body?.cancel();throw new Error('The provider model list could not be loaded.');}
   const models=await elevenJson(response);if(!Array.isArray(models))throw new Error('The provider model list was invalid.');
   const credits=speechQuote(request,models);
   return reply(200,{job:await operation(owner,'quote',null,{request,credits,persona_id:body.personaId||null})});
  }
  if(typeof body.id!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.id))return reply(400,{error:'Choose a saved speech job.'});
  if(body.action==='refresh'||body.action==='cancel')return reply(200,{job:await operation(owner,body.action==='refresh'?'get':'cancel',body.id)});
  const path=owner+'/'+body.id+'.mp3';
  if(body.action==='audio'){
   const job=await operation(owner,'get',body.id);if(job.status!=='ready')throw new Error('This audio is not ready.');
   const r=await admin.storage.from('speech-private').download(path);if(r.error||!r.data)throw new Error('The saved audio could not be opened.');const bytes=await speechBytes(new Response(r.data));let binary='';for(const n of bytes)binary+=String.fromCharCode(n);return reply(200,{base64:btoa(binary),mime:'audio/mpeg'});
  }
  if(body.action!=='generate')return reply(400,{error:'Unknown speech action'});
  if(body.approve!==true||body.providerConsent!==true||typeof body.credits!=='number'||!Number.isFinite(body.credits))return reply(400,{error:'Review the script, provider privacy settings and estimated credits before generating.'});
  const key=await credentials(owner),claim=await operation(owner,'claim',body.id,{credits:body.credits});if(!claim.dispatch)return reply(200,{job:claim.job});
  try{
   const {voice_id,...request}=claim.job.request;
   const response=await fetch(ELEVENLABS+'/v1/text-to-speech/'+voice_id+'?output_format=mp3_44100_128',{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'},body:JSON.stringify(request),redirect:'error',signal:AbortSignal.timeout(70000)});
   if(!response.ok||!/^audio\/(mpeg|mp3)(;|$)/i.test(response.headers.get('Content-Type')||'')){await response.body?.cancel();throw new Error('The speech provider did not return audio.');}
   const bytes=await speechBytes(response);await operation(owner,'upload',body.id);
   const upload=await admin.storage.from('speech-private').upload(path,bytes,{contentType:'audio/mpeg',upsert:false});if(upload.error)throw new Error('The generated audio could not be saved.');
   const raw=response.headers.get('character-cost'),cost=raw===null?null:Number(raw),actual_credits=cost!==null&&Number.isFinite(cost)&&cost>=0&&cost<=1000000?cost:null;
   const job=await operation(owner,'ready',body.id,{bytes:bytes.length,actual_credits,provider_request_id:response.headers.get('request-id')?.slice(0,200)||null});return reply(200,{job});
  }catch{
   // A timeout or persistence failure cannot prove that credits were not spent.
   // The claimed job is never dispatched again.
   return reply(200,{job:await operation(owner,'uncertain',body.id)});
  }
 }catch(error){return reply(409,{error:(error as Error).message});}
});
