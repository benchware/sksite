
function lang(){return document.documentElement.lang === 'de' ? 'de' : 'en'}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function t(en,de){return lang()==='de'?de:en}
function typeLabel(x, access){if(lang()!=='de'){ if(x==='permit')return 'Transit permit'; if(x==='report')return 'Infrastructure report'; if(x==='records')return access==='private'?'Private record':'Public record'; return x||'';} if(x==='permit')return 'Transit-Genehmigung'; if(x==='report')return 'Infrastrukturmeldung'; if(x==='records')return access==='private'?'Private Akte':'Öffentliche Akte'; return x||''}
async function api(url,opts){
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(opts||{})});
  const text=await r.text();
  if(!r.ok)throw new Error('HTTP '+r.status+': '+text.slice(0,200));
  try{return text?JSON.parse(text):{}}catch(e){throw new Error('Non-JSON response: '+text.slice(0,120))}
}
let REQUESTS=[];
function detailLines(x){
  const lines = [];
  if(x.recordAccessType) lines.push([t('Record access','Aktenzugriff'), x.recordAccessType]);
  if(x.recordTag) lines.push([t('Record tag / case number','Aktenzeichen / Fallnummer'), x.recordTag]);
  if(x.issueType) lines.push([t('Issue type','Problemart'), x.issueType]);
  if(x.permitClass) lines.push([t('Permit class','Genehmigungsklasse'), x.permitClass]);
  if(x.identityNote) lines.push([t('Identity / authority note','Identitäts- / Berechtigungshinweis'), x.identityNote]);
  if(x.details) lines.push([t('Details','Details'), x.details]);
  return lines.map(([k,v])=>`<p><strong>${esc(k)}:</strong><br>${esc(v)}</p>`).join('') || '<p class="text-muted">'+esc(t('No details supplied.','Keine Details angegeben.'))+'</p>';
}
function render(){
  const body=document.getElementById('requests-body');
  body.innerHTML=(REQUESTS||[]).map(x=>`<tr>
    <td><code>${esc(x.reference)}</code></td>
    <td>${esc(typeLabel(x.requestType,x.recordAccessType))}</td>
    <td>${esc(x.fullName||'')}<br><small>${esc(x.email||'')}</small></td>
    <td>${esc(x.location||'')}</td>
    <td class="dashboard-request-details">${detailLines(x)}</td>
    <td>${esc(x.status||'')}</td>
    <td>${esc(x.createdAt||'')}</td>
    <td>
      <label class="wb-inv" for="status-${esc(x.reference)}">${esc(t('Status','Status'))}</label>
      <select id="status-${esc(x.reference)}" class="form-control input-sm" data-status-for="${esc(x.reference)}">
        ${['Submitted','In review','Approved','Declined','Closed'].map(s=>`<option value="${esc(s)}"${s===(x.status||'Submitted')?' selected':''}>${esc(s)}</option>`).join('')}
      </select>
      <label class="small mrgn-tp-sm" for="note-${esc(x.reference)}">${esc(t('Decision note shown to user','Entscheidungsnotiz für Benutzer'))}</label>
      <textarea id="note-${esc(x.reference)}" class="form-control input-sm" rows="3" data-note-for="${esc(x.reference)}" placeholder="${esc(t('Example: Approved. The record can be collected at...', 'Beispiel: Genehmigt. Die Akte kann abgeholt werden bei...'))}">${esc(x.decisionNote||'')}</textarea>
      <button class="btn btn-primary btn-xs mrgn-tp-sm" data-save-status="${esc(x.reference)}" type="button">${esc(t('Save status','Status speichern'))}</button>
    </td>
  </tr>`).join('')||`<tr><td colspan="8">${esc(t('No service requests.','Keine Serviceanfragen.'))}</td></tr>`;
}
async function load(){
  const body=document.getElementById('requests-body');
  try{const j=await api('/api/requests'); REQUESTS=j.requests||[]; render();}
  catch(e){if(body)body.innerHTML='<tr><td colspan="8">'+esc(t('Could not load requests. ','Anfragen konnten nicht geladen werden. ')+e.message)+'</td></tr>'}
}
document.addEventListener('DOMContentLoaded',()=>{
  const body=document.getElementById('requests-body');
  if(body)body.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b||b.dataset.saveStatus===undefined)return;
    const ref=b.dataset.saveStatus;
    const status=document.querySelector('[data-status-for="'+ref.replace(/"/g,'\\"')+'"]').value;
    const note=document.querySelector('[data-note-for="'+ref.replace(/"/g,'\\"')+'"]').value;
    api('/api/requests/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference:ref,status,note})})
      .then(()=>load())
      .catch(err=>alert(err.message));
  });
  load();
});
