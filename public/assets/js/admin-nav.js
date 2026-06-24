(function(){
  'use strict';

  if(window.__skDashboardNavigation) return;
  window.__skDashboardNavigation = true;

  function lang(){ return document.documentElement.lang === 'de' ? 'de' : 'en'; }
  function t(en,de){ return lang() === 'de' ? de : en; }
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

  function link(pathEn, pathDe, labelEn, labelDe){
    const href = lang() === 'de' ? pathDe : pathEn;
    const label = t(labelEn, labelDe);
    return `<a class="btn btn-default btn-sm" href="${esc(href)}">${esc(label)}</a>`;
  }

  function canGoBack(){
    try { return window.history.length > 1; } catch(e) { return false; }
  }

  function render(){
    if(document.getElementById('dashboard-quick-nav')) return;
    if(location.pathname.includes('/dashboard/login')) return;

    const bar = document.createElement('nav');
    bar.id = 'dashboard-quick-nav';
    bar.className = 'dashboard-quick-nav';
    bar.setAttribute('aria-label', t('Dashboard navigation', 'Dashboard-Navigation'));

    bar.innerHTML = `
      <div class="container dashboard-quick-nav-inner">
        <button type="button" class="btn btn-default btn-sm" id="dashboard-back">${esc(t('← Back','← Zurück'))}</button>
        ${link('/dashboard/','/dashboard/de/','Dashboard home','Dashboard-Start')}
        ${link('/dashboard/easy/','/dashboard/de/easy/','Easy mode','Einfacher Modus')}
        ${link('/dashboard/advanced/','/dashboard/de/advanced/','Advanced JSON','Erweiterter JSON-Modus')}
        ${link('/dashboard/records-registry/','/dashboard/de/records-registry/','Records registry','Aktenregister')}
        ${link('/dashboard/accounts/','/dashboard/de/accounts/','Accounts','Konten')}
        ${link('/dashboard/requests/','/dashboard/de/requests/','Requests','Anfragen')}
        ${link('/dashboard/campaigns/','/dashboard/de/campaigns/','Campaigns','Kampagnen')}
        ${link('/dashboard/alerts/','/dashboard/de/alerts/','Alerts','Meldungen')}
        ${link('/dashboard/elections/','/dashboard/de/elections/','Elections','Wahlen')}
        ${link('/dashboard/security/','/dashboard/de/security/','Security','Sicherheit')}
        ${link('/en/','/de/','Public site','Öffentliche Seite')}
      </div>
    `;

    const session = document.getElementById('admin-session-bar');
    if(session && session.parentNode){
      session.parentNode.insertBefore(bar, session.nextSibling);
    }else{
      const header = document.querySelector('header');
      if(header && header.parentNode) header.parentNode.insertBefore(bar, header.nextSibling);
      else document.body.insertBefore(bar, document.body.firstChild);
    }

    const back = document.getElementById('dashboard-back');
    if(back){
      back.disabled = !canGoBack();
      back.addEventListener('click', () => {
        if(canGoBack()) history.back();
        else location.href = lang() === 'de' ? '/dashboard/de/' : '/dashboard/';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', render);
})();
