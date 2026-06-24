
(function(){
  'use strict';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function titleOf(x){return lang()==='de'?(x.title_de||x.title||''):(x.title||x.title_de||'')}
  function summaryOf(x){return lang()==='de'?(x.summary_de||x.summary||''):(x.summary||x.summary_de||'')}
  function statusOf(x){return lang()==='de'?(x.status_de||x.status||''):(x.status||x.status_de||'')}
  function cls(x){const s=(x.severity||'normal').toLowerCase(); if(s==='outage'||s==='offline')return 'alert-danger'; if(s==='warning'||s==='degraded'||s==='delayed')return 'alert-warning'; return 'alert-success'}
  function render(items){
    const box=document.querySelector('[data-status-dashboard]');
    const visible=(Array.isArray(items)?items:[]).filter(x=>!x.publishStatus||x.publishStatus==='published');
    box.innerHTML=visible.length?visible.map(x=>`<article class="alert ${cls(x)}">
      <h2 class="h3">${esc(titleOf(x))}</h2>
      <p class="meta">${esc(statusOf(x))}${x.date?' | '+esc(x.date):''}</p>
      <p>${esc(summaryOf(x))}</p>
    </article>`).join(''):`<p>${lang()==='de'?'Keine Statusmeldungen veröffentlicht.':'No status records published.'}</p>`;
  }
  function init(){
    const box=document.querySelector('[data-status-dashboard]');
    if(!box)return;
    fetch('/assets/data/site-data.json',{cache:'no-store'})
      .then(r=>r.json()).then(data=>render(data.statusDashboard||[]))
      .catch(e=>{box.innerHTML='<p>Status data could not be loaded.</p>'});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
