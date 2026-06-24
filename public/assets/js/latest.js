
(function(){
  'use strict';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function published(x){return !x.publishStatus||x.publishStatus==='published'}
  function titleOf(x){return lang()==='de'?(x.title_de||x.name_de||x.title||x.name||''):(x.title||x.name||x.title_de||x.name_de||'')}
  function summaryOf(x){return lang()==='de'?(x.summary_de||x.description_de||x.summary||x.description||''):(x.summary||x.description||x.summary_de||x.description_de||'')}
  function urlOf(x,cat){
    if(lang()==='de'&&x.url_de)return x.url_de;
    if(x.url){ if(lang()==='de'&&x.url.startsWith('/en/'))return x.url.replace('/en/','/de/'); return x.url; }
    const l=lang();
    if(cat==='news'&&x.id)return`/${l}/news/#${encodeURIComponent(x.id)}`;
    if(cat==='legalDocuments'&&x.id==='basic-laws')return`/${l}/laws/basic-laws/`;
    const route={news:'news',incidentReports:'incident-reports',advisories:'advisories',gazette:'gazette',services:'services',transparency:'transparency',records:'records',legalDocuments:'laws',states:'states',departments:'departments',organizations:'departments',statusDashboard:'status',alerts:'alerts',campaigns:'campaigns',elections:'elections'}[cat]||'';
    return`/${l}/${route}/`;
  }
  const labels={news:['News','Nachrichten'],incidentReports:['Incident reports','Ereignisberichte'],advisories:['Advisories','Hinweise'],gazette:['Gazette','Amtsblatt'],services:['Services','Dienste'],transparency:['Transparency','Transparenz'],records:['Records','Aufzeichnungen'],legalDocuments:['Laws','Gesetze'],states:['States','Staaten'],departments:['Departments','Behörden'],organizations:['Organizations','Organisationen'],statusDashboard:['Status','Status'],alerts:['Emergency alerts','Notfallmeldungen'],campaigns:['Official campaigns','Offizielle Kampagnen'],elections:['Elections','Wahlen']};
  function label(cat){const l=labels[cat]||[cat,cat];return lang()==='de'?l[1]:l[0]}
  function render(data){
    const cats=Object.keys(labels);
    const rows=[];
    cats.forEach(cat=>(Array.isArray(data[cat])?data[cat]:[]).filter(published).forEach(x=>rows.push({cat,item:x,date:x.date||'',title:titleOf(x),summary:summaryOf(x),url:urlOf(x,cat)})));
    rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const box=document.querySelector('[data-latest-updates]');
    box.innerHTML=rows.length?rows.slice(0,100).map(r=>`<article class="dashboard-public-record">
      <h2 class="h4"><a href="${esc(r.url)}">${esc(r.title||r.url)}</a></h2>
      <p class="meta">${esc(label(r.cat))}${r.date?' | '+esc(r.date):''}</p>
      <p>${esc(r.summary)}</p>
    </article>`).join(''):`<p>${lang()==='de'?'Keine veröffentlichten Änderungen.':'No published updates.'}</p>`;
  }
  function init(){
    const box=document.querySelector('[data-latest-updates]');
    if(!box)return;
    fetch('/assets/data/site-data.json',{cache:'no-store'}).then(r=>r.json()).then(render).catch(e=>{box.innerHTML='<p>Latest updates could not be loaded.</p>'});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
