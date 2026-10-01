// SMS approvals card for the agent board. Enrollment, verification, model
// assignment, and revocation all go through the sms-approvals Edge Function
// with the owner's AAL2 session; reads use my_sms_channel()/my_sms_edit_requests().
// This UI never sends a decision itself — decisions arrive by text.
let smsApprovalsState={loaded:false,loading:false,busy:false,channel:null,editRequests:[],error:"",pendingPhone:""};
const SMS_CONSENT_VERSION="sms-2026-09-30";

function smsApprovalsCardHtml(){
  const s=smsApprovalsState;
  if(!s.loaded&&!s.loading){s.loading=true;smsApprovalsLoad()}
  if(!s.loaded)return `<div class="agent-board-card"><h3>SMS approvals</h3><p class="muted">Loading…</p></div>`;
  const c=s.channel,busy=s.busy?'disabled aria-busy="true"':"";
  const head=`<h3>SMS approvals</h3><p class="muted">Get texted when an agent task or content kit needs your review, and reply APPROVE, REJECT, or EDIT with the code. Texts never schedule or publish; those stay behind the app's MFA flows.</p>${s.error?`<div class="agent-board-callout warn">${esc(s.error)}</div>`:""}`;
  if(!c||c.status==="revoked"){
    return `<div class="agent-board-card">${head}
      <label for="smsPhone">Mobile number (E.164)</label><input id="smsPhone" maxlength="16" placeholder="+19075551234" value="${esc(s.pendingPhone)}" autocomplete="tel">
      <label><input id="smsConsent" type="checkbox"> I own this number and agree to receive approval texts from AliaSpaces. Message and data rates may apply. Reply STOP to pause.</label>
      <button class="btn" type="button" ${busy} onclick="smsApprovalsEnroll()">Text me a verification code</button></div>`;
  }
  if(c.status==="pending_verification"){
    return `<div class="agent-board-card">${head}<p>A 6-digit code was sent to <b>${esc(c.phone_e164)}</b>. It expires in 10 minutes.</p>
      <label for="smsCode">Verification code</label><input id="smsCode" inputmode="numeric" maxlength="6" pattern="[0-9]{6}">
      <div class="row"><button class="btn" type="button" ${busy} onclick="smsApprovalsVerify()">Verify</button><button class="btn sec" type="button" ${busy} onclick="smsApprovalsState.channel=null;smsApprovalsState.pendingPhone='${esc(c.phone_e164)}';agentBoardPaint('smsPhone')">Use a different number</button></div></div>`;
  }
  const ready=(myBackends||[]).filter(b=>b&&b.id);
  const types=Array.isArray(c.notify_types)?c.notify_types:[];
  const edits=s.editRequests||[];
  return `<div class="agent-board-card">${head}
    <p><b>${esc(c.phone_e164)}</b> · ${c.status==="paused"?"paused":"active"} · ${Number(c.open_codes||0)} open code${Number(c.open_codes||0)===1?"":"s"}${c.last_inbound_at?` · last text ${esc(new Date(c.last_inbound_at).toLocaleString())}`:""}</p>
    <label for="smsBackend">Model that answers your texts</label><select id="smsBackend"><option value="">None (commands only)</option>${ready.map(b=>`<option value="${esc(b.id)}" ${b.id===c.backend_id?"selected":""}>${esc(b.name)} · ${esc(b.model||"model not set")}</option>`).join("")}</select>
    <p class="muted">This model reads your persona and automation settings to answer questions and can apply a decision you clearly ask for. Local fleet, Ollama, and LM Studio models cannot be reached from SMS.</p>
    <div class="row"><label><input id="smsNotifyContent" type="checkbox" ${types.includes("content_review")?"checked":""}> Text me content kits</label><label><input id="smsNotifyAgent" type="checkbox" ${types.includes("agent_board_review")?"checked":""}> Text me agent tasks</label></div>
    <div class="row"><label><input id="smsAssistant" type="checkbox" ${c.assistant_enabled?"checked":""}> Answer questions by text</label><label><input id="smsPaused" type="checkbox" ${c.status==="paused"?"checked":""}> Pause all texts</label></div>
    <div class="row"><button class="btn" type="button" ${busy} onclick="smsApprovalsSave()">Save SMS settings</button><button class="btn sec" type="button" ${busy} onclick="smsApprovalsRevoke()">Remove number</button></div>
    ${edits.length?`<h4>Edit requests from your phone</h4><ul class="agent-board-list">${edits.map(e=>`<li><b>${esc(e.subject_type==="content_package"?"Content kit":"Agent task")}</b> · ${esc(new Date(e.created_at).toLocaleString())}<br>${esc(e.note)}<br><button class="btn sec" type="button" ${busy} onclick="smsApprovalsResolveEdit('${esc(e.id)}','addressed')">Mark addressed</button> <button class="btn sec" type="button" ${busy} onclick="smsApprovalsResolveEdit('${esc(e.id)}','dismissed')">Dismiss</button></li>`).join("")}</ul>`:""}
  </div>`;
}

async function smsApprovalsLoad(){
  const s=smsApprovalsState;
  try{
    if(!sb||!session){s.loaded=true;s.loading=false;return}
    const [channel,edits]=await Promise.all([sb.rpc("my_sms_channel"),sb.rpc("my_sms_edit_requests")]);
    s.channel=channel.error?null:((Array.isArray(channel.data)?channel.data[0]:channel.data)||null);
    s.editRequests=edits.error?[]:(edits.data||[]);
    s.error=channel.error?agentBoardSetupMessage(channel.error.message):"";
  }catch(error){s.error=error?.message||"SMS settings could not be loaded"}
  s.loaded=true;s.loading=false;
  if(typeof agentBoardPaint==="function"&&document.querySelector(".agent-board"))agentBoardPaint();
}

async function smsApprovalsCall(action,payload){
  const active=session;if(!active?.access_token)throw new Error("Sign in again");
  const response=await fetch(CONFIG.SUPABASE_URL.replace(/\/$/,"")+"/functions/v1/sms-approvals?action="+encodeURIComponent(action),{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+active.access_token},body:JSON.stringify(payload||{})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||`SMS request failed (HTTP ${response.status})`);
  return result;
}

async function smsApprovalsRun(purpose,work){
  const s=smsApprovalsState;if(s.busy)return;
  if(!await requireAal2ForSensitiveAction(purpose))return;
  s.busy=true;s.error="";agentBoardPaint();
  try{await work()}catch(error){s.error=error?.message||"The SMS request failed";toast(s.error)}
  s.busy=false;s.loaded=false;s.loading=false;agentBoardPaint();
}

function smsApprovalsEnroll(){
  const phone=(document.getElementById("smsPhone")?.value||"").replace(/[\s()-]/g,"");
  const consent=!!document.getElementById("smsConsent")?.checked;
  smsApprovalsState.pendingPhone=phone;
  if(!/^\+[1-9][0-9]{7,14}$/.test(phone)){toast("Enter the number in E.164 form, e.g. +19075551234");return}
  if(!consent){toast("Confirm you own this number and consent to texts");return}
  return smsApprovalsRun("enroll a phone for SMS approvals",async()=>{await smsApprovalsCall("enroll",{phone,consentVersion:SMS_CONSENT_VERSION});toast("Verification code sent")});
}
function smsApprovalsVerify(){
  const code=(document.getElementById("smsCode")?.value||"").replace(/\D/g,"");
  if(code.length!==6){toast("Enter the 6-digit code");return}
  return smsApprovalsRun("verify your phone",async()=>{await smsApprovalsCall("verify",{code});toast("SMS approvals are on")});
}
function smsApprovalsSave(){
  const notifyTypes=[];if(document.getElementById("smsNotifyContent")?.checked)notifyTypes.push("content_review");if(document.getElementById("smsNotifyAgent")?.checked)notifyTypes.push("agent_board_review");
  if(!notifyTypes.length){toast("Choose at least one notification type");return}
  const backendId=document.getElementById("smsBackend")?.value||null,assistantEnabled=!!document.getElementById("smsAssistant")?.checked,paused=!!document.getElementById("smsPaused")?.checked;
  return smsApprovalsRun("change SMS approval settings",async()=>{await smsApprovalsCall("settings",{backendId,notifyTypes,assistantEnabled,paused});toast("SMS settings saved")});
}
function smsApprovalsRevoke(){
  if(!confirm("Remove this number? Open decision codes will stop working."))return;
  return smsApprovalsRun("remove your SMS number",async()=>{await smsApprovalsCall("revoke",{});toast("Number removed")});
}
async function smsApprovalsResolveEdit(id,status){
  const s=smsApprovalsState;if(s.busy)return;s.busy=true;agentBoardPaint();
  const result=await sb.rpc("resolve_my_sms_edit_request",{p_id:id,p_status:status});
  if(result.error)toast(result.error.message);
  s.busy=false;s.loaded=false;s.loading=false;agentBoardPaint();
}
