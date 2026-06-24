
(function(){
  'use strict';
  let campaigns=[];
  let settings={
    enabled:false, homepageEnabled:true, publicListEnabled:true,
    label:'Promoted public notice', label_de:'Hervorgehobene öffentliche Mitteilung',
    inactiveMessage:'Official campaigns are currently not active.',
    inactiveMessage_de:'Offizielle Kampagnen sind derzeit nicht aktiv.'
  };

  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function t(en,de){return lang()==='de'?de:en}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function $(id){return document.getElementById(id)}
  function val(id){const e=$(id);return e?e.value.trim():''}
  function setVal(id,v){const e=$(id);if(e)e.value=v||''}
  function checked(id){const e=$(id);return !!(e&&e.checked)}
  function setChecked(id,v){const e=$(id);if(e)e.checked=!!v}
  function makeId(){return 'campaign-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)}
  async function api(url,opts){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(opts||{})});
    const text=await r.text();
    if(!r.ok)throw new Error('HTTP '+r.status+': '+text.slice(0,200));
    try{return text?JSON.parse(text):{}}catch(e){throw new Error('Non-JSON: '+text.slice(0,120))}
  }
  function result(msg,ok=true){
    const el=$('campaign-save-result');
    if(el){el.className=ok?'form-saved':'form-error'; el.innerHTML=msg}
  }
  function statusBadgeClass(status){
    status=String(status||'draft').toLowerCase();
    if(status==='active') return 'label-success';
    if(status==='paused') return 'label-warning';
    if(status==='expired') return 'label-default';
    return 'label-info';
  }
  function titleOf(c){return lang()==='de'?(c.title_de||c.title||c.id):(c.title||c.title_de||c.id)}
  function summaryOf(c){return lang()==='de'?(c.summary_de||c.summary||''):(c.summary||c.summary_de||'')}
  function renderSettings(){
    setChecked('campaigns-enabled',settings.enabled===true);
    setChecked('campaign-homepage-enabled',settings.homepageEnabled!==false);
    setChecked('campaign-public-list-enabled',settings.publicListEnabled!==false);
    setVal('campaign-label',settings.label||'Promoted public notice');
    setVal('campaign-label-de',settings.label_de||'Hervorgehobene öffentliche Mitteilung');
    setVal('campaign-inactive',settings.inactiveMessage||'Official campaigns are currently not active.');
    setVal('campaign-inactive-de',settings.inactiveMessage_de||'Offizielle Kampagnen sind derzeit nicht aktiv.');
  }
  function visibilityNote(c){
    if((c.status||'draft')!=='active') return '';
    if(settings.enabled!==true){
      return `<p class="form-error">${esc(t('This campaign is active, but the Official Campaigns system is disabled. Enable the system above to show it publicly.','Diese Kampagne ist aktiv, aber das System für offizielle Kampagnen ist deaktiviert. Aktivieren Sie das System oben, damit sie öffentlich angezeigt wird.'))}</p>`;
    }
    return `<p class="form-saved">${esc(t('This campaign is active and can appear publicly if its placement and date range match.','Diese Kampagne ist aktiv und kann öffentlich erscheinen, wenn Platzierung und Zeitraum passen.'))}</p>`;
  }
  function actionButton(c){
    const status=String(c.status||'draft').toLowerCase();
    if(status==='active'){
      return `<button class="btn btn-warning btn-xs" data-status="paused" data-id="${esc(c.id)}" type="button">${t('Deactivate','Deaktivieren')}</button>`;
    }
    return `<button class="btn btn-primary btn-xs" data-status="active" data-id="${esc(c.id)}" type="button">${t('Activate','Aktivieren')}</button>`;
  }
  function render(){
    const box=$('campaign-items');
    box.innerHTML=campaigns.map(c=>`<article class="dashboard-record">
      <h2 class="h4">${esc(titleOf(c))}
        <span class="label label-info">${esc(c.campaignType||'public-service')}</span>
        <span class="label ${statusBadgeClass(c.status)}">${esc(c.status||'draft')}</span>
      </h2>
      <p class="meta">${esc(c.placement||'homepage')} | ${esc(c.sponsor||'')} | priority ${esc(c.priority||0)}</p>
      <p>${esc(summaryOf(c))}</p>
      ${visibilityNote(c)}
      <p>
        <button class="btn btn-default btn-xs" data-edit="${esc(c.id)}" type="button">${t('Edit','Bearbeiten')}</button>
        ${actionButton(c)}
        <button class="btn btn-default btn-xs" data-status="expired" data-id="${esc(c.id)}" type="button">${t('Expire','Ablaufen lassen')}</button>
      </p>
    </article>`).join('') || `<p>${t('No campaigns.','Keine Kampagnen.')}</p>`;
  }
  function edit(id){
    const c=campaigns.find(x=>x.id===id)||{};
    setVal('campaign-id',c.id||'');
    setVal('campaignType',c.campaignType||'public-service');
    setVal('status',c.status||'draft');
    setVal('placement',c.placement||'homepage');
    setVal('priority',String(c.priority||50));
    setVal('title',c.title||'');
    setVal('title_de',c.title_de||'');
    setVal('summary',c.summary||'');
    setVal('summary_de',c.summary_de||'');
    setVal('sponsor',c.sponsor||'');
    setVal('sponsor_de',c.sponsor_de||'');
    setVal('disclosure',c.disclosure||'Promoted public notice');
    setVal('disclosure_de',c.disclosure_de||'Hervorgehobene öffentliche Mitteilung');
    setVal('imageUrl',c.imageUrl||'');
    setVal('linkTitle',c.linkTitle||'');
    setVal('linkTitle_de',c.linkTitle_de||'');
    setVal('linkUrl',c.linkUrl||'');
    setVal('startDate',c.startDate||'');
    setVal('endDate',c.endDate||'');
  }
  function build(){
    const status=val('status')||'draft';
    return {
      id:val('campaign-id')||makeId(),
      campaignType:val('campaignType')||'public-service',
      status,
      publishStatus: status === 'active' || status === 'paused' ? 'published' : 'draft',
      placement:val('placement')||'homepage',
      priority:Number(val('priority')||0),
      title:val('title'),
      title_de:val('title_de')||val('title'),
      summary:val('summary'),
      summary_de:val('summary_de')||val('summary'),
      sponsor:val('sponsor'),
      sponsor_de:val('sponsor_de')||val('sponsor'),
      disclosure:val('disclosure')||'Promoted public notice',
      disclosure_de:val('disclosure_de')||val('disclosure')||'Hervorgehobene öffentliche Mitteilung',
      imageUrl:val('imageUrl'),
      linkTitle:val('linkTitle'),
      linkTitle_de:val('linkTitle_de')||val('linkTitle'),
      linkUrl:val('linkUrl'),
      startDate:val('startDate'),
      endDate:val('endDate')
    };
  }
  async function load(){
    try{
      const j=await api('/api/campaigns');
      campaigns=j.campaigns||[];
      settings=j.settings||settings;
      renderSettings();
      render();
      result(settings.enabled
        ? esc(t('Loaded. Official Campaigns system is enabled.','Geladen. Das System für offizielle Kampagnen ist aktiviert.'))
        : esc(t('Loaded. Official Campaigns system is disabled by default. Activate a campaign if you want, then enable the system above to show it publicly.','Geladen. Das System für offizielle Kampagnen ist standardmäßig deaktiviert. Aktivieren Sie bei Bedarf eine Kampagne und aktivieren Sie dann oben das System, damit sie öffentlich angezeigt wird.'))
      );
    }catch(e){result(esc(t('Could not load campaigns: ','Kampagnen konnten nicht geladen werden: ')+e.message),false)}
  }
  async function saveSettings(){
    const body={
      enabled:checked('campaigns-enabled'),
      homepageEnabled:checked('campaign-homepage-enabled'),
      publicListEnabled:checked('campaign-public-list-enabled'),
      label:val('campaign-label'),
      label_de:val('campaign-label-de'),
      inactiveMessage:val('campaign-inactive'),
      inactiveMessage_de:val('campaign-inactive-de')
    };
    const j=await api('/api/campaigns/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    settings=j.settings||body;
    renderSettings();
    render();
    result(settings.enabled
      ? esc(t('Campaign settings saved. Official Campaigns system is now enabled. Active campaigns can appear publicly.','Kampagneneinstellungen gespeichert. Das System für offizielle Kampagnen ist jetzt aktiviert. Aktive Kampagnen können öffentlich erscheinen.'))
      : esc(t('Campaign settings saved. Official Campaigns system is disabled, so no campaigns will appear publicly.','Kampagneneinstellungen gespeichert. Das System für offizielle Kampagnen ist deaktiviert, daher erscheinen keine Kampagnen öffentlich.'))
    );
  }
  async function save(){
    const item=build();
    const j=await api('/api/campaigns',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
    const idx=campaigns.findIndex(c=>c.id===j.campaign.id);
    if(idx>=0)campaigns[idx]=j.campaign; else campaigns.push(j.campaign);
    render(); edit('');
    result(esc(t('Campaign saved.','Kampagne gespeichert.')));
  }
  async function setStatus(id,status){
    const button=document.querySelector(`[data-id="${id}"][data-status="${status}"]`);
    if(button) button.disabled=true;
    try{
      const j=await api('/api/campaigns/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});
      const idx=campaigns.findIndex(c=>c.id===id);
      if(idx>=0)campaigns[idx]=j.campaign;
      render();
      if(status==='active'){
        result(settings.enabled
          ? esc(t('Campaign activated. It can now appear publicly if placement and date range match.','Kampagne aktiviert. Sie kann nun öffentlich erscheinen, wenn Platzierung und Zeitraum passen.'))
          : esc(t('Campaign activated, but the Official Campaigns system is still disabled. Enable the system above to show it publicly.','Kampagne aktiviert, aber das System für offizielle Kampagnen ist noch deaktiviert. Aktivieren Sie das System oben, damit sie öffentlich angezeigt wird.'))
        );
      }else if(status==='paused'){
        result(esc(t('Campaign deactivated. It will no longer appear publicly.','Kampagne deaktiviert. Sie wird nicht mehr öffentlich angezeigt.')));
      }else if(status==='expired'){
        result(esc(t('Campaign expired. It is now hidden from public placements.','Kampagne abgelaufen. Sie wird nun nicht mehr öffentlich platziert.')));
      }else{
        result(esc(t('Campaign status updated.','Kampagnenstatus aktualisiert.')));
      }
    }finally{
      if(button) button.disabled=false;
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('campaign-items').addEventListener('click',e=>{
      const b=e.target.closest('button'); if(!b)return;
      if(b.dataset.edit!==undefined)edit(b.dataset.edit);
      if(b.dataset.status!==undefined)setStatus(b.dataset.id,b.dataset.status).catch(err=>result(esc(err.message),false));
    });
    $('campaign-settings-form').addEventListener('submit',e=>{e.preventDefault();saveSettings().catch(err=>result(esc(err.message),false))});
    $('campaign-new').addEventListener('click',()=>edit(''));
    $('campaign-form').addEventListener('submit',e=>{e.preventDefault(); save().catch(err=>result(esc(err.message),false))});
    edit(''); load();
  });
})();
