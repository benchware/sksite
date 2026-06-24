(function(){
  'use strict';

  if(window.__skAdminSessionBar) return;
  window.__skAdminSessionBar = true;

  const originalFetch = window.fetch.bind(window);
  let csrfResolve;
  const csrfReady = new Promise(resolve => { csrfResolve = resolve; });
  window.skAdminCsrf = '';

  function lang(){ return document.documentElement.lang === 'de' ? 'de' : 'en'; }
  function t(en,de){ return lang() === 'de' ? de : en; }
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function isMutating(method){ return ['POST','PUT','PATCH','DELETE'].includes(String(method || 'GET').toUpperCase()); }
  function sameOriginAdminUrl(input){
    try{
      const u = new URL(typeof input === 'string' ? input : input.url, location.origin);
      return u.origin === location.origin && (u.pathname.startsWith('/api/') || u.pathname === '/api/content' || u.pathname.startsWith('/admin-auth/'));
    }catch(e){ return false; }
  }

  window.fetch = async function(input, init){
    init = init || {};
    const method = init.method || (typeof input !== 'string' && input.method) || 'GET';
    if(isMutating(method) && sameOriginAdminUrl(input) && !String((typeof input === 'string' ? input : input.url) || '').includes('/admin-auth/login')){
      await csrfReady;
      init.headers = new Headers(init.headers || {});
      if(window.skAdminCsrf) init.headers.set('X-CSRF-Token', window.skAdminCsrf);
    }
    return originalFetch(input, init);
  };

  async function api(url, opts){
    const r = await originalFetch(url, {credentials:'same-origin', cache:'no-store', ...(opts||{})});
    const text = await r.text();
    let body = {};
    try{ body = text ? JSON.parse(text) : {}; }catch(e){}
    if(!r.ok) throw new Error(body.error || text.slice(0,200) || ('HTTP ' + r.status));
    return body;
  }

  function loginUrl(){
    const next = encodeURIComponent(location.pathname + location.search);
    return (lang()==='de' ? '/dashboard/de/login/' : '/dashboard/login/') + '?next=' + next;
  }
  function changePasswordUrl(){
    const next = encodeURIComponent(location.pathname + location.search);
    return (lang()==='de' ? '/dashboard/de/change-password/' : '/dashboard/change-password/') + '?next=' + next;
  }
  function onChangePasswordPage(){
    return location.pathname.includes('/dashboard/change-password') || location.pathname.includes('/dashboard/de/change-password');
  }

  function render(user){
    if(document.getElementById('admin-session-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'admin-session-bar';
    bar.className = 'admin-session-bar';
    bar.innerHTML = '<div class="container"><span>' +
      esc(t('Signed in as ','Angemeldet als ') + (user.displayName || user.username) + ' (' + (user.accountType || '') + ')') +
      '</span> <a class="btn btn-default btn-xs" href="' + (lang()==='de'?'/dashboard/de/change-password/':'/dashboard/change-password/') + '">' +
      esc(t('Security settings','Sicherheit')) + '</a> <button type="button" class="btn btn-default btn-xs" id="admin-logout">' +
      esc(t('Sign out','Abmelden')) + '</button></div>';
    const header = document.querySelector('header');
    if(header && header.parentNode) header.parentNode.insertBefore(bar, header.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);

    const btn = document.getElementById('admin-logout');
    if(btn){
      btn.addEventListener('click', async () => {
        try{ await window.fetch('/admin-auth/logout', {method:'POST'}); }catch(e){}
        location.replace(loginUrl());
      });
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if(location.pathname.includes('/dashboard/login')) return;
    try{
      const j = await api('/admin-auth/me');
      window.skAdminCsrf = j.csrfToken || '';
      csrfResolve(window.skAdminCsrf);
      const user = j.user || {};
      if(user.mustChangePassword && !onChangePasswordPage()){
        location.replace(changePasswordUrl());
        return;
      }
      render(user);
    }catch(e){
      csrfResolve('');
      location.replace(loginUrl());
    }
  });
})();
