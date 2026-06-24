(function(){
  'use strict';

  function lang(){ return document.documentElement.lang === 'de' ? 'de' : 'en'; }
  function t(en,de){ return lang() === 'de' ? de : en; }
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

  function nextUrl(){
    const p = new URLSearchParams(location.search);
    const n = p.get('next') || '/dashboard/';
    if(!n.startsWith('/dashboard/') && n !== '/dashboard') return '/dashboard/';
    if(n.includes('/login')) return '/dashboard/';
    return n;
  }

  async function api(url, opts){
    const r = await fetch(url, {credentials:'same-origin', cache:'no-store', ...(opts||{})});
    const text = await r.text();
    let body = {};
    try{ body = text ? JSON.parse(text) : {}; }catch(e){}
    if(!r.ok){
      const err = new Error(body.error || text.slice(0,200) || ('HTTP ' + r.status));
      err.body = body;
      throw err;
    }
    return body;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('admin-login-form');
    const result = document.getElementById('admin-login-result');
    const mfaWrap = document.getElementById('mfa-wrap');

    try{
      await api('/admin-auth/me');
      location.replace(nextUrl());
      return;
    }catch(e){}

    if(!form) return;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if(result){
        result.className = '';
        result.textContent = t('Signing in…','Anmeldung läuft…');
      }
      const body = {
        username: form.username.value.trim(),
        password: form.password.value,
        mfaCode: form.mfaCode ? form.mfaCode.value.trim() : ''
      };
      try{
        await api('/admin-auth/login', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(body)
        });
        location.replace(nextUrl());
      }catch(err){
        if(err.body && err.body.mfaRequired && mfaWrap){
          mfaWrap.classList.remove('hidden');
          if(form.mfaCode) form.mfaCode.focus();
        }
        if(result){
          result.className = 'form-error';
          result.innerHTML = esc(t('Sign-in failed. ','Anmeldung fehlgeschlagen. ') + (err.message || err));
        }
      }
    });
  });
})();
