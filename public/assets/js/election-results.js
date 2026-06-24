
(function(){
  'use strict';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function t(en,de){return lang()==='de'?de:en}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function titleOf(e){return lang()==='de'?(e.title_de||e.title||e.id):(e.title||e.title_de||e.id)}
  function nameOf(c){return lang()==='de'?(c.name_de||c.name||c.id):(c.name||c.name_de||c.id)}
  function row(c,count){return `<tr><td>${esc(nameOf(c))}</td><td>${esc(count||0)}</td></tr>`}
  function render(data){
    const box=document.querySelector('[data-election-results]');
    const settings=data.settings||{};
    if(settings.resultsPageEnabled===false){
      box.innerHTML=`<p>${esc(t('Election results page is not active.','Die Wahlergebnisseite ist nicht aktiv.'))}</p>`;
      return;
    }
    const elections=(data.elections||[]).filter(e=>e.resultsVisible);
    box.innerHTML=elections.length?elections.map(e=>`<article class="sk-vote-card">
      <h2 class="h3">${esc(titleOf(e))}</h2>
      <p class="meta">${esc(e.status||'')}</p>
      <table class="table table-striped"><thead><tr><th>${esc(t('Candidate','Kandidat'))}</th><th>${esc(t('Votes','Stimmen'))}</th></tr></thead><tbody>${(e.candidates||[]).map(c=>row(c,(e.results||{})[c.id])).join('')}</tbody></table>
    </article>`).join(''):`<p>${esc(t('No election results are currently published.','Derzeit sind keine Wahlergebnisse veröffentlicht.'))}</p>`;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    fetch('/election-api/elections',{cache:'no-store'}).then(r=>r.text()).then(text=>{ if(text.trim().startsWith('<')) throw new Error('Expected JSON but received HTML. Check Caddy /election-api proxy.'); return JSON.parse(text); }).then(render).catch(e=>{
      const box=document.querySelector('[data-election-results]');
      if(box)box.innerHTML='<p>Results could not be loaded.</p>';
    });
  });
})();
