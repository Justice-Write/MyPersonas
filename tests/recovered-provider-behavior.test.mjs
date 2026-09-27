import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {crossrefUrl,normalizeCrossref,collectResearch} from '../supabase/functions/_shared/research.ts';
import {fleetURL,chatDeltas} from '../supabase/functions/_shared/fleet-protocol.ts';
import {boundedJson,draftProposal,keyRequest} from '../supabase/functions/_shared/developer.ts';
import {revokeOpenArtTokens} from '../supabase/functions/_shared/openart-revoke.ts';

test('research retains source metadata, deduplicates DOI and never invents date precision',async()=>{
 const rows=normalizeCrossref({message:{items:[
  {DOI:'10.1234/ABC',title:['<b>A study</b>'],published:{'date-parts':[[2024]]}},
  {DOI:'10.1234/abc',title:['duplicate']},
  {DOI:'javascript:alert(1)',title:['invalid']}
 ]}},new Date('2026-09-27T00:00:00Z'));
 assert.equal(rows.length,1);assert.equal(rows[0].source,'crossref');assert.equal(rows[0].date_precision,'year');assert.equal(rows[0].title,'A study');
 assert.equal(crossrefUrl('useful research',90).hostname,'api.crossref.org');assert.throws(()=>crossrefUrl('abc',1));
 await assert.rejects(()=>collectResearch('bounded research',90,async()=>new Response('x'.repeat(512001))),/size limit/);
});
test('fleet stream requires explicit finish and completion and rejects tool execution',async()=>{
 const consume=async text=>{const result=[];for await(const part of chatDeltas(new Response(text).body))result.push(part);return result;};
 const delta='data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
 await assert.rejects(()=>consume(delta+'data: [DONE]\n\n'),/stream_incomplete/);
 await assert.rejects(()=>consume('data: {"choices":[{"delta":{"tool_calls":[]}}]}\n\n'),/tools_not_supported/);
 const result=await consume(delta+'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
 assert.equal(result.at(-1).done,true);
 for(const url of ['http://example.test/v1','https://key@example.test/v1','https://example.test/v1?token=x','https://example.test:444/v1'])assert.throws(()=>fleetURL(url));
});
test('developer proposals cannot carry approval or publication authority',async()=>{
 const body={request_id:'00000000-0000-4000-8000-000000000001',persona_id:'00000000-0000-4000-8000-000000000002',title:'Review',body:'Private draft'};
 assert.equal(draftProposal(body).timezone,'UTC');
 for(const key of ['approved','published','provider_id'])assert.throws(()=>draftProposal({...body,[key]:true}),/Unsupported/);
 assert.throws(()=>keyRequest({label:'Unsafe',scopes:['publish'],personaIds:[body.persona_id]}));
 assert.throws(()=>draftProposal({...body,source_urls:['https://user:pass@example.test/']}));
 await assert.rejects(()=>boundedJson(new Response('{"value":"'+ 'x'.repeat(200) +'"}'),32),/too large/);
 await assert.rejects(()=>boundedJson(new Response('[]')),/object/);
});
test('OpenArt revocation attempts refresh then access and stops on unresolved failures',async()=>{
 const tokens={refresh_token:'fixture-refresh',access_token:'fixture-access',client_id:'fixture-client'};const calls=[];
 await revokeOpenArtTokens(tokens,async(url,options)=>{assert.equal(new URL(url).hostname,'openart.ai');assert.equal(options.redirect,'error');calls.push(options.body.get('token_type_hint'));return new Response('',{status:200});});
 assert.deepEqual(calls,['refresh_token','access_token']);let attempted=0;
 await assert.rejects(()=>revokeOpenArtTokens(tokens,async()=>{attempted++;return new Response('',{status:503});}),/retained/);assert.equal(attempted,1);
});
test('recovered erasure and local-fleet restrictions remain wired into existing entrypoints',async()=>{
 const erase=await readFile(new URL('../supabase/functions/delete-account/index.ts',import.meta.url),'utf8');
 assert.match(erase,/bucket: "speech-private"/);assert.match(erase,/revokeOpenArtTokens\(openart.data.tokens\)/);
 for(const table of ['developer_keys','music_notebooks','elevenlabs_jobs','openart_jobs','research_watches','research_articles'])assert.ok(erase.includes(`from("${table}").delete().eq("owner", uid)`));
 const proxy=await readFile(new URL('../supabase/functions/ai-proxy/index.ts',import.meta.url),'utf8');
 assert.match(proxy,/This persona requires its configured local fleet connection/);
 assert.match(proxy,/mode === "general_chat" \? "owner_chat" : mode/);
 assert.match(proxy,/General chat cannot attach a persona/);
});
