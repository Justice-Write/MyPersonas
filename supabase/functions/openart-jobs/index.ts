import {createClient} from "https://esm.sh/@supabase/supabase-js@2.115.0";
import {Ajv} from "npm:ajv@8.20.0";
import {requireAal2} from "../_shared/aal2.ts";
import {boundedJson} from "../_shared/developer.ts";
import {readOpenArt,callOpenArt} from "../_shared/openart-client.ts";
import {generationRequest,generationResult,quoteCredits,unpackOpenArt} from "../_shared/openart-jobs.ts";
const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const origins=new Set(["https://mypersonas.online","https://www.mypersonas.online","https://aliaspaces.com","https://www.aliaspaces.com"]);
const ajv=new Ajv({strict:false,allErrors:false,validateFormats:false});
const uuid=(id:unknown):id is string=>typeof id==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);
async function operation(owner:string,action:string,id:string|null=null,data:unknown={}){
 const result=await admin.rpc('openart_job_service',{p_owner:owner,p_action:action,p_id:id,p_data:data});
 if(result.error)throw new Error('This generation could not be updated. Refresh its status before trying again.');return result.data;
}
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'',headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin'};
 if(origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'});
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!origins.has(origin))return reply(403,{error:'Origin not allowed'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Use POST'});
 const guard=await requireAal2(req,admin);if(!guard.ok)return reply(guard.status,{error:guard.error});
 const owner=guard.user.id;
 let body;try{body=await boundedJson(req,16000);}catch{return reply(400,{error:'Invalid request'});}
 try{
  if(body.action==='list'){
   const rows=await admin.from('openart_jobs').select('*').eq('owner',owner).order('created_at',{ascending:false}).limit(30);
   if(rows.error)throw new Error('Your generation history could not be loaded.');return reply(200,{jobs:rows.data});
  }
  if(body.action==='quote'){
   const request=generationRequest(body);
   const form=unpackOpenArt(await readOpenArt(admin,owner,'form',{model:request.model,mode:request.mode}));
   if(form.media!==request.media)throw new Error('Choose a compatible model and mode.');
   if(!form.jsonSchema||!ajv.compile(form.jsonSchema)(request.params))throw new Error('Check the required settings and reference limits for this model.');
   const quote=unpackOpenArt(await readOpenArt(admin,owner,'quote',{model:request.model,mode:request.mode,params:request.params}));
   const job=await operation(owner,'quote',null,{request,credits:quoteCredits(quote),persona_id:body.personaId||null});
   return reply(200,{job,note:typeof quote.pricingNote==='string'?quote.pricingNote.slice(0,1000):'Estimated credits; OpenArt controls the final charge.'});
  }
  if(!uuid(body.id))return reply(400,{error:'Choose a saved generation.'});
  if(body.action==='cancel')return reply(200,{job:await operation(owner,'cancel',body.id)});
  if(body.action==='generate'){
   if(body.approve!==true||typeof body.credits!=='number'||!Number.isFinite(body.credits))return reply(400,{error:'Confirm the displayed credit estimate before generating.'});
   const claim=await operation(owner,'claim',body.id,{approved_credits:body.credits});
   if(!claim.dispatch)return reply(200,{job:claim.job});
   const {media,...args}=claim.job.request;
   try{
    const result=unpackOpenArt(await callOpenArt(admin,owner,media,args));
    return reply(200,{job:await operation(owner,'record',body.id,generationResult(result))});
   }catch{
    // A network failure cannot prove the provider did not spend credits.
    // The same job is never submitted again, even after an app restart.
    const job=await operation(owner,'record',body.id,{status:'uncertain',result:{warning:'The provider receipt was interrupted. Check this OpenArt project before starting another generation.'}});
    return reply(200,{job});
   }
  }
  if(body.action==='refresh'){
   const claim=await operation(owner,'poll',body.id);if(!claim.poll)return reply(200,{job:claim.job});
   const result=unpackOpenArt(await callOpenArt(admin,owner,'generation',{historyId:claim.job.history_id}));
   return reply(200,{job:await operation(owner,'record',body.id,generationResult(result))});
  }
  return reply(400,{error:'Unknown generation action'});
 }catch(error){return reply(409,{error:(error as Error).message});}
});

