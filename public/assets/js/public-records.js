
(function(){
  'use strict';

  const categoryMap = {
    '/en/incident-reports/': 'incidentReports',
    '/en/advisories/': 'advisories',
    '/en/gazette/': 'gazette',
    '/en/transparency/': 'transparency',
    '/en/records/': 'records',
    '/en/news/': 'news',
    '/en/services/': 'services',
    '/en/departments/': 'departments',
    '/en/states/': 'states',
    '/en/laws/': 'legalDocuments',

    '/de/incident-reports/': 'incidentReports',
    '/de/advisories/': 'advisories',
    '/de/gazette/': 'gazette',
    '/de/transparency/': 'transparency',
    '/de/records/': 'records',
    '/de/news/': 'news',
    '/de/services/': 'services',
    '/de/departments/': 'departments',
    '/de/states/': 'states',
    '/de/laws/': 'legalDocuments'
  };

  function canonicalPath(){
    let p = window.location.pathname;
    if (!p.endsWith('/')) p += '/';
    return p;
  }

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    }[ch]));
  }

  function itemTitle(item, lang){
    if (lang === 'de') return item.title_de || item.name_de || item.title || item.name || item.id || '(ohne Titel)';
    return item.title || item.name || item.id || '(untitled)';
  }

  function itemMeta(item, lang){
    const status = lang === 'de' ? (item.status_de || item.status) : item.status;
    const type = lang === 'de' ? (item.type_de || item.type) : item.type;
    const abbr = item.abbr;
    return [item.date, status, type, abbr].filter(Boolean).join(' | ');
  }

  function itemSummary(item, lang){
    if (lang === 'de') return item.summary_de || item.description_de || item.summary || item.description || '';
    return item.summary || item.description || '';
  }

  function itemAreas(item, lang){
    if (lang === 'de' && Array.isArray(item.areas_de)) return item.areas_de;
    if (Array.isArray(item.areas)) return item.areas;
    return [];
  }

  function itemUrl(item, category, lang){
    if (lang === 'de' && item.url_de) return item.url_de;
    if (item.url) {
      if (lang === 'de' && item.url.startsWith('/en/')) return item.url.replace('/en/', '/de/');
      return item.url;
    }
    if (category === 'news' && item.id) return `/${lang}/news/#${encodeURIComponent(item.id)}`;
    if (category === 'legalDocuments' && item.id === 'basic-laws') return `/${lang}/laws/basic-laws/`;
    return '';
  }

  function isPublished(item){ return !item.publishStatus || item.publishStatus === 'published'; }

  function normalizeItems(items){
    if (!Array.isArray(items)) return [];
    // Deduplicate by id, otherwise by title/name + date + summary.
    const seen = new Set();
    const out = [];
    for (const item of items) {
      if (!isPublished(item)) continue;
      const key = item.id || [
        item.title || item.name || '',
        item.date || '',
        item.status || item.type || item.abbr || '',
        item.summary || item.description || ''
      ].join('|').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }


  function safeHref(url){
    const u = String(url || '').trim();
    if (!u) return '';
    if (u.startsWith('/')) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return '';
  }

  function renderExtraLinks(item, lang){
    const parts = [];
    const linkUrl = safeHref(item.linkUrl);
    if (linkUrl) {
      const label = lang === 'de' ? (item.linkTitle_de || item.linkTitle || linkUrl) : (item.linkTitle || linkUrl);
      parts.push(`<p><strong>${lang === 'de' ? 'Verwandter Link' : 'Related link'}:</strong> <a href="${escapeHtml(linkUrl)}">${escapeHtml(label)}</a></p>`);
    }
    const attachmentUrl = safeHref(item.attachmentUrl);
    if (attachmentUrl) {
      const label = lang === 'de' ? (item.attachmentTitle_de || item.attachmentTitle || attachmentUrl) : (item.attachmentTitle || attachmentUrl);
      parts.push(`<p><strong>${lang === 'de' ? 'Anhang' : 'Attachment'}:</strong> <a href="${escapeHtml(attachmentUrl)}">${escapeHtml(label)}</a></p>`);
    }
    return parts.join('');
  }


  function recordBadges(item, lang, category){
    if(category !== 'records') return '';
    const parts = [];
    if(item.caseNumber) parts.push(`<span class="label label-info">${escapeHtml(item.caseNumber)}</span>`);
    if(item.accessLevel === 'public') parts.push(`<span class="label label-success">${lang === 'de' ? 'Öffentliche Akte' : 'Public record'}</span>`);
    return parts.length ? `<p class="record-badges">${parts.join(' ')}</p>` : '';
  }

  function renderTable(container, items, category, lang){
    const caption = lang === 'de' ? 'Aktuelle Einträge' : 'Current records';
    const dateLabel = lang === 'de' ? 'Datum' : 'Date';
    const titleLabel = lang === 'de' ? 'Titel' : 'Title';
    const statusLabel = lang === 'de' ? 'Status' : 'Status';
    const summaryLabel = lang === 'de' ? 'Zusammenfassung' : 'Summary';

    let rows = items.map(item => {
      const url = itemUrl(item, category, lang);
      const title = url ? `<a href="${escapeHtml(url)}">${escapeHtml(itemTitle(item, lang))}</a>` : escapeHtml(itemTitle(item, lang));
      return `<tr>
        <td>${title}</td>
        <td>${escapeHtml(item.date || '')}</td>
        <td>${escapeHtml((lang === 'de' ? (item.status_de || item.type_de || item.status || item.type) : (item.status || item.type)) || item.abbr || '')}</td>
        <td>${recordBadges(item, lang, category)}${escapeHtml(itemSummary(item, lang))}${renderExtraLinks(item, lang)}</td>
      </tr>`;
    }).join('');

    if (!rows) {
      rows = `<tr><td colspan="4">${lang === 'de' ? 'Keine Einträge veröffentlicht.' : 'No records published.'}</td></tr>`;
    }

    container.innerHTML = `<table class="table table-striped table-hover sk-table">
      <caption>${caption}</caption>
      <thead><tr><th>${titleLabel}</th><th>${dateLabel}</th><th>${statusLabel}</th><th>${summaryLabel}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function renderCards(container, items, category, lang){
    const emptyText = lang === 'de' ? 'Keine Einträge veröffentlicht.' : 'No records published.';
    if (!items.length) {
      container.innerHTML = `<p>${emptyText}</p>`;
      return;
    }
    container.innerHTML = items.map(item => {
      const url = itemUrl(item, category, lang);
      const title = url ? `<a href="${escapeHtml(url)}">${escapeHtml(itemTitle(item, lang))}</a>` : escapeHtml(itemTitle(item, lang));
      const meta = itemMeta(item, lang);
      const areas = itemAreas(item, lang);
      const areasHtml = areas.length ? '<h3 class="h4">' + (lang === 'de' ? 'Tätigkeitsbereiche' : 'Areas of activity') + '</h3><ul>' + areas.map(a => '<li>' + escapeHtml(a) + '</li>').join('') + '</ul>' : '';
      return `<article class="dashboard-public-record">
        <h2 class="h3">${title}</h2>
        ${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ''}
        ${recordBadges(item, lang, category)}
        <p>${escapeHtml(itemSummary(item, lang))}</p>
        ${renderExtraLinks(item, lang)}
        ${areasHtml}
      </article>`;
    }).join('');
  }

  async function init(){
    const path = canonicalPath();
    const category = categoryMap[path];
    if (!category) return;

    // Do not overwrite a specific article/detail page like /en/laws/basic-laws/
    if (path.includes('/basic-laws/') || path.includes('/transit-access-permit/') || path.includes('/report-infrastructure-issue/')) return;

    const lang = path.startsWith('/de/') ? 'de' : 'en';
    let target = document.querySelector('[data-dynamic-records]');
    if (!target) {
      target = document.querySelector('#records.record-list, #current.record-list, #online-services.record-list, #news-content, #departments-list, #states-table');
    }
    if (!target) return;

    try {
      const res = await fetch('/assets/data/site-data.json', {cache: 'no-store'});
      const data = await res.json();
      const items = normalizeItems(data[category] || []);

      // For departments/states/services/news, cards look better. For logs and legal docs, table looks more official.
      if (['departments', 'states', 'services', 'news'].includes(category)) renderCards(target, items, category, lang);
      else renderTable(target, items, category, lang);

      if (category === 'departments') {
        const orgTarget = document.querySelector('[data-dynamic-organizations]');
        if (orgTarget) {
          const orgHeading = lang === 'de' ? '<h2>Öffentliche Organisationen</h2>' : '<h2>Public organizations</h2>';
          orgTarget.innerHTML = orgHeading + '<div id="org-cards"></div>';
          const orgCards = orgTarget.querySelector('#org-cards');
          renderCards(orgCards, normalizeItems(data.organizations || []), 'organizations', lang);
        }
      }

    } catch (err) {
      console.warn('Unable to load dynamic records', err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
