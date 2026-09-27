export const ELEVENLABS='https://api.elevenlabs.io';
// The models API returns a top-level array; the app request parser deliberately
// accepts only objects. Keep provider response parsing separate and bounded.
export async function elevenJson(response:Response,max=1000000):Promise<any>{
 if(!response.body)throw new Error('ElevenLabs returned an empty response.');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new Error('The ElevenLabs response was too large.');chunks.push(value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||typeof data!=='object')throw new Error('ElevenLabs returned invalid data.');return data;
}
export function voiceSearch(body:Record<string,unknown>){
 const url=new URL('/v2/voices',ELEVENLABS);url.searchParams.set('page_size','20');
 for(const [key,max] of [['search',120],['next_page_token',1000],['language',10],['accent',80]] as const){const value=body[key];if(value!=null&&value!==''){if(typeof value!=='string'||value.length>max)throw new Error('Voice search is too long.');url.searchParams.set(key,value);}}
 if(body.voice_type){if(!['personal','community','default','workspace','saved'].includes(String(body.voice_type)))throw new Error('Choose a voice collection.');url.searchParams.set('voice_type',String(body.voice_type));}
 url.searchParams.set('sort','name');url.searchParams.set('sort_direction','asc');return url;
}
export function voiceId(value:unknown):string{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value))throw new Error('Choose a voice.');return value;}
export function safeVoicePreview(value:unknown){try{const url=new URL(String(value));return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&((url.hostname==='storage.googleapis.com'&&url.pathname.startsWith('/eleven-public-prod/'))||url.hostname==='elevenlabs.io'||url.hostname.endsWith('.elevenlabs.io'))?url.href:null;}catch{return null;}}
export function publicVoice(row:Record<string,any>){return {id:voiceId(row.voice_id),name:String(row.name||'Untitled voice').slice(0,200),description:String(row.description||'').slice(0,1000),labels:row.labels&&typeof row.labels==='object'?Object.fromEntries(Object.entries(row.labels).slice(0,12).map(([k,v])=>[k.slice(0,50),String(v).slice(0,100)])):{},category:String(row.category||'').slice(0,50),preview:safeVoicePreview(row.preview_url),noticeDays:row.sharing?.notice_period??null};}
