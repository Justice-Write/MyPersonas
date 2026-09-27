import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.115.0';
import {collectResearch} from '../_shared/research.ts';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}});
Deno.serve(async req=>{
 const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST'||req.headers.get('Origin'))return reply(403,{error:'Worker requests only'});
 const token=req.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)return reply(401,{error:'Worker authentication required'});
 const auth=await admin.rpc('research_worker_authorize',{p_token:token});if(auth.error||auth.data!==true)return reply(401,{error:'Worker authentication required'});
 const claim=await admin.rpc('research_claim_due');if(claim.error)return reply(503,{error:'Research queue unavailable'});
 const batch=Array.isArray(claim.data)?claim.data:[];
 const results=await Promise.all(batch.map(async job=>{
  const finish=(articles:unknown[],failed=false)=>admin.rpc('research_finish_collection',{p_owner:job.owner,p_persona:job.persona_id,p_token:job.token,p_topic:job.topic,p_articles:articles,p_watch:true,p_failed:failed});
  try{const articles=await collectResearch(job.topic,job.days);const result=await finish(articles);if(result.error)throw new Error('Save failed');return {complete:true};}
  catch{await finish([],true);return {complete:false};}
 }));
 return reply(200,{claimed:results.length,completed:results.filter(r=>r.complete).length});
});
