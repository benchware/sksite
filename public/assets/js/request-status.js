
(function(){
  'use strict';

  function lang(){ return document.documentElement.lang === 'de' ? 'de' : 'en'; }
  function t(en,de){ return lang() === 'de' ? de : en; }
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

  function params(){
    const p = new URLSearchParams(location.search);
    return {reference:p.get('reference') || p.get('caseNumber') || '', email:p.get('email') || ''};
  }

  function renderRequest(r){
    const note = r.decisionNote ? esc(r.decisionNote) : esc(t('No decision note has been posted yet.','Es wurde noch keine Entscheidungsnotiz veröffentlicht.'));
    return `
      <section class="panel panel-default request-status-card">
        <header class="panel-heading"><h2 class="panel-title">${esc(t('Request status','Anfragestatus'))}</h2></header>
        <div class="panel-body">
          <dl class="dl-horizontal">
            <dt>${esc(t('Reference','Referenz'))}</dt><dd><code>${esc(r.reference)}</code></dd>
            <dt>${esc(t('Type','Typ'))}</dt><dd>${esc(r.requestLabel || r.requestType)}</dd>
            <dt>${esc(t('Status','Status'))}</dt><dd><span class="label label-info">${esc(r.status || 'Submitted')}</span></dd>
            <dt>${esc(t('Record tag','Aktenzeichen'))}</dt><dd>${esc(r.recordTag || t('Not provided','Nicht angegeben'))}</dd>
            <dt>${esc(t('Submitted','Gesendet'))}</dt><dd>${esc(r.createdAt || '')}</dd>
            <dt>${esc(t('Decision note','Entscheidungsnotiz'))}</dt><dd>${note}</dd>
          </dl>
          <p class="small">${esc(t('If a public or private record is approved for release, staff will place the access instructions or next step in the decision note.','Wenn eine öffentliche oder private Akte freigegeben wird, erscheinen Zugriffshinweise oder der nächste Schritt in der Entscheidungsnotiz.'))}</p>
        </div>
      </section>`;
  }

  function renderRecord(r){
    const access = r.accessLevel === 'private' ? t('Private record','Private Akte') : (r.accessLevel === 'restricted' ? t('Restricted record','Eingeschränkte Akte') : t('Public record','Öffentliche Akte'));
    const note = lang()==='de' ? (r.decisionNote_de || r.decisionNote) : (r.decisionNote || r.decisionNote_de);
    const title = lang()==='de' ? (r.title_de || r.title) : (r.title || r.title_de);
    const status = lang()==='de' ? (r.status_de || r.status) : (r.status || r.status_de);
    const dept = lang()==='de' ? (r.department_de || r.department) : (r.department || r.department_de);
    const attachmentLabel = lang()==='de' ? (r.attachmentTitle_de || r.attachmentTitle) : (r.attachmentTitle || r.attachmentTitle_de);
    const attachment = r.attachmentUrl && attachmentLabel ? `<dt>${esc(t('Attachment','Anhang'))}</dt><dd><a href="${esc(r.attachmentUrl)}">${esc(attachmentLabel)}</a></dd>` : '';
    return `
      <section class="panel panel-default request-status-card">
        <header class="panel-heading"><h2 class="panel-title">${esc(t('Record / case status','Akten-/Fallstatus'))}</h2></header>
        <div class="panel-body">
          <dl class="dl-horizontal">
            <dt>${esc(t('Case number','Aktenzeichen'))}</dt><dd><code>${esc(r.caseNumber)}</code></dd>
            <dt>${esc(t('Access level','Zugriffsstufe'))}</dt><dd>${esc(access)}</dd>
            <dt>${esc(t('Title','Titel'))}</dt><dd>${esc(title)}</dd>
            <dt>${esc(t('Status','Status'))}</dt><dd><span class="label label-info">${esc(status || '')}</span></dd>
            <dt>${esc(t('Department/source','Behörde/Quelle'))}</dt><dd>${esc(dept || '')}</dd>
            <dt>${esc(t('Record tag','Aktenmarke'))}</dt><dd>${esc(r.recordTag || '')}</dd>
            <dt>${esc(t('Decision note','Entscheidungsnotiz'))}</dt><dd>${esc(note || t('No decision note has been posted yet.','Es wurde noch keine Entscheidungsnotiz veröffentlicht.'))}</dd>
            ${attachment}
          </dl>
          <p class="small">${esc(t('Private and restricted records require the email address registered in the dashboard registry entry.','Private und eingeschränkte Akten benötigen die im Dashboard-Register eingetragene E-Mail-Adresse.'))}</p>
        </div>
      </section>`;
  }

  async function fetchJson(url){
    const res = await fetch(url, {credentials:'same-origin', cache:'no-store'});
    const text = await res.text();
    let body = {};
    try{ body = text ? JSON.parse(text) : {}; }catch(e){ throw new Error('Non-JSON response: ' + text.slice(0,120));}
    if(!res.ok){ const err = new Error(body.error || ('HTTP ' + res.status)); err.status = res.status; throw err; }
    return body;
  }

  async function lookup(form){
    const result = document.getElementById('request-status-result');
    const data = new FormData(form);
    const reference = String(data.get('reference') || '').trim();
    const email = String(data.get('email') || '').trim();
    if(!reference) return;
    if(result){ result.className='alert alert-info'; result.textContent=t('Checking…','Wird geprüft…'); }

    const q = new URLSearchParams({reference,email});
    try{
      const body = await fetchJson('/account-api/request-status?' + q.toString());
      if(result){ result.className=''; result.innerHTML = renderRequest(body.request || {}); }
      return;
    }catch(firstErr){
      try{
        const q2 = new URLSearchParams({caseNumber:reference,email});
        const body = await fetchJson('/account-api/record-status?' + q2.toString());
        if(result){ result.className=''; result.innerHTML = renderRecord(body.record || {}); }
        return;
      }catch(secondErr){
        if(result){
          result.className='alert alert-danger';
          result.innerHTML='<h2 class="h3 mrgn-tp-0">'+esc(t('No matching request or record found','Keine passende Anfrage oder Akte gefunden'))+'</h2><p>'+esc(t('Check the reference/case number and the email address used when submitting or registering the record.','Referenz-/Aktenzeichen und E-Mail-Adresse prüfen, die beim Senden oder Registrieren verwendet wurden.'))+'</p><p><small>'+esc(secondErr.message||firstErr.message||secondErr)+'</small></p>';
        }
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    const form = document.getElementById('request-status-form');
    if(!form) return;
    const p = params();
    if(p.reference) form.reference.value = p.reference;
    if(p.email) form.email.value = p.email;
    form.addEventListener('submit', function(e){ e.preventDefault(); lookup(form); });
    if(p.reference) lookup(form);
  });
})();
