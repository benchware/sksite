
(function(){
  'use strict';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function t(en,de){return lang()==='de'?de:en}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function token(){return localStorage.getItem('skToken')||''}
  function nameOf(c){return lang()==='de'?(c.name_de||c.name||c.id):(c.name||c.name_de||c.id)}
  function titleOf(e){return lang()==='de'?(e.title_de||e.title||e.id):(e.title||e.title_de||e.id)}
  function descOf(e){return lang()==='de'?(e.description_de||e.description||''):(e.description||e.description_de||'')}
  function summaryOf(c){return lang()==='de'?(c.summary_de||c.summary||''):(c.summary||c.summary_de||'')}
  async function api(url,opts){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(opts||{})});
    const text=await r.text();
    if(text.trim().startsWith('<')) throw new Error('Expected JSON but received HTML. Check that Caddy proxies '+url+' to the Node API.');
    if(!r.ok){
      let body={}; try{body=JSON.parse(text)}catch(e){}
      throw new Error(body.error||('HTTP '+r.status));
    }
    try{return text?JSON.parse(text):{};}catch(e){throw new Error('Expected JSON from '+url+' but received non-JSON response.');}
  }
  function result(msg,ok=true){
    const box=document.getElementById('vote-status');
    if(box){box.className=ok?'form-saved':'form-error';box.innerHTML=msg;}
  }
  function renderElection(e){
    const voted=e.userVote;
    const candidates=(e.candidates||[]).map(c=>`<div class="radio">
      <label>
        <input type="radio" name="candidate-${esc(e.id)}" value="${esc(c.id)}" ${voted&&voted.candidateId===c.id?'checked':''} ${voted&&!e.allowRevote?'disabled':''}>
        <strong>${esc(nameOf(c))}</strong>
        ${summaryOf(c)?`<br><span>${esc(summaryOf(c))}</span>`:''}
      </label>
    </div>`).join('');
    const status = voted ? `<p class="form-saved">${esc(t('Your vote receipt: ','Ihre Stimmreferenz: '))}<code>${esc(voted.receipt)}</code></p>` : '';
    const button = voted && !e.allowRevote ? '' : `<button class="btn btn-primary" data-vote="${esc(e.id)}" type="button">${esc(voted?t('Replace vote','Stimme ersetzen'):t('Submit vote','Stimme abgeben'))}</button>`;
    return `<article class="sk-vote-card">
      <h2 class="h3">${esc(titleOf(e))}</h2>
      <p class="meta">${esc(e.startDate||'')} ${e.endDate?'– '+esc(e.endDate):''}</p>
      <p>${esc(descOf(e))}</p>
      ${status}
      <fieldset>
        <legend>${esc(t('Choose one candidate','Wählen Sie einen Kandidaten'))}</legend>
        ${candidates}
      </fieldset>
      ${button}
    </article>`;
  }
  function render(data){
    const box=document.querySelector('[data-vote-elections]');
    const settings=data.settings||{};
    if(settings.enabled!==true || settings.publicVotingPageEnabled===false){
      box.innerHTML=`<article class="sk-vote-card"><h2 class="h3">${esc(t('Online voting inactive','Online-Abstimmung inaktiv'))}</h2><p>${esc(lang()==='de'?(settings.inactiveMessage_de||'Die Online-Abstimmung ist derzeit nicht aktiv.'):(settings.inactiveMessage||'Online voting is currently not active.'))}</p></article>`;
      return;
    }
    if(!data.authenticated){
      box.innerHTML=`<article class="sk-vote-card"><h2 class="h3">${esc(t('Sign in required','Anmeldung erforderlich'))}</h2><p>${esc(t('You must sign in with a public account before voting.','Sie müssen sich vor der Abstimmung mit einem öffentlichen Konto anmelden.'))}</p><p><a class="btn btn-primary" href="/${lang()==='de'?'de':'en'}/account/">${esc(t('Go to account sign-in','Zur Kontoanmeldung'))}</a></p></article>`;
      return;
    }
    const elections=(data.elections||[]).filter(e=>String(e.status||'').toLowerCase()==='open');
    box.innerHTML=elections.length?elections.map(renderElection).join(''):`<p>${esc(t('No elections are open for voting.','Derzeit sind keine Wahlen zur Stimmabgabe geöffnet.'))}</p>`;
  }
  async function load(){
    const j=await api('/election-api/elections',{headers:token()?{Authorization:'Bearer '+token()}:{}})
    render(j);
  }
  async function submitVote(electionId){
    const chosen=document.querySelector('input[name="candidate-'+String(electionId).replace(/"/g,'\\"')+'"]:checked');
    if(!chosen){result(esc(t('Choose a candidate before submitting.','Wählen Sie vor dem Absenden einen Kandidaten.')),false);return;}
    if(!confirm(t('Submit this vote?','Diese Stimme abgeben?')))return;
    const j=await api('/election-api/vote',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token()},body:JSON.stringify({electionId,candidateId:chosen.value})});
    result(`<strong>${esc(t('Vote submitted.','Stimme abgegeben.'))}</strong> ${esc(t('Receipt','Referenz'))}: <code>${esc(j.receipt)}</code>`);
    await load();
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const box=document.querySelector('[data-vote-elections]');
    if(box)box.addEventListener('click',e=>{
      const b=e.target.closest('button[data-vote]'); if(!b)return;
      submitVote(b.dataset.vote).catch(err=>result(esc(err.message),false));
    });
    load().catch(err=>result(esc(err.message),false));
  });
})();
