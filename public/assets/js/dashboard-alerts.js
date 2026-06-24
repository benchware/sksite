
(function(){
  'use strict';
  let alerts=[];
  let settings={enabled:false,bannerEnabled:true,publicListEnabled:true,message:'Emergency Alert System is currently not active.',message_de:'Das Notfallmeldesystem ist derzeit nicht aktiv.'};

  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function t(en,de){return lang()==='de'?de:en}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function $(id){return document.getElementById(id)}
  function val(id){const e=$(id);return e?e.value.trim():''}
  function setVal(id,v){const e=$(id);if(e)e.value=v||''}
  function checked(id){const e=$(id);return !!(e&&e.checked)}
  function setChecked(id,v){const e=$(id);if(e)e.checked=!!v}
  function makeId(){return 'alert-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)}
  async function api(url,opts){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(opts||{})});
    const text=await r.text();
    if(!r.ok)throw new Error('HTTP '+r.status+': '+text.slice(0,200));
    try{return text?JSON.parse(text):{}}catch(e){throw new Error('Non-JSON: '+text.slice(0,120))}
  }
  function result(msg,ok=true){const el=$('alert-save-result'); if(el){el.className=ok?'form-saved':'form-error'; el.textContent=msg}}
  function titleOf(a){return lang()==='de'?(a.title_de||a.title||a.id):(a.title||a.title_de||a.id)}
  function messageOf(a){return lang()==='de'?(a.message_de||a.message||''):(a.message||a.message_de||'')}
  function renderSettings(){
    setChecked('eas-enabled',settings.enabled===true);
    setChecked('eas-banner-enabled',settings.bannerEnabled!==false);
    setChecked('eas-public-list-enabled',settings.publicListEnabled!==false);
    setVal('eas-message',settings.message||'Emergency Alert System is currently not active.');
    setVal('eas-message-de',settings.message_de||'Das Notfallmeldesystem ist derzeit nicht aktiv.');
  }
  function render(){
    const box=$('alerts-items');
    box.innerHTML=alerts.map(a=>`<article class="dashboard-record">
      <h2 class="h4">${esc(titleOf(a))} <span class="label label-info">${esc(a.severity||'advisory')}</span> <span class="label label-default">${esc(a.status||'draft')}</span></h2>
      <p class="meta">${esc(a.hazardType||'')} | ${esc(a.affectedArea||'')} | ${esc(a.date||'')}</p>
      <p>${esc(messageOf(a))}</p>
      <p>
        <button class="btn btn-default btn-xs" data-edit="${esc(a.id)}" type="button">${t('Edit','Bearbeiten')}</button>
        <button class="btn btn-primary btn-xs" data-status="active" data-id="${esc(a.id)}" type="button">${t('Activate','Aktivieren')}</button>
        <button class="btn btn-default btn-xs" data-status="resolved" data-id="${esc(a.id)}" type="button">${t('Resolve','Auflösen')}</button>
        <button class="btn btn-default btn-xs" data-status="expired" data-id="${esc(a.id)}" type="button">${t('Expire','Ablaufen lassen')}</button>
      </p>
    </article>`).join('') || `<p>${t('No alerts.','Keine Meldungen.')}</p>`;
  }
  function edit(id){
    const a=alerts.find(x=>x.id===id)||{};
    setVal('alert-id',a.id||'');
    setVal('hazardType',a.hazardType||'earthquake');
    setVal('severity',a.severity||'advisory');
    setVal('status',a.status||'draft');
    setVal('title',a.title||'');
    setVal('title_de',a.title_de||'');
    setVal('affectedArea',a.affectedArea||'');
    setVal('affectedArea_de',a.affectedArea_de||'');
    setVal('date',a.date||new Date().toISOString().slice(0,10));
    setVal('startTime',a.startTime||'');
    setVal('endTime',a.endTime||'');
    setVal('message',a.message||'');
    setVal('message_de',a.message_de||'');
    setVal('instructions',a.instructions||'');
    setVal('instructions_de',a.instructions_de||'');
    setVal('linkTitle',a.linkTitle||'');
    setVal('linkTitle_de',a.linkTitle_de||'');
    setVal('linkUrl',a.linkUrl||'');
    setVal('attachmentTitle',a.attachmentTitle||'');
    setVal('attachmentTitle_de',a.attachmentTitle_de||'');
    setVal('attachmentUrl',a.attachmentUrl||'');
  }
  function build(){
    const status=val('status')||'draft';
    return {
      id: val('alert-id') || makeId(),
      hazardType: val('hazardType') || 'general',
      severity: val('severity') || 'advisory',
      status,
      publishStatus: status === 'draft' ? 'draft' : 'published',
      title: val('title'),
      title_de: val('title_de') || val('title'),
      affectedArea: val('affectedArea'),
      affectedArea_de: val('affectedArea_de') || val('affectedArea'),
      date: val('date') || new Date().toISOString().slice(0,10),
      startTime: val('startTime'),
      endTime: val('endTime'),
      message: val('message'),
      message_de: val('message_de') || val('message'),
      instructions: val('instructions'),
      instructions_de: val('instructions_de') || val('instructions'),
      linkTitle: val('linkTitle'),
      linkTitle_de: val('linkTitle_de') || val('linkTitle'),
      linkUrl: val('linkUrl'),
      attachmentTitle: val('attachmentTitle'),
      attachmentTitle_de: val('attachmentTitle_de') || val('attachmentTitle'),
      attachmentUrl: val('attachmentUrl')
    };
  }
  async function load(){
    try{
      const j=await api('/api/alerts');
      alerts=j.alerts||[];
      settings=j.settings||settings;
      renderSettings();
      render();
      result(settings.enabled ? t('Loaded. Emergency Alert System is enabled.','Geladen. Notfallmeldesystem ist aktiviert.') : t('Loaded. Emergency Alert System is disabled by default.','Geladen. Notfallmeldesystem ist standardmäßig deaktiviert.'));
    }catch(e){result(t('Could not load alerts: ','Meldungen konnten nicht geladen werden: ')+e.message,false)}
  }
  async function saveSettings(){
    const body={
      enabled:checked('eas-enabled'),
      bannerEnabled:checked('eas-banner-enabled'),
      publicListEnabled:checked('eas-public-list-enabled'),
      message:val('eas-message'),
      message_de:val('eas-message-de')
    };
    const j=await api('/api/alerts/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    settings=j.settings||body;
    renderSettings();
    result(settings.enabled ? t('EAS settings saved. Emergency Alert System is enabled.','EAS-Einstellungen gespeichert. Notfallmeldesystem ist aktiviert.') : t('Emergency Alert System settings saved. Emergency Alert System is disabled.','Einstellungen des Notfallmeldesystems gespeichert. Notfallmeldesystem ist deaktiviert.'));
  }
  async function save(){
    const item=build();
    const j=await api('/api/alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
    const idx=alerts.findIndex(a=>a.id===j.alert.id);
    if(idx>=0)alerts[idx]=j.alert; else alerts.push(j.alert);
    render(); edit(''); result(t('Alert saved.','Meldung gespeichert.'));
  }
  async function setStatus(id,status){
    const j=await api('/api/alerts/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});
    const idx=alerts.findIndex(a=>a.id===id);
    if(idx>=0)alerts[idx]=j.alert;
    render(); result(t('Alert status updated.','Meldungsstatus aktualisiert.'));
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('alerts-items').addEventListener('click',e=>{
      const b=e.target.closest('button'); if(!b)return;
      if(b.dataset.edit!==undefined)edit(b.dataset.edit);
      if(b.dataset.status!==undefined)setStatus(b.dataset.id,b.dataset.status).catch(err=>result(err.message,false));
    });
    $('eas-settings-form').addEventListener('submit',e=>{e.preventDefault();saveSettings().catch(err=>result(err.message,false))});
    $('alert-new').addEventListener('click',()=>edit(''));
    $('alert-form').addEventListener('submit',e=>{e.preventDefault(); save().catch(err=>result(err.message,false))});
    edit(''); load();
  });
})();
