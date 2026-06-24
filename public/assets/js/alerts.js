
(function(){
  'use strict';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function safeHref(url){const u=String(url||'').trim(); if(!u)return''; if(u.startsWith('/')||/^https?:\/\//i.test(u))return u; return''}
  function titleOf(a){return lang()==='de'?(a.title_de||a.title||''):(a.title||a.title_de||'')}
  function messageOf(a){return lang()==='de'?(a.message_de||a.message||''):(a.message||a.message_de||'')}
  function instructionsOf(a){return lang()==='de'?(a.instructions_de||a.instructions||''):(a.instructions||a.instructions_de||'')}
  function areaOf(a){return lang()==='de'?(a.affectedArea_de||a.affectedArea||''):(a.affectedArea||a.affectedArea_de||'')}
  function levelLabel(a){
    const s=String(a.severity||'advisory').toLowerCase();
    const map={advisory:['Advisory','Hinweis'],watch:['Watch','Warnbereitschaft'],emergency:['Emergency','Notfall'],critical:['Critical','Kritisch'],resolved:['All clear','Entwarnung']};
    const x=map[s]||[s,s];
    return lang()==='de'?x[1]:x[0];
  }
  function cardClass(a){
    const s=String(a.severity||'advisory').toLowerCase();
    if(s==='critical')return'sk-alert-card sk-alert-critical';
    if(s==='emergency')return'sk-alert-card sk-alert-emergency';
    if(s==='watch')return'sk-alert-card sk-alert-watch';
    if(s==='resolved')return'sk-alert-card sk-alert-resolved';
    return'sk-alert-card sk-alert-advisory';
  }
  function active(a){
    if(a.publishStatus && a.publishStatus!=='published')return false;
    if(String(a.status||'').toLowerCase()==='draft')return false;
    if(a.endTime && Date.parse(a.endTime) && Date.parse(a.endTime)<Date.now() && String(a.status||'').toLowerCase()==='active')return false;
    return true;
  }
  function render(data){
    const box=document.querySelector('[data-alerts-list]');
    const settings=data.alertSettings||{};
    if(settings.enabled !== true || settings.publicListEnabled === false){
      box.innerHTML=`<article class="sk-alert-card sk-alert-resolved">
        <h2 class="h3"><span class="sk-alert-level">${esc(lang()==='de'?'Inaktiv':'Inactive')}</span>${esc(lang()==='de'?'Notfallmeldesystem':'Emergency Alert System')}</h2>
        <p>${esc(lang()==='de'?(settings.message_de||'Das Notfallmeldesystem ist derzeit nicht aktiv.'):(settings.message||'Emergency Alert System is currently not active.'))}</p>
      </article>`;
      return;
    }
    const alerts=(Array.isArray(data.alerts)?data.alerts:[]).filter(active).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    box.innerHTML=alerts.length?alerts.map(a=>{
      const link=safeHref(a.linkUrl), attach=safeHref(a.attachmentUrl);
      const meta=[a.hazardType||'',areaOf(a)||'',a.date||''].filter(Boolean).join(' | ');
      return `<article class="${cardClass(a)}">
        <h2 class="h3"><span class="sk-alert-level">${esc(levelLabel(a))}</span>${esc(titleOf(a))}</h2>
        <p class="meta">${esc(meta)}</p>
        <p>${esc(messageOf(a))}</p>
        <p><strong>${lang()==='de'?'Anweisungen':'Instructions'}:</strong> ${esc(instructionsOf(a))}</p>
        <div class="sk-alert-actions">
          ${link?`<a href="${esc(link)}">${esc(lang()==='de'?(a.linkTitle_de||a.linkTitle||link):(a.linkTitle||link))}</a>`:''}
          ${attach?`<a href="${esc(attach)}">${esc(lang()==='de'?(a.attachmentTitle_de||a.attachmentTitle||attach):(a.attachmentTitle||attach))}</a>`:''}
        </div>
      </article>`;
    }).join(''):`<p>${lang()==='de'?'Keine aktiven Notfallmeldungen.':'No active emergency alerts.'}</p>`;
  }
  function init(){
    const box=document.querySelector('[data-alerts-list]');
    if(!box)return;
    fetch('/assets/data/site-data.json',{cache:'no-store'}).then(r=>r.json()).then(render).catch(e=>{box.innerHTML='<p>Alerts could not be loaded.</p>'});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
