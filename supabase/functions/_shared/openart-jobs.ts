export function unpackOpenArt(result:Record<string,unknown>):Record<string,any>{
 if(result.structuredContent&&typeof result.structuredContent==='object')return result.structuredContent as Record<string,any>;
 for(const item of Array.isArray(result.content)?result.content:[])if(item.type==='text'){
  try{const parsed=JSON.parse(item.text);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;}catch{/* Try the next structured text item. */}
 }
 throw new Error('OpenArt returned an unsupported response.');
}
export function generationRequest(body:Record<string,unknown>){
 const text=(value:unknown,max:number)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error('Choose a project, model and mode.');return value;};
 if(body.consent!==true)throw new Error('Approve sending this prompt and its references to OpenArt.');
 if(body.media!=='image'&&body.media!=='video')throw new Error('Choose image or video.');
 if(!body.params||typeof body.params!=='object'||Array.isArray(body.params)||JSON.stringify(body.params).length>12000)throw new Error('Invalid generation settings.');
 if(body.personaId!=null&&(typeof body.personaId!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.personaId)))throw new Error('Choose a persona.');
 return {model:text(body.model,128),mode:text(body.mode,64),projectId:text(body.projectId,128),media:body.media,params:body.params};
}
export function quoteCredits(data:Record<string,any>):number{
 if(data.currency!=='credits'||!Array.isArray(data.items)||data.items.length!==1)throw new Error('OpenArt did not return one credit estimate for these settings.');
 const credits=data.items[0].totalCredits;
 if(typeof credits!=='number'||!Number.isFinite(credits)||credits<0||credits>1000000)throw new Error('OpenArt returned an invalid credit estimate.');
 return credits;
}
export function generationResult(data:Record<string,any>){
 const states:Record<string,string>={PENDING:'submitted',RUNNING:'submitted',COMPLETED:'completed',FAILED:'failed',CANCELLED:'cancelled'};
 if(typeof data.historyId!=='string'||data.historyId.length<1||data.historyId.length>200||!states[data.status])throw new Error('OpenArt returned an incomplete generation receipt.');
 const safeUrl=(url:unknown)=>{try{const u=new URL(String(url));return u.protocol==='https:'&&u.hostname==='cdn.openart.ai'&&!u.username&&!u.password&&!u.port?u.href:null;}catch{return null;}};
 const resources=data.hideMedia?[]:(Array.isArray(data.resources)?data.resources:[]).slice(0,16).map(r=>({id:String(r.id).slice(0,200),mediaType:String(r.mediaType).slice(0,30),url:safeUrl(r.url),thumbnailUrl:safeUrl(r.thumbnailUrl)})).filter(r=>r.url);
 // Provider nextStep is deliberately omitted: follow-up calls require a new approval.
 return {history_id:data.historyId,status:states[data.status],poll_seconds:Math.min(600,Math.max(5,Number(data.pollAfterSeconds)||10)),result:{resources,hideMedia:!!data.hideMedia,warning:typeof data.warning==='string'?data.warning.slice(0,1000):null,error:data.status==='FAILED'?'The provider could not complete this generation.':null}};
}

