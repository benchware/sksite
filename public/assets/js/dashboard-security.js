
(function(){
  'use strict';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function t(en,de){return lang()==='de'?de:en}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function row(k,v){return `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`}
  function render(j){
    document.getElementById('security-result').className='form-saved';
    document.getElementById('security-result').textContent=t('Security status loaded.','Sicherheitsstatus geladen.');
    const labels=[
      ['Database mode','Datenbankmodus','dbMode'],
      ['SQLite database','SQLite-Datenbank','sqliteDatabase'],
      ['Public registration enabled','Öffentliche Registrierung aktiv','publicRegistration'],
      ['Password hashing','Passwort-Hashing','passwordHashing'],
      ['Audit log enabled','Audit-Protokoll aktiv','auditLog'],
      ['Content versioning enabled','Inhaltsversionierung aktiv','contentVersioning'],
      ['Request status workflow enabled','Anfrage-Statusworkflow aktiv','requestStatusWorkflow'],
      ['API protected by Caddy','API durch Caddy geschützt','caddyProtectedApi'],
      ['Dashboard protected by Caddy','Dashboard durch Caddy geschützt','caddyProtectedDashboard']
    ];
    document.getElementById('security-body').innerHTML=labels.map(x=>row(lang()==='de'?x[1]:x[0], j[x[2]])).join('');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    fetch('/api/security/status',{credentials:'same-origin',cache:'no-store'})
      .then(r=>r.json())
      .then(render)
      .catch(e=>{
        document.getElementById('security-result').className='form-error';
        document.getElementById('security-result').textContent=t('Security status could not be loaded: ','Sicherheitsstatus konnte nicht geladen werden: ')+e.message;
      });
  });
})();
