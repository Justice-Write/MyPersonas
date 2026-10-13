export const READ_SCOPES = ["personas:read","research:read","drafts:read"] as const;
export async function hashDeveloperKey(value: string): Promise<string> {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
export function generateDeveloperKey(): string {
  return "mp_dev_"+Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
}
export function keyRequest(body: Record<string,unknown>) {
  if(typeof body.label!=="string"||!body.label.trim()||body.label.length>80)throw new Error("Name this key (up to 80 characters).");
  if(!Array.isArray(body.scopes)||!body.scopes.length||body.scopes.length>3||body.scopes.some(s=>!READ_SCOPES.includes(s)))throw new Error("Choose supported access permissions.");
  if(!Array.isArray(body.personaIds)||!body.personaIds.length||body.personaIds.length>50||body.personaIds.some(id=>typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id)))throw new Error("Choose between 1 and 50 personas.");
  return {label:body.label.trim(),scopes:[...new Set(body.scopes)] as string[],persona_ids:[...new Set(body.personaIds)] as string[]};
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
