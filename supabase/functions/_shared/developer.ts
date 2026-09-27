export const READ_SCOPES = ["personas:read","research:read","drafts:read"] as const;
export const DEVELOPER_SCOPES=[...READ_SCOPES,'drafts:propose'] as const;
export async function hashDeveloperKey(value: string): Promise<string> {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
export function generateDeveloperKey(): string {
  return "mp_dev_"+Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
}
export function keyRequest(body: Record<string,unknown>) {
  if(typeof body.label!=="string"||!body.label.trim()||body.label.length>80)throw new Error("Name this key (up to 80 characters).");
  if(!Array.isArray(body.scopes)||!body.scopes.length||body.scopes.length>4||body.scopes.some(s=>!DEVELOPER_SCOPES.includes(s)))throw new Error("Choose supported access permissions.");
  if(!Array.isArray(body.personaIds)||!body.personaIds.length||body.personaIds.length>50||body.personaIds.some(id=>typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id)))throw new Error("Choose between 1 and 50 personas.");
  return {label:body.label.trim(),scopes:[...new Set(body.scopes)] as string[],persona_ids:[...new Set(body.personaIds)] as string[]};
}
export function draftProposal(body:Record<string,unknown>){
 const allowed=['request_id','persona_id','title','body','source_urls','proposed_publish_at','timezone'];
 if(Object.keys(body).some(k=>!allowed.includes(k)))throw new Error('Unsupported proposal field.');
 const id=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
 if(typeof body.request_id!=='string'||!id.test(body.request_id)||typeof body.persona_id!=='string'||!id.test(body.persona_id))throw new Error('Valid request_id and persona_id are required.');
 if(typeof body.body!=='string'||!body.body.trim()||new TextEncoder().encode(body.body).length>10000||typeof body.title!=='string'||new TextEncoder().encode(body.title).length>1000)throw new Error('A bounded title and draft body are required.');
 const sources=body.source_urls??[];if(!Array.isArray(sources)||sources.length>10)throw new Error('Use at most ten source URLs.');
 for(const value of sources){let u;try{u=new URL(value);}catch{}if(typeof value!=='string'||value.length>1000||!u||u.protocol!=='https:'||u.username||u.password)throw new Error('Sources require credential-free HTTPS URLs.');}
 const timezone=body.timezone??'UTC';if(typeof timezone!=='string'||timezone.length>100)throw new Error('Invalid timezone.');try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw new Error('Invalid timezone.');}
 const at=body.proposed_publish_at??null;if(at!==null&&(typeof at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(at)||!Number.isFinite(Date.parse(at))))throw new Error('The proposed time requires an ISO timestamp with timezone.');
 return {request_id:body.request_id,persona_id:body.persona_id,title:body.title,body:body.body,source_urls:sources,proposed_publish_at:at,timezone};
}
export const developerHeaders = {"Content-Type":"application/json","Cache-Control":"no-store"};
export async function boundedJson(req: Request | Response,max=4096): Promise<Record<string,unknown>> {
  if(!req.body)throw new Error("Request body required.");
  const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new Error("Request is too large.");chunks.push(value);}}finally{await reader.cancel();}
  const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
  const value=JSON.parse(new TextDecoder().decode(buffer));
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Expected an object.");return value;
}

