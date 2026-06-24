
(function(){
  'use strict';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function safeHref(url){const u=String(url||'').trim(); if(!u)return''; if(u.startsWith('/')||/^https?:\/\//i.test(u))return u; return''}
  function active(c){
    const today=new Date().toISOString().slice(0,10);
    return (!c.publishStatus||c.publishStatus==='published') && String(c.status||'').toLowerCase()==='active' && (!c.startDate||c.startDate<=today) && (!c.endDate||c.endDate>=today);
  }
  function placement(){
    const p=location.pathname;
    if(p==='/'||p==='/en/'||p==='/de/')return'homepage';
    if(p.includes('/services/'))return'services';
    if(p.includes('/records/'))return'records';
    if(p.includes('/status/'))return'status';
    if(p.includes('/elections/'))return'elections';
    return'footer';
  }
  function text(c,k){return lang()==='de'?(c[k+'_de']||c[k]||''):(c[k]||c[k+'_de']||'')}
  function init(){
    if(location.pathname.indexOf('/dashboard/')===0)return;
    fetch('/assets/data/site-data.json',{cache:'no-store'}).then(r=>r.json()).then(data=>{
      const settings=data.campaignSettings||{};
      if(settings.enabled!==true)return;
      if(placement()==='homepage'&&settings.homepageEnabled===false)return;
      const place=placement();
      const list=(Array.isArray(data.campaigns)?data.campaigns:[]).filter(active).filter(c=>(c.placement||'homepage')===place||((c.placement||'')==='homepage'&&place==='homepage')).sort((a,b)=>Number(b.priority||0)-Number(a.priority||0));
      if(!list.length)return;
      const c=list[0], href=safeHref(c.linkUrl);
      const card=document.createElement('aside');
      card.className='sk-campaign-slot';
      card.setAttribute('aria-label',lang()==='de'?'Hervorgehobene öffentliche Mitteilung':'Promoted public notice');
      card.innerHTML=`<div class="container"><div class="sk-campaign-card">
        <div class="sk-campaign-label">${esc(lang()==='de'?(c.disclosure_de||c.disclosure||settings.label_de||'Hervorgehobene öffentliche Mitteilung'):(c.disclosure||c.disclosure_de||settings.label||'Promoted public notice'))}</div>
        <h2 class="h4">${esc(text(c,'title'))}</h2>
        <p>${esc(text(c,'summary'))}</p>
        ${href?`<p><a href="${esc(href)}">${esc(text(c,'linkTitle')||href)}</a></p>`:''}
      </div></div>`;
      const main=document.querySelector('main');
      if(main)main.parentNode.insertBefore(card, main.nextSibling);
    }).catch(()=>{});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
