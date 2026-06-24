
(function(){
  'use strict';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function safeHref(url){const u=String(url||'').trim(); if(!u)return''; if(u.startsWith('/')||/^https?:\/\//i.test(u))return u; return''}
  function titleOf(c){return lang()==='de'?(c.title_de||c.title||''):(c.title||c.title_de||'')}
  function summaryOf(c){return lang()==='de'?(c.summary_de||c.summary||''):(c.summary||c.summary_de||'')}
  function sponsorOf(c){return lang()==='de'?(c.sponsor_de||c.sponsor||''):(c.sponsor||c.sponsor_de||'')}
  function disclosureOf(c,settings){return lang()==='de'?(c.disclosure_de||c.disclosure||settings.label_de||'Hervorgehobene öffentliche Mitteilung'):(c.disclosure||c.disclosure_de||settings.label||'Promoted public notice')}
  function linkTitleOf(c){return lang()==='de'?(c.linkTitle_de||c.linkTitle||c.linkUrl||''):(c.linkTitle||c.linkTitle_de||c.linkUrl||'')}
  function active(c){
    const today=new Date().toISOString().slice(0,10);
    if(c.publishStatus&&c.publishStatus!=='published')return false;
    if(String(c.status||'').toLowerCase()!=='active')return false;
    if(c.startDate&&c.startDate>today)return false;
    if(c.endDate&&c.endDate<today)return false;
    return true;
  }
  function card(c,settings){
    const href=safeHref(c.linkUrl);
    const isElection=String(c.campaignType||'').toLowerCase()==='election';
    return `<article class="sk-campaign-card ${isElection?'sk-campaign-election':''}">
      <div class="sk-campaign-label">${esc(disclosureOf(c,settings))}</div>
      <h2 class="h3">${esc(titleOf(c))}</h2>
      <p class="meta">${esc(sponsorOf(c))}${c.endDate?' | '+esc((lang()==='de'?'Bis ':'Until ')+c.endDate):''}</p>
      <p>${esc(summaryOf(c))}</p>
      ${href?`<p><a class="btn btn-default btn-sm" href="${esc(href)}">${esc(linkTitleOf(c)||href)}</a></p>`:''}
    </article>`;
  }
  function render(data){
    const settings=data.campaignSettings||{};
    const list=(Array.isArray(data.campaigns)?data.campaigns:[]).filter(active).sort((a,b)=>Number(b.priority||0)-Number(a.priority||0));
    const campaignBox=document.querySelector('[data-campaigns-list]');
    const electionBox=document.querySelector('[data-election-campaigns]');
    if(campaignBox){
      if(settings.enabled!==true || settings.publicListEnabled===false){
        campaignBox.innerHTML=`<article class="sk-campaign-card"><div class="sk-campaign-label">${esc(lang()==='de'?'Inaktiv':'Inactive')}</div><p>${esc(lang()==='de'?(settings.inactiveMessage_de||'Offizielle Kampagnen sind derzeit nicht aktiv.'):(settings.inactiveMessage||'Official campaigns are currently not active.'))}</p></article>`;
      }else{
        campaignBox.innerHTML=list.length?list.map(c=>card(c,settings)).join(''):`<p>${lang()==='de'?'Keine aktiven Kampagnen.':'No active campaigns.'}</p>`;
      }
    }
    if(electionBox){
      const elections=list.filter(c=>String(c.campaignType||'').toLowerCase()==='election');
      if(settings.enabled!==true || settings.publicListEnabled===false){
        electionBox.innerHTML=`<p>${esc(lang()==='de'?'Offizielle Wahlkampagnenplätze sind derzeit nicht aktiv.':'Official election campaign placements are currently not active.')}</p>`;
      }else{
        electionBox.innerHTML=elections.length?elections.map(c=>card(c,settings)).join(''):`<p>${lang()==='de'?'Keine aktiven Wahlmitteilungen.':'No active election notices.'}</p>`;
      }
    }
  }
  function init(){
    if(!document.querySelector('[data-campaigns-list], [data-election-campaigns]'))return;
    fetch('/assets/data/site-data.json',{cache:'no-store'}).then(r=>r.json()).then(render).catch(e=>{
      const box=document.querySelector('[data-campaigns-list], [data-election-campaigns]');
      if(box) box.innerHTML='<p>Campaigns could not be loaded.</p>';
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
