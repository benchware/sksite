
(function(){
  'use strict';
  function lang(){return document.documentElement.lang === 'de' ? 'de' : 'en'}
  function t(en,de){return lang()==='de'?de:en}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  const categories = ['news','incidentReports','advisories','gazette','services','transparency','records','legalDocuments','states','departments','organizations'];
  const labels = {
    news:['News','Nachrichten'], incidentReports:['Incident reports','Ereignisberichte'],
    advisories:['Advisories','Hinweise'], gazette:['Gazette','Amtsblatt'],
    services:['Services','Dienste'], transparency:['Transparency','Transparenz'],
    records:['Records','Aufzeichnungen'], legalDocuments:['Legal documents','Rechtsdokumente'],
    states:['States','Staaten'], departments:['Departments','Behörden'], organizations:['Organizations','Organisationen']
  };
  function catLabel(c){const l=labels[c]||[c,c]; return lang()==='de'?l[1]:l[0]}
  function titleOf(x){return x.title || x.name || x.title_de || x.name_de || x.id || '(untitled)'}
  function missingFields(cat, item){
    const out=[];
    if(['states','departments','organizations'].includes(cat)){
      if(!item.name_de) out.push('name_de');
    } else {
      if(!item.title_de) out.push('title_de');
    }
    if(!item.summary_de && (item.summary || item.description)) out.push('summary_de');
    if((item.status || item.type) && !item.status_de && !item.type_de) out.push(cat==='organizations'?'type_de':'status_de');
    if(item.url && item.url.startsWith('/en/') && !item.url_de) out.push('url_de');
    return out;
  }
  function render(data){
    const rows=[];
    categories.forEach(cat=>{
      (Array.isArray(data[cat])?data[cat]:[]).forEach(item=>{
        const missing=missingFields(cat,item);
        if(missing.length){
          rows.push({cat,item,missing});
        }
      });
    });
    const summary=document.getElementById('translation-summary');
    const box=document.getElementById('translation-results');
    summary.className=rows.length?'form-error':'form-saved';
    summary.textContent=rows.length
      ? t(`${rows.length} record(s) need German fields.`, `${rows.length} Eintrag/Einträge benötigen deutsche Felder.`)
      : t('All records have basic German fields.', 'Alle Einträge haben grundlegende deutsche Felder.');
    box.innerHTML=rows.length ? rows.map(r=>`<article class="dashboard-public-record">
      <h2 class="h4">${esc(titleOf(r.item))}</h2>
      <p class="meta">${esc(catLabel(r.cat))} | ${esc(r.item.publishStatus || 'published')} | ${esc(r.item.date || '')}</p>
      <p><strong>${t('Missing','Fehlt')}:</strong> ${esc(r.missing.join(', '))}</p>
    </article>`).join('') : '';
  }
  function load(){
    fetch('/api/content',{credentials:'same-origin',cache:'no-store'})
      .then(r=>r.text().then(text=>({ok:r.ok,status:r.status,text})))
      .then(r=>{
        if(!r.ok) throw new Error('HTTP '+r.status+': '+r.text.slice(0,200));
        render(JSON.parse(r.text));
      })
      .catch(e=>{
        document.getElementById('translation-summary').className='form-error';
        document.getElementById('translation-summary').textContent=t('Could not load content: ','Inhalt konnte nicht geladen werden: ')+e.message;
      });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.getElementById('reload-check');
    if(btn) btn.addEventListener('click',load);
    load();
  });
})();
