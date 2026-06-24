
function escapeHtml(s){
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
async function load(){
  const el = document.getElementById('advanced-status');
  try{
    const r = await fetch('/api/content', {credentials:'same-origin', cache:'no-store'});
    const text = await r.text();
    if(!r.ok) throw new Error('GET /api/content returned HTTP ' + r.status + ': ' + text.slice(0,300));
    JSON.parse(text);
    document.getElementById('json').value = JSON.stringify(JSON.parse(text), null, 2);
    if(el) el.textContent = 'Connected to admin API.';
  }catch(err){
    if(el) el.innerHTML = 'API connection failed. ' + escapeHtml(err.message || err);
  }
}
document.getElementById('format-json').addEventListener('click', () => {
  try{
    document.getElementById('json').value = JSON.stringify(JSON.parse(document.getElementById('json').value), null, 2);
  }catch(e){ alert(e.message); }
});
document.getElementById('save-json').addEventListener('click', async () => {
  const el = document.getElementById('advanced-status');
  try{
    const body = JSON.parse(document.getElementById('json').value);
    const r = await fetch('/api/content', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const text = await r.text();
    if(!r.ok) throw new Error('POST /api/content returned HTTP ' + r.status + ': ' + text.slice(0,300));
    if(el) el.textContent = 'Saved.';
  }catch(e){
    if(el) el.innerHTML = 'Save failed. ' + escapeHtml(e.message || e);
  }
});
load();
