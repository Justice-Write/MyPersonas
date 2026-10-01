'use strict';
// Offline review only: this module has no network, publication, or wallet API.
function inspect(m) {
  const blockers=[];
  if(!m || typeof m!=='object' || Array.isArray(m))return {ready:false,blockers:['invalid manifest'],execution:'offline_review_only'};
  if(m.publishing_enabled!==false)blockers.push('publishing must remain disabled');
  if(m.external_actions_attempted!==false)blockers.push('external actions must remain disabled');
  if(!['approval_required','approval_only'].includes(m.state))blockers.push('approval state missing or unexpected');
  if(m.operating_mode!=='L0_co_writer_approval_only')blockers.push('L0 co-writer mode required');
  const t=m.tradcoin;
  if(!t || typeof t!=='object')blockers.push('token evidence missing');
  else {
    for(const k of ['exact_service','chain','ticker','contract_or_mint','official_url','legal_owner_entity_and_jurisdiction','creator_allocation','treasury_holdings_and_control','creator_fees_or_compensation','owner_material_relationship']) {
      if(t[k]===null || t[k]===undefined || (typeof t[k]==='string' && (!t[k].trim() || /\[.*\]|pending|unknown/i.test(t[k]))))blockers.push('unresolved: '+k);
    }
    if(t.direct_purchase_cta!=='blocked' || t.token_link!=='blocked')blockers.push('purchase and token links must remain blocked');
    if(t.paid_promotion!=='blocked_pending_platform_and_legal_review')blockers.push('paid promotion must remain blocked');
  }
  if(!Array.isArray(m.starter_assets) || !m.starter_assets.length)blockers.push('starter assets missing');
  else for(const a of m.starter_assets) {
    if(a.approval_state!=='awaiting_owner_approval'||a.queue_state!=='not_queued'||a.schedule_state!=='not_scheduled'||a.provider_id!==null)blockers.push('asset execution boundary violated: '+(a.name||'unnamed'));
  }
  return {ready:blockers.length===0,blockers,execution:'offline_review_only',note:'Ready means evidence fields are populated and local draft boundaries hold. It does not verify truth, approval, security, legal clearance, or launch readiness.'};
}
module.exports={inspect};
if(require.main===module){
 const fs=require('node:fs');
 try{console.log(JSON.stringify(inspect(JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''))),null,2));}
 catch{console.error('Unable to inspect manifest. No external action attempted.');process.exitCode=1;}
}
