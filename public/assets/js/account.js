
function formObj(form){var o={}; new FormData(form).forEach(function(v,k){o[k]=v}); return o}
function lang(){return document.documentElement.lang === 'de' ? 'de' : 'en'}
function t(key){
  var de={
    disabled:'Kontoerstellung ist deaktiviert. Kontaktieren Sie die Separated Kingdom Hotline 1900-2803, um ein Konto zu registrieren.',
    unable:'Aktion konnte nicht abgeschlossen werden.',
    invalid:'Ungültiger Benutzername oder ungültiges Passwort.',
    signed:'Angemeldet als ',
    noRequests:'Keine Serviceanfragen für dieses Konto gefunden.',
    loadError:'Serviceanfragen konnten nicht geladen werden.',
    signInFirst:'Melden Sie sich an, um Serviceanfragen anzuzeigen.'
  };
  var en={
    disabled:'Creating accounts is disabled, contact Separated Kingdom 1900-2803 hotline to register an account.',
    unable:'Unable to complete action.',
    invalid:'Invalid username or password.',
    signed:'Signed in as ',
    noRequests:'No service requests found for this account.',
    loadError:'Could not load service requests.',
    signInFirst:'Sign in to view service requests.'
  };
  return (lang()==='de'?de:en)[key]||key;
}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function result(id, ok, txt){var el=document.getElementById(id); if(!el) return; el.className=ok?'form-saved':'form-error'; el.textContent=txt}
function typeLabel(x){
  if(lang()!=='de') return x||'';
  if(x==='permit') return 'Genehmigung';
  if(x==='report') return 'Meldung';
  return x||'';
}
function renderRequests(requests){
  var body=document.getElementById('my-requests-body');
  if(!body) return;
  if(!requests || !requests.length){
    body.innerHTML='<tr><td colspan="5">'+esc(t('noRequests'))+'</td></tr>';
    return;
  }
  body.innerHTML=requests.map(function(r){
    return '<tr><td>'+esc(r.reference)+'</td><td>'+esc(typeLabel(r.requestType))+'</td><td>'+esc(r.location||'')+'</td><td>'+esc(r.status||'')+'</td><td>'+esc(r.createdAt||'')+'</td></tr>';
  }).join('');
}
function loadMyRequests(token){
  var body=document.getElementById('my-requests-body');
  if(!body) return;
  if(!token){body.innerHTML='<tr><td colspan="5">'+esc(t('signInFirst'))+'</td></tr>'; return;}
  fetch('/account-api/my-requests',{credentials:'same-origin',cache:'no-store',headers:{'Authorization':'Bearer '+token}})
    .then(function(r){return r.text().then(function(text){return {ok:r.ok,status:r.status,text:text}})})
    .then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status+': '+r.text.slice(0,160));
      renderRequests(JSON.parse(r.text).requests||[]);
    })
    .catch(function(e){
      body.innerHTML='<tr><td colspan="5">'+esc(t('loadError')+' '+e.message)+'</td></tr>';
    });
}
document.addEventListener('DOMContentLoaded',function(){
  var reg=document.getElementById('register-form');
  if(reg){
    var submit=reg.querySelector('button[type="submit"]');
    if(submit) submit.textContent = lang()==='de' ? 'Registrierung über Hotline erforderlich' : 'Registration by hotline required';
    reg.addEventListener('submit',function(e){
      e.preventDefault();
      result('register-result',false,t('disabled'));
    });
  }

  var login=document.getElementById('login-form');
  var existingToken=localStorage.getItem('skToken')||'';
  loadMyRequests(existingToken);
  if(login) login.addEventListener('submit',function(e){
    e.preventDefault();
    fetch('/account-api/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(formObj(login))})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
      .then(function(r){
        if(r.ok){
          localStorage.setItem('skToken',r.j.token);
          localStorage.setItem('skDisplayName',r.j.displayName||'');
          result('login-result',true,t('signed')+(r.j.displayName||''));
          loadMyRequests(r.j.token);
        } else {
          result('login-result',false,r.j.error||t('invalid'));
        }
      })
      .catch(function(){result('login-result',false,t('unable'))});
  });
});
