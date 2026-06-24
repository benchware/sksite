
(function(){
  'use strict';

  if (window.__skDashboardEasyInitialized) return;
  window.__skDashboardEasyInitialized = true;

  let data = {};
  let category = 'news';
  let saving = false;
  let editingId = '';
  let initialized = false;

  const categories = [
    'news','incidentReports','advisories','gazette','services','transparency',
    'records','legalDocuments','states','departments','organizations'
  ];

  function lang(){ return document.documentElement.lang === 'de' ? 'de' : 'en'; }
  function t(en, de){ return lang() === 'de' ? de : en; }
  function $(id){ return document.getElementById(id); }
  function val(id){ const el = $(id); return el ? el.value.trim() : ''; }
  function setVal(id, value){ const el = $(id); if(el) el.value = value || ''; }

  function escapeHtml(s){
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[c]));
  }

  function makeId(prefix){
    return String(prefix || 'record')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function ensureDataShape(){
    categories.forEach(key => {
      if(!Array.isArray(data[key])) data[key] = [];
      data[key].forEach(item => {
        if(!item.id) item.id = makeId(key);
        if(!item.publishStatus) item.publishStatus = 'published';
      });
    });
  }

  function titleOf(item){
    if(lang() === 'de') return item.title_de || item.name_de || item.title || item.name || '(ohne Titel)';
    return item.title || item.name || item.title_de || item.name_de || '(untitled)';
  }

  function summaryOf(item){
    if(lang() === 'de') return item.summary_de || item.description_de || item.summary || item.description || '';
    return item.summary || item.description || item.summary_de || item.description_de || '';
  }

  function metaOf(item){
    const pub = item.publishStatus || 'published';
    if(lang() === 'de') return [item.date, item.status_de || item.type_de || item.status || item.type || item.abbr || '', pub].filter(Boolean).join(' | ');
    return [item.date, item.status || item.type || item.abbr || item.status_de || item.type_de || '', pub].filter(Boolean).join(' | ');
  }

  function showStatus(message, ok = true){
    const el = $('save-status');
    if (!el) return;
    el.className = ok ? 'form-saved' : 'form-error';
    el.innerHTML = message;
  }

  function fatal(message){
    const main = document.querySelector('main') || document.body;
    const box = document.createElement('div');
    box.className = 'form-error';
    box.innerHTML = '<strong>Dashboard diagnostic:</strong> ' + escapeHtml(message);
    main.insertBefore(box, main.firstChild);
  }

  async function apiFetch(url, options = {}){
    const res = await fetch(url, {credentials:'same-origin', cache:'no-store', ...options});
    const text = await res.text();
    if(!res.ok) throw new Error(`${options.method || 'GET'} ${url} returned HTTP ${res.status}: ${text.slice(0, 400)}`);
    try { return text ? JSON.parse(text) : {}; }
    catch(e){ throw new Error(`${url} did not return JSON. First characters: ${text.slice(0, 160)}`); }
  }

  async function load(){
    try{
      data = await apiFetch('/api/content');
      ensureDataShape();
      render();
      showStatus(t('Connected to admin API.', 'Mit Admin-API verbunden.'));
    }catch(err){
      showStatus(t(
        'API connection failed. The Caddyfile may not be proxying /api/* to Node, or Node may be down. ',
        'API-Verbindung fehlgeschlagen. Caddy leitet /api/* möglicherweise nicht an Node weiter, oder Node ist nicht aktiv. '
      ) + escapeHtml(err.message || err), false);
    }
  }

  function render(){
    const categoryEl = $('category');
    if(!categoryEl) return fatal('Missing #category select.');
    category = categoryEl.value;
    ensureDataShape();

    const box = $('items');
    if(!box) return fatal('Missing #items container.');
    box.innerHTML = '';

    (data[category] || []).forEach((it) => {
      const article = document.createElement('article');
      article.className = 'dashboard-record';
      const deBadge = (it.title_de || it.name_de || it.summary_de || it.description_de || it.status_de || it.type_de || it.url_de)
        ? '<span class="label label-success">DE</span>'
        : '<span class="label label-warning">DE missing</span>';
      const pubClass = (it.publishStatus || 'published') === 'published' ? 'label-info' : ((it.publishStatus || '') === 'draft' ? 'label-warning' : 'label-default');
      article.innerHTML = `
        <h3>${escapeHtml(titleOf(it))} ${deBadge} <span class="label ${pubClass}">${escapeHtml(it.publishStatus || 'published')}</span></h3>
        <p class="meta">${escapeHtml(metaOf(it))}</p>
        <p>${escapeHtml(summaryOf(it))}</p>
        ${it.url || it.url_de ? `<p>${it.url ? `<a href="${escapeHtml(it.url)}">${escapeHtml(it.url)}</a>` : ''} ${it.url_de ? `<br><a href="${escapeHtml(it.url_de)}">${escapeHtml(it.url_de)}</a>` : ''}</p>` : ''}
        ${it.linkUrl ? `<p><strong>${t('Related link','Verwandter Link')}:</strong> <a href="${escapeHtml(it.linkUrl)}">${escapeHtml(lang()==='de' ? (it.linkTitle_de || it.linkTitle || it.linkUrl) : (it.linkTitle || it.linkUrl))}</a></p>` : ''}
        ${it.attachmentUrl ? `<p><strong>${t('Attachment','Anhang')}:</strong> <a href="${escapeHtml(it.attachmentUrl)}">${escapeHtml(lang()==='de' ? (it.attachmentTitle_de || it.attachmentTitle || it.attachmentUrl) : (it.attachmentTitle || it.attachmentUrl))}</a></p>` : ''}
        <p class="list-actions">
          <button type="button" data-edit-id="${escapeHtml(it.id)}" class="btn btn-default btn-xs">${t('Edit','Bearbeiten')}</button>
          <button type="button" data-del-id="${escapeHtml(it.id)}" class="btn btn-link btn-xs btn-link-danger">${t('Delete','Löschen')}</button>
        </p>`;
      box.appendChild(article);
    });
  }

  function findIndexById(id){
    return (data[category] || []).findIndex(item => item.id === id);
  }

  function editById(id){
    category = $('category').value;
    const idx = id ? findIndexById(id) : -1;
    const it = idx >= 0 ? data[category][idx] : {};

    editingId = idx >= 0 ? it.id : '';
    $('editor').classList.remove('hidden');
    $('index').value = editingId;

    setVal('date', it.date || '');
    setVal('publishStatus', it.publishStatus || 'published');

    setVal('title', it.title || it.name || '');
    setVal('status', it.status || it.type || it.abbr || '');
    setVal('url', it.url || '');
    setVal('summary', it.summary || it.description || '');

    setVal('title_de', it.title_de || it.name_de || '');
    setVal('status_de', it.status_de || it.type_de || '');
    setVal('url_de', it.url_de || '');
    setVal('summary_de', it.summary_de || it.description_de || '');

    setVal('linkTitle', it.linkTitle || '');
    setVal('linkTitle_de', it.linkTitle_de || '');
    setVal('linkUrl', it.linkUrl || '');
    setVal('attachmentTitle', it.attachmentTitle || '');
    setVal('attachmentTitle_de', it.attachmentTitle_de || '');
    setVal('attachmentUrl', it.attachmentUrl || '');

    const first = $('title') || $('title_de');
    if(first) first.focus();
  }

  async function saveAll(){
    if(saving) return false;
    saving = true;

    const submitButton = document.querySelector('#form button[type="submit"]');
    if(submitButton) submitButton.disabled = true;

    try{
      ensureDataShape();
      await apiFetch('/api/content', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data)
      });
      showStatus(t('Saved.', 'Gespeichert.'));
      return true;
    }catch(err){
      showStatus(t(
        'Save failed. /api/content is not reaching Node, or the JSON file is not writable. ',
        'Speichern fehlgeschlagen. /api/content erreicht Node nicht, oder die JSON-Datei ist nicht beschreibbar. '
      ) + escapeHtml(err.message || err), false);
      return false;
    }finally{
      saving = false;
      if(submitButton) submitButton.disabled = false;
    }
  }

  function applyFieldMap(item, englishTitle, germanTitle, englishStatus, germanStatus, englishSummary, germanSummary, englishUrl, germanUrl){
    if(['states','departments','organizations'].includes(category)){
      item.name = englishTitle;
      item.name_de = germanTitle || englishTitle;
    }else{
      item.title = englishTitle;
      item.title_de = germanTitle || englishTitle;
    }

    if(category === 'departments'){
      if(englishStatus) item.abbr = englishStatus; else delete item.abbr;
      item.type_de = germanStatus || englishStatus || '';
    }else if(category === 'organizations'){
      if(englishStatus) item.type = englishStatus; else delete item.type;
      item.type_de = germanStatus || englishStatus || '';
    }else{
      if(englishStatus) item.status = englishStatus; else delete item.status;
      item.status_de = germanStatus || englishStatus || '';
    }

    item.summary = englishSummary;
    item.summary_de = germanSummary || englishSummary;

    if(englishUrl) item.url = englishUrl; else delete item.url;
    if(germanUrl) item.url_de = germanUrl;
    else if(englishUrl && englishUrl.startsWith('/en/')) item.url_de = englishUrl.replace('/en/','/de/');
    else if(englishUrl) item.url_de = englishUrl;
    else delete item.url_de;
  }

  function buildItemFromForm(existing){
    const item = existing ? {...existing} : {};
    if(!item.id) item.id = makeId(category);

    item.publishStatus = val('publishStatus') || 'published';

    const englishTitle = val('title');
    const germanTitle = val('title_de') || englishTitle;
    const englishStatus = val('status');
    const germanStatus = val('status_de') || englishStatus;
    const englishSummary = val('summary');
    const germanSummary = val('summary_de') || englishSummary;
    const englishUrl = val('url');
    const germanUrl = val('url_de') || (englishUrl.startsWith('/en/') ? englishUrl.replace('/en/','/de/') : englishUrl);

    const dateValue = val('date');
    if(dateValue) item.date = dateValue;
    else delete item.date;

    applyFieldMap(item, englishTitle, germanTitle, englishStatus, germanStatus, englishSummary, germanSummary, englishUrl, germanUrl);

    const linkTitle = val('linkTitle');
    const linkTitleDe = val('linkTitle_de') || linkTitle;
    const linkUrl = val('linkUrl');
    const attachmentTitle = val('attachmentTitle');
    const attachmentTitleDe = val('attachmentTitle_de') || attachmentTitle;
    const attachmentUrl = val('attachmentUrl');

    if (linkTitle) item.linkTitle = linkTitle; else delete item.linkTitle;
    if (linkTitleDe) item.linkTitle_de = linkTitleDe; else delete item.linkTitle_de;
    if (linkUrl) item.linkUrl = linkUrl; else delete item.linkUrl;

    if (attachmentTitle) item.attachmentTitle = attachmentTitle; else delete item.attachmentTitle;
    if (attachmentTitleDe) item.attachmentTitle_de = attachmentTitleDe; else delete item.attachmentTitle_de;
    if (attachmentUrl) item.attachmentUrl = attachmentUrl; else delete item.attachmentUrl;

    return item;
  }

  function itemFingerprint(item){
    return [
      category,
      item.title || item.name || '',
      item.date || '',
      item.status || item.type || item.abbr || '',
      item.summary || ''
    ].join('|').toLowerCase().trim();
  }

  function findDuplicateIndex(item, ignoreId){
    const fp = itemFingerprint(item);
    return (data[category] || []).findIndex(candidate => {
      if(candidate.id === ignoreId) return false;
      return itemFingerprint(candidate) === fp;
    });
  }

  function copyEnglishToGerman(){
    setVal('title_de', val('title'));
    setVal('summary_de', val('summary'));
    setVal('status_de', val('status'));
    const u = val('url');
    setVal('url_de', u.startsWith('/en/') ? u.replace('/en/','/de/') : u);
    showStatus(t('English fields copied to German fields. Review before saving.', 'Englische Felder wurden in die deutschen Felder kopiert. Bitte vor dem Speichern prüfen.'));
  }

  function init(){
    if(initialized) return;
    initialized = true;

    const required = ['category','add','cancel','items','form','editor','index','title','summary','title_de','summary_de','publishStatus','linkTitle','linkUrl','attachmentTitle','attachmentUrl','linkTitle_de','attachmentTitle_de'];
    const missing = required.filter(id => !$(id));
    if(missing.length){
      fatal('Missing required Easy Mode elements: ' + missing.join(', '));
      return;
    }

    const categoryEl = $('category');
    const addBtn = $('add');
    const cancelBtn = $('cancel');
    const copyBtn = $('copy-to-de');
    const itemsEl = $('items');
    const form = $('form');

    categoryEl.addEventListener('change', () => {
      editingId = '';
      $('editor').classList.add('hidden');
      render();
    });

    addBtn.addEventListener('click', () => editById(''));
    cancelBtn.addEventListener('click', () => {
      editingId = '';
      $('editor').classList.add('hidden');
    });
    if(copyBtn) copyBtn.addEventListener('click', copyEnglishToGerman);

    itemsEl.addEventListener('click', e => {
      const button = e.target.closest('button');
      if(!button) return;

      const editId = button.dataset.editId;
      const delId = button.dataset.delId;

      if(editId !== undefined) editById(editId);

      if(delId !== undefined && confirm(t('Delete this item?', 'Diesen Eintrag löschen?'))){
        const idx = findIndexById(delId);
        if(idx >= 0){
          data[category].splice(idx, 1);
          saveAll().then(ok => { if(ok) render(); });
        }
      }
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      if(saving) return;

      const currentId = $('index').value || editingId;
      const existingIndex = currentId ? findIndexById(currentId) : -1;
      const existing = existingIndex >= 0 ? data[category][existingIndex] : null;
      const item = buildItemFromForm(existing);

      if(!data[category]) data[category] = [];

      const duplicateIndex = findDuplicateIndex(item, existing ? existing.id : '');
      if(duplicateIndex !== -1){
        showStatus(t(
          'Duplicate blocked. A record with the same title, date, status and summary already exists.',
          'Duplikat blockiert. Ein Eintrag mit gleichem Titel, Datum, Status und gleicher Zusammenfassung existiert bereits.'
        ), false);
        return;
      }

      if(existingIndex >= 0) data[category][existingIndex] = item;
      else data[category].push(item);

      saveAll().then(ok => {
        if(ok){
          editingId = '';
          $('editor').classList.add('hidden');
          render();
        }
      });
    });

    window.skEasyDashboard = {load, render, editById, data: () => data};
    load();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
