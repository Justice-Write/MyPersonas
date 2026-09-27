export const OPENART = Object.freeze({
 resource:"https://mcp.openart.ai/mcp",
 authorize:"https://openart.ai/suite/api/auth/oauth/authorize",
 token:"https://openart.ai/suite/api/auth/oauth/token",
 register:"https://openart.ai/suite/api/auth/oauth/register",
 revoke:"https://openart.ai/suite/api/auth/oauth/revoke"
});
export function oauthRandom(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");}
export async function oauthHash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");}
export async function openArtAuthorize(clientId:string,callback:string,state:string,verifier:string){
 const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
 const url=new URL(OPENART.authorize);for(const [key,value] of Object.entries({response_type:"code",client_id:clientId,redirect_uri:callback,scope:"full_access",resource:OPENART.resource,state,code_challenge:challenge,code_challenge_method:"S256"}))url.searchParams.set(key,value);return url.toString();
}
export function validateOpenArtToken(data:Record<string,unknown>,clientId:string){
 if(typeof data.access_token!=="string"||data.access_token.length<10||data.access_token.length>12000||typeof data.expires_in!=="number"||!Number.isFinite(data.expires_in)||data.expires_in<1||String(data.token_type).toLowerCase()!=="bearer")throw new Error("OpenArt returned an invalid authorization result.");
 if(data.refresh_token!==undefined&&(typeof data.refresh_token!=="string"||data.refresh_token.length>12000))throw new Error("OpenArt returned an invalid refresh credential.");
 return {access_token:data.access_token,refresh_token:data.refresh_token||null,expires_in:Math.floor(data.expires_in),client_id:clientId,token_type:"Bearer"};
}

