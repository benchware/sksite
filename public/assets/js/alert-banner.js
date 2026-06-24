
(function(){
  'use strict';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function titleOf(a){return lang()==='de'?(a.title_de||a.title||''):(a.title||a.title_de||'')}
  function messageOf(a){return lang()==='de'?(a.message_de||a.message||''):(a.message||a.message_de||'')}
  function priority(a){const s=String(a.severity||'').toLowerCase(); return {critical:4,emergency:3,watch:2,advisory:1}[s]||0}
  function active(a){
    if(a.publishStatus && a.publishStatus!=='published')return false;
    if(String(a.status||'').toLowerCase()!=='active')return false;
    if(a.endTime && Date.parse(a.endTime) && Date.parse(a.endTime)<Date.now())return false;
    return true;
  }
  function init(){
    if(location.pathname.indexOf('/dashboard/')===0)return;
    fetch('/assets/data/site-data.json',{cache:'no-store'}).then(r=>r.json()).then(data=>{
      const settings=data.alertSettings||{};
      if(settings.enabled !== true || settings.bannerEnabled === false) return;
      const alerts=(Array.isArray(data.alerts)?data.alerts:[]).filter(active).sort((a,b)=>priority(b)-priority(a));
      if(!alerts.length)return;
      const a=alerts[0];
      const div=document.createElement('section');
      div.className='sk-emergency-banner';
      div.setAttribute('role','alert');
      div.setAttribute('aria-label',lang()==='de'?'Notfallmeldung':'Emergency alert');
      div.innerHTML=`<div class="container sk-emergency-banner-inner">
        <div class="sk-emergency-banner-label">${esc(lang()==='de'?'Notfallmeldung':'Emergency alert')}</div>
        <div class="sk-emergency-banner-copy">
          <strong>${esc(titleOf(a))}</strong>
          <span>${esc(messageOf(a))}</span>
        </div>
        <div class="sk-emergency-banner-action">
          <a href="/${lang()==='de'?'de':'en'}/alerts/">${esc(lang()==='de'?'Details':'Details')}</a>
        </div>
      </div>`;
      const main=document.querySelector('main');
      if(main)main.parentNode.insertBefore(div,main); else document.body.insertBefore(div,document.body.firstChild);
    }).catch(()=>{});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
