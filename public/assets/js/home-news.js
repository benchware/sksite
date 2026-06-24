
(function(){
  'use strict';
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function lang(){return document.documentElement.lang === 'de' ? 'de' : 'en'}
  function titleOf(n){return lang()==='de' ? (n.title_de || n.title || '') : (n.title || n.title_de || '')}
  function summaryOf(n){return lang()==='de' ? (n.summary_de || n.summary || '') : (n.summary || n.summary_de || '')}
  function render(target, news){
    const isDe=lang()==='de';
    const latest=(Array.isArray(news)?news:[]).filter(n=>!n.publishStatus||n.publishStatus==='published').slice(0,3);
    target.innerHTML = latest.length ? latest.map(n=>`<article class="dashboard-public-record">
      <h3 class="h4"><a href="/${isDe?'de':'en'}/news/#${esc(n.id||'')}">${esc(titleOf(n))}</a></h3>
      <p class="meta">${esc(n.date||'')}</p>
      <p>${esc(summaryOf(n))}</p>
    </article>`).join('') : `<p>${isDe?'Keine Nachrichten veröffentlicht.':'No news published.'}</p>`;
  }
  function init(){
    const target=document.querySelector('[data-home-news]');
    if(!target) return;
    fetch('/assets/data/site-data.json',{cache:'no-store'})
      .then(r=>r.json())
      .then(data=>render(target,data.news||[]))
      .catch(()=>{target.innerHTML='<p>Unable to load news.</p>'});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
