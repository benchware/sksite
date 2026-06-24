
(function(){
  'use strict';
  function lang(){return document.documentElement.lang === 'de' ? 'de' : 'en'}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function published(x){return !x.publishStatus || x.publishStatus === 'published'}
  function titleOf(x){return lang()==='de' ? (x.title_de || x.name_de || x.title || x.name || '') : (x.title || x.name || x.title_de || x.name_de || '')}
  function summaryOf(x){return lang()==='de' ? (x.summary_de || x.description_de || x.summary || x.description || '') : (x.summary || x.description || x.summary_de || x.description_de || '')}
  function statusOf(x){return lang()==='de' ? (x.status_de || x.type_de || x.status || x.type || x.abbr || '') : (x.status || x.type || x.abbr || x.status_de || x.type_de || '')}
  function urlOf(x, cat){
    if(lang()==='de' && x.url_de) return x.url_de;
    if(x.url){
      if(lang()==='de' && x.url.startsWith('/en/')) return x.url.replace('/en/','/de/');
      return x.url;
    }
    const l=lang();
    if(cat==='news' && x.id) return `/${l}/news/#${encodeURIComponent(x.id)}`;
    if(cat==='legalDocuments' && x.id==='basic-laws') return `/${l}/laws/basic-laws/`;
    const categoryRoutes={
      incidentReports:'incident-reports', advisories:'advisories', gazette:'gazette',
      transparency:'transparency', records:'records', services:'services',
      departments:'departments', states:'states', organizations:'departments', alerts:'alerts', campaigns:'campaigns', elections:'elections',
      legalDocuments:'laws', news:'news'
    };
    return `/${l}/${categoryRoutes[cat] || ''}/`;
  }
  const labels={
    news:['News','Nachrichten'],
    incidentReports:['Incident reports','Ereignisberichte'],
    advisories:['Advisories','Hinweise'],
    gazette:['Gazette','Amtsblatt'],
    services:['Services','Dienste'],
    transparency:['Transparency','Transparenz'],
    records:['Records','Aufzeichnungen'],
    legalDocuments:['Laws','Gesetze'],
    states:['States','Staaten'],
    departments:['Departments','Behörden'],
    organizations:['Organizations','Organisationen'],
    alerts:['Emergency alerts','Notfallmeldungen'],
    campaigns:['Official campaigns','Offizielle Kampagnen'],
    elections:['Elections','Wahlen']
  };
  function catLabel(cat){const l=labels[cat]||[cat,cat]; return lang()==='de'?l[1]:l[0]}
  function collect(data){
    const cats=Object.keys(labels);
    const out=[];
    cats.forEach(cat=>{
      (Array.isArray(data[cat])?data[cat]:[]).filter(published).forEach(item=>{
        out.push({
          cat, item,
          title:titleOf(item),
          summary:summaryOf(item),
          status:statusOf(item),
          url:urlOf(item, cat),
          text:[catLabel(cat), titleOf(item), summaryOf(item), statusOf(item), item.hazardType||'', item.electionType||'', item.campaignType||'', item.sponsor||'', item.sponsor_de||'', item.disclosure||'', item.disclosure_de||'', item.message||'', item.message_de||'', item.instructions||'', item.instructions_de||'', item.linkTitle||'', item.linkTitle_de||'', item.attachmentTitle||'', item.attachmentTitle_de||'', item.date||'', item.id||''].join(' ').toLowerCase()
        });
      });
    });
    return out;
  }
  function render(results, q){
    const box=document.getElementById('search-results');
    const summary=document.getElementById('search-summary');
    if(!q){
      summary.textContent=lang()==='de'?'Geben Sie einen Suchbegriff ein.':'Enter a search term.';
      box.innerHTML='';
      return;
    }
    summary.textContent = lang()==='de' ? `${results.length} Ergebnis(se) für “${q}”` : `${results.length} result(s) for “${q}”`;
    box.innerHTML = results.length ? results.map(r=>`<article class="dashboard-public-record">
      <h3 class="h4"><a href="${esc(r.url)}">${esc(r.title || r.url)}</a></h3>
      <p class="meta">${esc(catLabel(r.cat))}${r.item.date ? ' | '+esc(r.item.date) : ''}${r.status ? ' | '+esc(r.status) : ''}</p>
      <p>${esc(r.summary)}</p>
    </article>`).join('') : `<p>${lang()==='de'?'Keine passenden Ergebnisse.':'No matching results.'}</p>`;
  }
  function init(){
    const form=document.getElementById('site-search-form');
    const qEl=document.getElementById('q');
    if(!form||!qEl) return;
    const params=new URLSearchParams(location.search);
    qEl.value=params.get('q')||'';
    let index=[];
    fetch('/assets/data/site-data.json',{cache:'no-store'})
      .then(r=>r.json())
      .then(data=>{
        index=collect(data);
        run();
      })
      .catch(e=>{
        document.getElementById('search-results').innerHTML='<p>Search data could not be loaded.</p>';
      });
    function run(){
      const q=qEl.value.trim().toLowerCase();
      const terms=q.split(/\s+/).filter(Boolean);
      const results=q ? index.filter(r=>terms.every(term=>r.text.includes(term))).slice(0,100) : [];
      render(results, qEl.value.trim());
    }
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const url = new URL(location.href);
      url.searchParams.set('q', qEl.value.trim());
      history.replaceState(null,'',url.pathname + '?' + url.searchParams.toString());
      run();
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
