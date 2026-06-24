
(function(){
  'use strict';

  function escapeHtml(s){
    return String(s || '').replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];
    });
  }

  function getLang(form){
    return form.dataset.lang || document.documentElement.lang || 'en';
  }

  function msg(lang, key){
    const de = {
      sending: 'Wird gesendet…',
      submitted: 'Anfrage erfolgreich übermittelt',
      reference: 'Ihre Referenznummer',
      save: 'Speichern Sie diese Referenznummer. Sie benötigen sie, um den Status zu prüfen.',
      status: 'Status prüfen',
      whatNext: 'Was passiert als Nächstes?',
      next1: 'Die Anfrage erscheint im Dashboard für berechtigte Mitarbeitende.',
      next2: 'Ein Officer prüft die Anfrage und aktualisiert den Status.',
      next3: 'Wenn ein Datensatz freigegeben wird, erscheinen die Anweisungen im Statusfeld.',
      failed: 'Übermittlung fehlgeschlagen.',
      api: 'Der API-Dienst ist möglicherweise nicht aktiv oder Caddy leitet /account-api/* nicht an Node weiter.'
    };
    const en = {
      sending: 'Submitting…',
      submitted: 'Request submitted successfully',
      reference: 'Your reference number',
      save: 'Save this reference number. You need it to check status later.',
      status: 'Check status',
      whatNext: 'What happens next?',
      next1: 'The request appears in the dashboard for authorized staff.',
      next2: 'An officer reviews it and updates the status.',
      next3: 'If a record is released, access instructions appear in the status result.',
      failed: 'Submission failed.',
      api: 'The API service may not be running or Caddy may not be proxying /account-api/* to Node.'
    };
    return (lang === 'de' ? de : en)[key] || key;
  }

  function statusUrl(lang, ref, email){
    const base = lang === 'de' ? '/de/request-status/' : '/en/request-status/';
    const q = new URLSearchParams();
    if(ref) q.set('reference', ref);
    if(email) q.set('email', email);
    return base + (q.toString() ? '?' + q.toString() : '');
  }

  function buildPayload(form){
    const obj = {};
    new FormData(form).forEach(function(v,k){ obj[k] = String(v || '').trim(); });
    obj.sourcePath = window.location.pathname;

    if(obj.recordAccessType && obj.requestType === 'records'){
      obj.details = '[' + (obj.recordAccessType === 'private' ? 'PRIVATE RECORD' : 'PUBLIC RECORD') + '] ' + (obj.details || '');
    }
    if(obj.recordTag){
      obj.details = '[Record tag/case number: ' + obj.recordTag + '] ' + (obj.details || '');
    }
    return obj;
  }

  async function submitForm(form){
    const lang = getLang(form);
    const result = document.getElementById(form.dataset.resultTarget || 'request-result');
    const button = form.querySelector('button[type="submit"]');
    const obj = buildPayload(form);

    if(result){
      result.className = 'alert alert-info';
      result.textContent = msg(lang, 'sending');
      result.focus && result.focus();
    }
    if(button) button.disabled = true;

    try{
      const res = await fetch('/account-api/requests', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(obj)
      });
      const text = await res.text();
      let body = {};
      try { body = text ? JSON.parse(text) : {}; }
      catch(e){ throw new Error('API returned non-JSON response: ' + text.slice(0, 160)); }

      if(!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
      const ref = body.reference || body.id || '';
      const url = statusUrl(lang, ref, obj.email);

      if(result){
        result.className = 'alert alert-success request-success-box';
        result.innerHTML =
          '<h2 class="h3 mrgn-tp-0">' + escapeHtml(msg(lang, 'submitted')) + '</h2>' +
          '<p><strong>' + escapeHtml(msg(lang, 'reference')) + ':</strong> <code class="request-reference">' + escapeHtml(ref) + '</code></p>' +
          '<p>' + escapeHtml(msg(lang, 'save')) + '</p>' +
          '<p><a class="btn btn-primary" href="' + escapeHtml(url) + '">' + escapeHtml(msg(lang, 'status')) + '</a></p>' +
          '<details><summary>' + escapeHtml(msg(lang, 'whatNext')) + '</summary>' +
          '<ol><li>' + escapeHtml(msg(lang, 'next1')) + '</li><li>' + escapeHtml(msg(lang, 'next2')) + '</li><li>' + escapeHtml(msg(lang, 'next3')) + '</li></ol></details>';
        result.setAttribute('tabindex','-1');
        result.focus();
      }
      form.reset();
    }catch(err){
      if(result){
        result.className = 'alert alert-danger';
        result.innerHTML = '<h2 class="h3 mrgn-tp-0">' + escapeHtml(msg(lang, 'failed')) + '</h2>' +
          '<p>' + escapeHtml(msg(lang, 'api')) + '</p><p><small>' + escapeHtml(err.message || err) + '</small></p>';
      }
    }finally{
      if(button) button.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('#service-request-form, #record-request-form, .service-request-form').forEach(function(form){
      if(form.dataset.skRequestBound === '1') return;
      form.dataset.skRequestBound = '1';
      form.addEventListener('submit', function(e){
        e.preventDefault();
        submitForm(form);
      });
    });
  });
})();
