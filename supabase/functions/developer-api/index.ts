import {createClient} from "https://esm.sh/@supabase/supabase-js@2.115.0";
import {hashDeveloperKey,developerHeaders,boundedJson,draftProposal} from "../_shared/developer.ts";
const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const operations:Record<string,{scope:string;table:string;columns:string}>={
  personas:{scope:"personas:read",table:"personas",columns:"id,name,handle,tagline"},
  research:{scope:"research:read",table:"research_articles",columns:"id,persona_id,doi,title,authors,publication,published,date_precision,source_url,source,retrieved_at"},
  drafts:{scope:"drafts:read",table:"drafts",columns:"id,persona_id,title,body,platform,approval_state,publish_state"}
};
Deno.serve(async req=>{
  const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:developerHeaders});
  const url=new URL(req.url),path=url.pathname.replace(/^.*\/developer-api\/?/,""),propose=path==='draft-proposals'&&req.method==='POST',op=propose?{scope:'drafts:propose',table:'',columns:''}:operations[path];
  if(req.method!=="GET"&&!propose)return reply(405,{error:"method_not_supported"});
  if(!op)return reply(404,{error:"not_found"});
  const token=req.headers.get("Authorization")?.match(/^Bearer (mp_dev_[a-f0-9]{64})$/)?.[1];
  if(!token)return reply(401,{error:"invalid_key"});
  const {data:grant,error:authError}=await admin.rpc("developer_authorize",{p_hash:await hashDeveloperKey(token),p_scope:op.scope});
  if(authError||!grant)return reply(503,{error:"authorization_unavailable"});
  if(grant.error)return reply(grant.status,{error:grant.error});
  if(propose){
    let proposal;try{proposal=draftProposal(await boundedJson(req,24000));}catch(error){return reply(400,{error:'invalid_proposal',message:(error as Error).message});}
    if(!grant.persona_ids.includes(proposal.persona_id))return reply(404,{error:'not_found'});
    const result=await admin.rpc('submit_developer_draft_proposal',{p_owner:grant.owner,p_key:grant.key_id,p_persona:proposal.persona_id,p_request:proposal.request_id,p_title:proposal.title,p_body:proposal.body,p_sources:proposal.source_urls,p_at:proposal.proposed_publish_at,p_timezone:proposal.timezone});
    if(result.error)return reply(409,{error:'proposal_not_saved',message:'The proposal conflicted, exceeded a limit or is no longer permitted. Use the same request ID only for the same content.'});
    return reply(result.data.replayed?200:201,{data:result.data,owner_review_required:true,published:false});
  }
  const limit=Number(url.searchParams.get("limit")||20),offset=Number(url.searchParams.get("offset")||0);
  if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>10000)return reply(400,{error:"invalid_pagination"});
  // Recheck current ownership: a key grant never grants a transferred persona.
  const owned=await admin.from("personas").select("id").eq("owner",grant.owner).in("id",grant.persona_ids);
  if(owned.error)return reply(503,{error:"data_unavailable"});
  const ids=(owned.data||[]).map(p=>p.id),requested=url.searchParams.get("persona_id");
  if(requested&&!ids.includes(requested))return reply(404,{error:"not_found"});
  if(!ids.length)return reply(200,{data:[],next_offset:null});
  let query=admin.from(op.table).select(op.columns).eq("owner",grant.owner).in(path==="personas"?"id":"persona_id",requested?[requested]:ids).order("id").range(offset,offset+limit);
  if(path==="research")query=query.eq("dismissed",false);
  const result=await query;if(result.error)return reply(503,{error:"data_unavailable"});
  return reply(200,{data:result.data.slice(0,limit),next_offset:result.data.length>limit?offset+limit:null});
});

