
function lang(){return document.documentElement.lang === 'de' ? 'de' : 'en'}
function t(en,de){return lang()==='de'?de:en}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function fobj(f){var o={}; new FormData(f).forEach((v,k)=>o[k]=v); return o}
async function api(url, opts){
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(opts||{})});
  const text=await r.text();
  if(!r.ok) throw new Error('HTTP '+r.status+': '+text.slice(0,200));
  try{return text?JSON.parse(text):{}}
  catch(e){throw new Error('Non-JSON response: '+text.slice(0,120))}
}
function show(id, ok, msg){var el=document.getElementById(id); if(!el)return; el.className=ok?'form-saved':'form-error'; el.textContent=msg}
async function load(){
  try{
    const j=await api('/api/accounts');
    document.getElementById('accounts-body').innerHTML=(j.accounts||[]).map(u=>`<tr><td>${esc(u.username)}</td><td>${esc(u.displayName||'')}</td><td>${esc(u.email||'')}</td><td>${esc(u.accountType||'')}</td><td>${esc(u.createdAt||'')}</td></tr>`).join('');
  }catch(e){
    const body=document.getElementById('accounts-body');
    if(body) body.innerHTML='<tr><td colspan="5">'+esc(t('Could not load accounts. ','Konten konnten nicht geladen werden. ')+e.message)+'</td></tr>';
  }
}
document.addEventListener('DOMContentLoaded',()=>{
  load();
  var f=document.getElementById('admin-account-form');
  if(!f) return;
  f.addEventListener('submit',async e=>{
    e.preventDefault();
    try{
      const j=await api('/api/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fobj(f))});
      show('admin-account-result',true,t('Account created.','Konto erstellt.'));
      f.reset(); load();
    }catch(err){
      show('admin-account-result',false,t('Unable to create account. ','Konto konnte nicht erstellt werden. ')+err.message);
    }
  })
});
