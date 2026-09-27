import assert from 'node:assert/strict';
import test from 'node:test';
import {buildReviewBatch,reviewHtml,sha256} from '../scripts/lib/persona-review-packet.mjs';
const fixture=()=>({schema_version:1,captured_at:'2026-09-27T00:00:00Z',source:'authenticated_read_only_database',personas:[{profile:{handle:'test.persona',name:'<script>alert(1)</script>',visibility:'public',publication_revision:1,publication_state:'unpublished'},destination_links:[],account_bindings:[],media_assets:[],layout:{},posts:[],albums:[],family:[],dependencies:[],businesses:[],revenue:{},request_review:{},automation_safety:{}}]});
test('packet review never inherits approval and tracks exact material changes',()=>{
 const source=fixture();source.personas[0].publish_authorized=true;
 const a=buildReviewBatch(source,['test.persona']);assert.equal(a.packets[0].publish_authorized,false);assert.equal(a.packets[0].approval_receipt,null);assert.equal(a.coverage.missing.length,0);
 source.personas[0].profile.bio='Changed';const b=buildReviewBatch(source);assert.notEqual(a.packets[0].surface_sha256,b.packets[0].surface_sha256);
 assert.equal(sha256({b:2,a:1}),sha256({a:1,b:2}));
});
test('rejects incomplete, duplicate, unsafe-filename and private-field snapshots',()=>{
 for(const mutate of [s=>delete s.personas[0].albums,s=>s.personas.push(s.personas[0]),s=>s.personas[0].profile.handle='../escape',s=>s.personas[0].account_bindings.push({login_email:'private@example.test'}),s=>s.personas[0].profile.publication_revision=null]){
  const s=fixture();mutate(s);assert.throws(()=>buildReviewBatch(s));
 }
});
test('renders all fields inertly and exposes stale dependencies and missing roster members',()=>{
 const s=fixture();s.personas[0].dependencies.push({publication_state:'unpublished',publication_revision:2,dependency_revision:1});
 const b=buildReviewBatch(s,['test.persona','missing']);assert.deepEqual(b.coverage.missing,['missing']);assert.ok(b.packets[0].findings.includes('dependency_not_currently_published'));
 const html=reviewHtml(b);assert.doesNotMatch(html,/<script>|<img|<iframe|<form/);assert.match(html,/&lt;script&gt;/);assert.match(html,/default-src 'none'/);
});
