
(function(){
  'use strict';
  let elections=[];
  let settings={
    enabled:false, publicVotingPageEnabled:true, resultsPageEnabled:true,
    inactiveMessage:'Online voting is currently not active.',
    inactiveMessage_de:'Die Online-Abstimmung ist derzeit nicht aktiv.',
    receiptPrefix:'VOTE'
  };

  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function t(en,de){return lang()==='de'?de:en}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function $(id){return document.getElementById(id)}
  function val(id){const e=$(id);return e?e.value.trim():''}
  function setVal(id,v){const e=$(id);if(e)e.value=v||''}
  function checked(id){const e=$(id);return !!(e&&e.checked)}
  function setChecked(id,v){const e=$(id);if(e)e.checked=!!v}
  function makeId(){return 'election-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)}
  function slug(s){return String(s||'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'')||('candidate-'+Math.random().toString(36).slice(2,6))}
  async function api(url,opts){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(opts||{})});
    const text=await r.text();
    if(!r.ok)throw new Error('HTTP '+r.status+': '+text.slice(0,200));
    try{return text?JSON.parse(text):{}}catch(e){throw new Error('Non-JSON: '+text.slice(0,120))}
  }
  function result(msg,ok=true){const el=$('election-save-result'); if(el){el.className=ok?'form-saved':'form-error'; el.innerHTML=msg}}
  function titleOf(e){return lang()==='de'?(e.title_de||e.title||e.id):(e.title||e.title_de||e.id)}
  function descOf(e){return lang()==='de'?(e.description_de||e.description||''):(e.description||e.description_de||'')}
  function badge(status){status=String(status||'draft'); const cls=status==='open'?'label-success':status==='closed'?'label-warning':status==='certified'?'label-primary':'label-default'; return `<span class="label ${cls}">${esc(status)}</span>`}
  function renderSettings(){
    setChecked('voting-enabled',settings.enabled===true);
    setChecked('voting-public-page-enabled',settings.publicVotingPageEnabled!==false);
    setChecked('voting-results-page-enabled',settings.resultsPageEnabled!==false);
    setVal('voting-inactive',settings.inactiveMessage||'Online voting is currently not active.');
    setVal('voting-inactive-de',settings.inactiveMessage_de||'Die Online-Abstimmung ist derzeit nicht aktiv.');
    setVal('receipt-prefix',settings.receiptPrefix||'VOTE');
  }
  function resultsTable(e){
    const results=e.results||{};
    return `<table class="table table-condensed"><thead><tr><th>${esc(t('Candidate','Kandidat'))}</th><th>${esc(t('Votes','Stimmen'))}</th></tr></thead><tbody>${(e.candidates||[]).map(c=>`<tr><td>${esc(c.name||c.id)}</td><td>${esc(results[c.id]||0)}</td></tr>`).join('')}</tbody></table>`;
  }
  function actionButton(e){
    const st=String(e.status||'draft');
    if(st==='draft') return `<button class="btn btn-primary btn-xs" data-status="open" data-id="${esc(e.id)}" type="button">${t('Open voting','Abstimmung öffnen')}</button>`;
    if(st==='open') return `<button class="btn btn-warning btn-xs" data-status="closed" data-id="${esc(e.id)}" type="button">${t('Close voting','Abstimmung schließen')}</button>`;
    if(st==='closed') return `<button class="btn btn-primary btn-xs" data-status="certified" data-id="${esc(e.id)}" type="button">${t('Certify results','Ergebnisse zertifizieren')}</button>`;
    return `<button class="btn btn-default btn-xs" data-status="open" data-id="${esc(e.id)}" type="button">${t('Reopen voting','Abstimmung erneut öffnen')}</button>`;
  }
  function visibilityNote(e){
    if(e.status==='open'&&settings.enabled!==true){
      return `<p class="form-error">${esc(t('Voting is open for this election, but the voting system is disabled. Enable online voting above to allow public ballots.','Die Abstimmung für diese Wahl ist geöffnet, aber das Abstimmungssystem ist deaktiviert. Aktivieren Sie oben die Online-Abstimmung, um öffentliche Stimmzettel zu erlauben.'))}</p>`;
    }
    if(e.status==='open') return `<p class="form-saved">${esc(t('Voting is open. Eligible signed-in accounts may submit one ballot.','Die Abstimmung ist geöffnet. Berechtigte angemeldete Konten können einen Stimmzettel abgeben.'))}</p>`;
    return '';
  }
  function render(){
    const box=$('election-items');
    box.innerHTML=elections.map(e=>`<article class="dashboard-record">
      <h2 class="h4">${esc(titleOf(e))} ${badge(e.status)}</h2>
      <p class="meta">${esc(e.electionType||'')} | ${esc(e.startDate||'')} ${e.endDate?'– '+esc(e.endDate):''} | ${esc(t('votes','Stimmen'))}: ${esc(e.voteCount||0)}</p>
      <p>${esc(descOf(e))}</p>
      ${visibilityNote(e)}
      ${resultsTable(e)}
      <p>
        <button class="btn btn-default btn-xs" data-edit="${esc(e.id)}" type="button">${t('Edit','Bearbeiten')}</button>
        ${actionButton(e)}
        <button class="btn btn-default btn-xs" data-status="draft" data-id="${esc(e.id)}" type="button">${t('Set draft','Als Entwurf setzen')}</button>
      </p>
    </article>`).join('')||`<p>${t('No elections.','Keine Wahlen.')}</p>`;
  }
  function edit(id){
    const e=elections.find(x=>x.id===id)||{};
    setVal('election-id',e.id||'');
    setVal('electionType',e.electionType||'presidential');
    setVal('status',e.status||'draft');
    setVal('title',e.title||'');
    setVal('title_de',e.title_de||'');
    setVal('description',e.description||'');
    setVal('description_de',e.description_de||'');
    setVal('startDate',e.startDate||'');
    setVal('endDate',e.endDate||'');
    setChecked('allowRevote',!!e.allowRevote);
    setChecked('showLiveResults',!!e.showLiveResults);
    setChecked('publishFinalResults',!!e.publishFinalResults);
    setVal('candidatesText',(e.candidates||[]).map(c=>c.name||c.id).join('\n')||'heydan9836\nAnNormalFractal\nChara\nDosj');
  }
  function build(){
    const status=val('status')||'draft';
    const candidates=val('candidatesText').split(/\n+/).map(x=>x.trim()).filter(Boolean).map(name=>({id:slug(name),name,name_de:name,summary:'Registered candidate.',summary_de:'Registrierter Kandidat.'}));
    return {
      id:val('election-id')||makeId(),
      electionType:val('electionType')||'general',
      status,
      publishStatus:status==='draft'?'draft':'published',
      title:val('title'),
      title_de:val('title_de')||val('title'),
      description:val('description'),
      description_de:val('description_de')||val('description'),
      startDate:val('startDate'),
      endDate:val('endDate'),
      allowRevote:checked('allowRevote'),
      showLiveResults:checked('showLiveResults'),
      publishFinalResults:checked('publishFinalResults')||status==='certified',
      candidates
    };
  }
  async function load(){
    try{
      const j=await api('/api/elections');
      elections=j.elections||[];
      settings=j.settings||settings;
      renderSettings();
      render();
      result(settings.enabled ? esc(t('Loaded. Online voting is enabled.','Geladen. Online-Abstimmung ist aktiviert.')) : esc(t('Loaded. Online voting is disabled by default.','Geladen. Online-Abstimmung ist standardmäßig deaktiviert.')));
    }catch(e){result(esc(t('Could not load elections: ','Wahlen konnten nicht geladen werden: ')+e.message),false)}
  }
  async function saveSettings(){
    const body={
      enabled:checked('voting-enabled'),
      publicVotingPageEnabled:checked('voting-public-page-enabled'),
      resultsPageEnabled:checked('voting-results-page-enabled'),
      inactiveMessage:val('voting-inactive'),
      inactiveMessage_de:val('voting-inactive-de'),
      receiptPrefix:val('receipt-prefix')||'VOTE'
    };
    const j=await api('/api/elections/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    settings=j.settings||body;
    renderSettings(); render();
    result(settings.enabled ? esc(t('Voting settings saved. Online voting is enabled.','Abstimmungseinstellungen gespeichert. Online-Abstimmung ist aktiviert.')) : esc(t('Voting settings saved. Online voting is disabled.','Abstimmungseinstellungen gespeichert. Online-Abstimmung ist deaktiviert.')));
  }
  async function save(){
    const item=build();
    const j=await api('/api/elections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
    const idx=elections.findIndex(e=>e.id===j.election.id);
    if(idx>=0)elections[idx]=j.election; else elections.push(j.election);
    await load();
    edit('');
    result(esc(t('Election saved.','Wahl gespeichert.')));
  }
  async function setStatus(id,status){
    const j=await api('/api/elections/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});
    const idx=elections.findIndex(e=>e.id===id);
    if(idx>=0)elections[idx]=j.election;
    await load();
    if(status==='open'){
      result(settings.enabled ? esc(t('Voting opened. Signed-in accounts can vote.','Abstimmung geöffnet. Angemeldete Konten können abstimmen.')) : esc(t('Voting opened, but the voting system is disabled. Enable online voting above to allow ballots.','Abstimmung geöffnet, aber das Abstimmungssystem ist deaktiviert. Aktivieren Sie oben die Online-Abstimmung, um Stimmzettel zu erlauben.')));
    }else if(status==='closed'){
      result(esc(t('Voting closed. New ballots are blocked. Results can now be reviewed.','Abstimmung geschlossen. Neue Stimmzettel sind gesperrt. Ergebnisse können nun geprüft werden.')));
    }else if(status==='certified'){
      result(esc(t('Results certified and published.','Ergebnisse zertifiziert und veröffentlicht.')));
    }else{
      result(esc(t('Election set to draft.','Wahl als Entwurf gesetzt.')));
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('election-items').addEventListener('click',e=>{
      const b=e.target.closest('button'); if(!b)return;
      if(b.dataset.edit!==undefined)edit(b.dataset.edit);
      if(b.dataset.status!==undefined)setStatus(b.dataset.id,b.dataset.status).catch(err=>result(esc(err.message),false));
    });
    $('voting-settings-form').addEventListener('submit',e=>{e.preventDefault();saveSettings().catch(err=>result(esc(err.message),false))});
    $('election-new').addEventListener('click',()=>edit(''));
    $('election-form').addEventListener('submit',e=>{e.preventDefault();save().catch(err=>result(esc(err.message),false))});
    edit(''); load();
  });
})();
