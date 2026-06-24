
(function(){
  'use strict';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function t(en,de){return lang()==='de'?de:en}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  async function api(url,opts){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(opts||{})});
    const text=await r.text();
    if(!r.ok)throw new Error('HTTP '+r.status+': '+text.slice(0,200));
    try{return text?JSON.parse(text):{}}catch(e){throw new Error('Non-JSON: '+text.slice(0,120))}
  }
  function result(msg,ok=true){const el=document.getElementById('backup-result');el.className=ok?'form-saved':'form-error';el.textContent=msg}
  function render(rows){
    const body=document.getElementById('backup-body');
    body.innerHTML=(rows||[]).map(v=>`<tr>
      <td>${esc(v.id)}</td><td>${esc(v.createdAt)}</td><td>${esc(v.label||'')}</td><td>${esc(v.bytes||'')}</td>
      <td><button class="btn btn-default btn-xs" data-restore="${esc(v.id)}" type="button">${t('Restore','Wiederherstellen')}</button></td>
    </tr>`).join('')||`<tr><td colspan="5">${t('No backup versions yet.','Noch keine Backup-Versionen.')}</td></tr>`;
  }
  async function load(){try{const j=await api('/api/backups');render(j.versions||[]);result(t('Loaded.','Geladen.'))}catch(e){result(t('Could not load backups: ','Backups konnten nicht geladen werden: ')+e.message,false)}}
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('create-backup').addEventListener('click',()=>api('/api/backups/create',{method:'POST'}).then(()=>{result(t('Backup created.','Backup erstellt.'));load()}).catch(e=>result(e.message,false)));
    document.getElementById('backup-body').addEventListener('click',e=>{
      const b=e.target.closest('button'); if(!b||b.dataset.restore===undefined)return;
      if(!confirm(t('Restore this content version? Current content will be backed up first.','Diese Inhaltsversion wiederherstellen? Der aktuelle Inhalt wird vorher gesichert.')))return;
      api('/api/backups/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:b.dataset.restore})}).then(()=>{result(t('Restored.','Wiederhergestellt.'));load()}).catch(e=>result(e.message,false));
    });
    load();
  });
})();
