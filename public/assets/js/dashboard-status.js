
(function(){
  'use strict';
  let data={};
  let currentId='';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function t(en,de){return lang()==='de'?de:en}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function $(id){return document.getElementById(id)}
  function val(id){const e=$(id);return e?e.value.trim():''}
  function setVal(id,v){const e=$(id);if(e)e.value=v||''}
  function makeId(){return 'status-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)}
  async function api(url,opts){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(opts||{})});
    const text=await r.text();
    if(!r.ok)throw new Error('HTTP '+r.status+': '+text.slice(0,200));
    try{return text?JSON.parse(text):{}}catch(e){throw new Error('Non-JSON: '+text.slice(0,120))}
  }
  function result(msg,ok=true){const el=$('status-save-result'); if(el){el.className=ok?'form-saved':'form-error';el.textContent=msg}}
  function items(){if(!Array.isArray(data.statusDashboard))data.statusDashboard=[];return data.statusDashboard}
  function render(){
    const box=$('status-items');
    box.innerHTML=items().map(x=>`<article class="dashboard-record">
      <h2 class="h4">${esc(x.title||x.title_de||x.id)} <span class="label label-info">${esc(x.severity||'normal')}</span></h2>
      <p class="meta">${esc(x.status||'')} | ${esc(x.date||'')}</p>
      <p>${esc(x.summary||'')}</p>
      <p><button class="btn btn-default btn-xs" data-edit="${esc(x.id)}" type="button">${t('Edit','Bearbeiten')}</button>
      <button class="btn btn-link btn-xs btn-link-danger" data-delete="${esc(x.id)}" type="button">${t('Delete','Löschen')}</button></p>
    </article>`).join('');
  }
  function edit(id){
    const x=items().find(a=>a.id===id)||{};
    currentId=x.id||'';
    setVal('status-id',currentId);
    setVal('status-title',x.title||'');
    setVal('status-title-de',x.title_de||'');
    setVal('status-value',x.status||'');
    setVal('status-value-de',x.status_de||'');
    setVal('status-severity',x.severity||'normal');
    setVal('status-date',x.date||new Date().toISOString().slice(0,10));
    setVal('status-summary',x.summary||'');
    setVal('status-summary-de',x.summary_de||'');
  }
  async function save(){
    const id=val('status-id')||makeId();
    const item={
      id,
      title:val('status-title'),
      title_de:val('status-title-de')||val('status-title'),
      status:val('status-value'),
      status_de:val('status-value-de')||val('status-value'),
      severity:val('status-severity')||'normal',
      date:val('status-date')||new Date().toISOString().slice(0,10),
      summary:val('status-summary'),
      summary_de:val('status-summary-de')||val('status-summary'),
      publishStatus:'published'
    };
    const idx=items().findIndex(x=>x.id===id);
    if(idx>=0)items()[idx]=item; else items().push(item);
    await api('/api/content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    result(t('Status saved.','Status gespeichert.'));
    edit('');
    render();
  }
  async function load(){
    try{data=await api('/api/content'); if(!Array.isArray(data.statusDashboard))data.statusDashboard=[]; render(); result(t('Loaded.','Geladen.'))}
    catch(e){result(t('Could not load status data: ','Statusdaten konnten nicht geladen werden: ')+e.message,false)}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('status-items').addEventListener('click',e=>{
      const b=e.target.closest('button'); if(!b)return;
      if(b.dataset.edit!==undefined)edit(b.dataset.edit);
      if(b.dataset.delete!==undefined && confirm(t('Delete status item?','Status-Eintrag löschen?'))){
        data.statusDashboard=items().filter(x=>x.id!==b.dataset.delete);
        api('/api/content',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(()=>{render();result(t('Deleted.','Gelöscht.'))}).catch(e=>result(e.message,false));
      }
    });
    $('status-new').addEventListener('click',()=>edit(''));
    $('status-form').addEventListener('submit',e=>{e.preventDefault();save().catch(err=>result(err.message,false))});
    edit('');
    load();
  });
})();
