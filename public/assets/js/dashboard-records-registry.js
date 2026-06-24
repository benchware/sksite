
(function(){
  'use strict';

  let RECORDS = [];
  let editingId = '';

  function lang(){ return document.documentElement.lang === 'de' ? 'de' : 'en'; }
  function t(en,de){ return lang() === 'de' ? de : en; }
  function $(id){ return document.getElementById(id); }
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function val(id){ const el=$(id); return el ? String(el.value || '').trim() : ''; }
  function setVal(id,v){ const el=$(id); if(el) el.value = v || ''; }

  async function api(url, opts){
    const r = await fetch(url, {credentials:'same-origin', cache:'no-store', ...(opts || {})});
    const text = await r.text();
    let body = {};
    try{ body = text ? JSON.parse(text) : {}; }catch(e){ throw new Error('Non-JSON response: ' + text.slice(0,160)); }
    if(!r.ok) throw new Error(body.error || text.slice(0,200) || ('HTTP ' + r.status));
    return body;
  }

  function show(msg, ok=true){
    const el = $('registry-status');
    if(!el) return;
    el.className = ok ? 'form-saved' : 'form-error';
    el.innerHTML = esc(msg);
  }

  function labelAccess(x){
    if(lang()==='de'){
      if(x==='private') return 'Privat';
      if(x==='restricted') return 'Eingeschränkt';
      return 'Öffentlich';
    }
    if(x==='private') return 'Private';
    if(x==='restricted') return 'Restricted';
    return 'Public';
  }

  function render(){
    const body = $('registry-body');
    if(!body) return;
    body.innerHTML = RECORDS.map(r => {
      const cls = r.accessLevel === 'public' ? 'label-info' : (r.accessLevel === 'private' ? 'label-warning' : 'label-danger');
      return `<tr>
        <td><code>${esc(r.caseNumber || '')}</code></td>
        <td><span class="label ${cls}">${esc(labelAccess(r.accessLevel))}</span><br><small>${esc(r.publishStatus || '')}</small></td>
        <td><strong>${esc(lang()==='de' ? (r.title_de || r.title) : (r.title || r.title_de))}</strong><br><small>${esc(lang()==='de' ? (r.summary_de || r.summary) : (r.summary || r.summary_de))}</small></td>
        <td>${esc(r.requesterName || '')}<br><small>${esc(r.requesterEmail || '')}</small></td>
        <td>${esc(r.status || '')}<br><small>${esc(r.updatedAt || r.createdAt || '')}</small></td>
        <td>
          <button type="button" class="btn btn-default btn-xs" data-edit="${esc(r.id || r.caseNumber)}">${esc(t('Edit','Bearbeiten'))}</button>
          <button type="button" class="btn btn-danger btn-xs" data-delete="${esc(r.id || r.caseNumber)}">${esc(t('Delete','Löschen'))}</button>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="6">${esc(t('No registry records yet.','Noch keine Registerakten.'))}</td></tr>`;
  }

  async function load(){
    try{
      const j = await api('/api/record-registry');
      RECORDS = j.records || [];
      render();
      show(t('Records registry loaded.','Aktenregister geladen.'));
    }catch(e){
      show(t('Could not load records registry. ','Aktenregister konnte nicht geladen werden. ') + (e.message || e), false);
    }
  }

  function clearForm(){
    editingId = '';
    const form = $('registry-form');
    if(form) form.reset();
    setVal('accessLevel','public');
    setVal('publishStatus','published');
    setVal('status','Active');
    setVal('status_de','Aktiv');
    setVal('date', new Date().toISOString().slice(0,10));
    setVal('caseNumber','');
  }

  function editRecord(key){
    const r = RECORDS.find(x => String(x.id) === key || String(x.caseNumber) === key);
    if(!r) return;
    editingId = r.id || '';
    ['caseNumber','accessLevel','publishStatus','date','title','title_de','status','status_de','summary','summary_de','department','department_de','requesterName','requesterEmail','recordTag','decisionNote','decisionNote_de','attachmentTitle','attachmentTitle_de','attachmentUrl','url','url_de'].forEach(id => setVal(id, r[id] || ''));
    window.scrollTo({top:0, behavior:'smooth'});
    show(t('Editing record ','Registerakte wird bearbeitet ') + (r.caseNumber || ''));
  }

  function payload(){
    return {
      id: editingId,
      caseNumber: val('caseNumber'),
      accessLevel: val('accessLevel') || 'public',
      publishStatus: val('publishStatus') || 'draft',
      date: val('date'),
      title: val('title'),
      title_de: val('title_de') || val('title'),
      status: val('status') || 'Active',
      status_de: val('status_de') || val('status') || 'Aktiv',
      summary: val('summary'),
      summary_de: val('summary_de') || val('summary'),
      department: val('department'),
      department_de: val('department_de') || val('department'),
      requesterName: val('requesterName'),
      requesterEmail: val('requesterEmail'),
      recordTag: val('recordTag'),
      decisionNote: val('decisionNote'),
      decisionNote_de: val('decisionNote_de') || val('decisionNote'),
      attachmentTitle: val('attachmentTitle'),
      attachmentTitle_de: val('attachmentTitle_de') || val('attachmentTitle'),
      attachmentUrl: val('attachmentUrl'),
      url: val('url'),
      url_de: val('url_de')
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    clearForm();
    const form = $('registry-form');
    if(form){
      form.addEventListener('submit', async e => {
        e.preventDefault();
        try{
          const j = await api('/api/record-registry', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(payload())
          });
          show(t('Saved. Case number: ','Gespeichert. Aktenzeichen: ') + (j.record && j.record.caseNumber ? j.record.caseNumber : ''));
          clearForm();
          await load();
        }catch(err){
          show(t('Save failed. ','Speichern fehlgeschlagen. ') + (err.message || err), false);
        }
      });
    }

    const cancel = $('registry-cancel');
    if(cancel) cancel.addEventListener('click', clearForm);

    const body = $('registry-body');
    if(body){
      body.addEventListener('click', async e => {
        const edit = e.target.closest('[data-edit]');
        const del = e.target.closest('[data-delete]');
        if(edit) return editRecord(edit.dataset.edit);
        if(del){
          if(!confirm(t('Delete this registry record?','Diese Registerakte löschen?'))) return;
          try{
            await api('/api/record-registry/delete', {
              method:'POST',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({id:del.dataset.delete})
            });
            show(t('Deleted.','Gelöscht.'));
            await load();
          }catch(err){ show(t('Delete failed. ','Löschen fehlgeschlagen. ') + (err.message || err), false); }
        }
      });
    }

    load();
  });
})();
