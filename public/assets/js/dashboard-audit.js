
(function(){
  'use strict';
  function lang(){return document.documentElement.lang === 'de' ? 'de' : 'en'}
  function t(en,de){return lang()==='de'?de:en}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function render(logs){
    const body=document.getElementById('audit-body');
    body.innerHTML=(logs||[]).map(l=>`<tr>
      <td>${esc(l.createdAt||'')}</td>
      <td>${esc(l.actor||'')}</td>
      <td>${esc(l.action||'')}</td>
      <td>${esc(l.target||'')}</td>
      <td>${esc(l.ip||'')}</td>
      <td><code>${esc(JSON.stringify(l.details||{}))}</code></td>
    </tr>`).join('') || `<tr><td colspan="6">${t('No audit records.','Keine Audit-Einträge.')}</td></tr>`;
  }
  function load(){
    fetch('/api/audit',{credentials:'same-origin',cache:'no-store'})
      .then(r=>r.text().then(text=>({ok:r.ok,status:r.status,text})))
      .then(r=>{
        if(!r.ok) throw new Error('HTTP '+r.status+': '+r.text.slice(0,200));
        render(JSON.parse(r.text).logs || []);
      })
      .catch(e=>{
        document.getElementById('audit-body').innerHTML=`<tr><td colspan="6">${esc(t('Could not load audit log: ','Audit-Protokoll konnte nicht geladen werden: ')+e.message)}</td></tr>`;
      });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=document.getElementById('reload-audit');
    if(btn) btn.addEventListener('click',load);
    load();
  });
})();
