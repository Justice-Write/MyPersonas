import {createClient} from "https://esm.sh/@supabase/supabase-js@2.115.0";
import {requireAal2} from "../_shared/aal2.ts";
import {boundedJson} from "../_shared/developer.ts";
import {ELEVENLABS,voiceSearch,voiceId,publicVoice,elevenJson} from "../_shared/elevenlabs.ts";
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const origins=new Set(['https://mypersonas.online','https://www.mypersonas.online','https://aliaspaces.com','https://www.aliaspaces.com']);
async function connection(owner:string,action:string,key:string|null=null){const r=await admin.rpc('elevenlabs_connection_service',{p_owner:owner,p_action:action,p_key:key});if(r.error)throw new Error('The ElevenLabs connection could not be updated.');return r.data;}
async function read(url:URL|string,key:string){const response=await fetch(url,{headers:{'xi-api-key':key},redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok){await response.body?.cancel();throw new Error(response.status===401?'Check your ElevenLabs key and its permissions.':'ElevenLabs could not complete this request.');}return await elevenJson(response);}
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'',headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin'};
 if(origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'});
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,{error:'Origin not allowed'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,{error:'Use POST'});
 const guard=await requireAal2(req,admin);if(!guard.ok)return reply(guard.status,{error:guard.error});let body;try{body=await boundedJson(req,2048);}catch{return reply(400,{error:'Invalid request'});}
 const owner=guard.user.id;
 try{
  if(body.action==='status')return reply(200,await connection(owner,'status'));
  if(body.action==='disconnect')return reply(200,await connection(owner,'forget'));
  if(body.action==='connect'){
   if(typeof body.key!=='string'||!/^[A-Za-z0-9_-]{20,256}$/.test(body.key))return reply(400,{error:'Enter your ElevenLabs API key.'});
   await read(new URL('/v2/voices?page_size=1',ELEVENLABS),body.key);return reply(200,await connection(owner,'save',body.key));
  }
  const record=await connection(owner,'credentials');if(!record?.key)return reply(409,{error:'Connect ElevenLabs first.'});
  if(body.action==='voices'){const data=await read(voiceSearch(body),record.key);return reply(200,{voices:(Array.isArray(data.voices)?data.voices:[]).slice(0,100).map(publicVoice),hasMore:!!data.has_more,nextPageToken:data.next_page_token||null});}
  if(body.action==='models'){const data=await read(new URL('/v1/models',ELEVENLABS),record.key);return reply(200,{models:Array.isArray(data)?data.filter(m=>m.can_do_text_to_speech).map(m=>({id:m.model_id,name:m.name,description:m.description,languages:m.languages,canUseStyle:!!m.can_use_style,canUseSpeakerBoost:!!m.can_use_speaker_boost,maxCharacters:m.maximum_text_length_per_request,rates:m.model_rates})):[]});}
  if(body.action==='assign'){
   if(typeof body.personaId!=='string'||!/^[-a-f0-9]{36}$/i.test(body.personaId))return reply(400,{error:'Choose a persona.'});
   const voice=publicVoice(await read(new URL('/v1/voices/'+voiceId(body.voiceId),ELEVENLABS),record.key));
   const saved=await admin.rpc('save_persona_voice_service',{p_owner:owner,p_persona_id:body.personaId,p_voice_id:voice.id,p_name:voice.name});if(saved.error)throw new Error('This voice could not be assigned to the persona.');return reply(200,{voice});
  }
  return reply(400,{error:'Unknown voice action'});
 }catch(error){return reply(409,{error:(error as Error).message});}
});

