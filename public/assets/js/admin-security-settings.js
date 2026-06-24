(function(){
  'use strict';
  function lang(){return document.documentElement.lang==='de'?'de':'en'}
  function t(en,de){return lang()==='de'?de:en}
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  async function api(url, opts){
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(opts||{})});
    const text=await r.text();
    let body={};
    try{body=text?JSON.parse(text):{}}catch(e){}
    if(!r.ok) throw new Error(body.error || text.slice(0,200) || ('HTTP '+r.status));
    return body;
  }
  function result(id, ok, msg){
    const el=document.getElementById(id);
    if(!el)return;
    el.className=ok?'form-saved':'form-error';
    el.innerHTML=esc(msg);
  }
  function nextUrl(){
    const p=new URLSearchParams(location.search);
    const n=p.get('next') || '/dashboard/';
    return n.startsWith('/dashboard/') ? n : '/dashboard/';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const pw=document.getElementById('change-password-form');
    if(pw){
      pw.addEventListener('submit',async e=>{
        e.preventDefault();
        const n=pw.newPassword.value;
        const c=pw.confirmPassword.value;
        if(n!==c) return result('password-result',false,t('New passwords do not match.','Neue Passwörter stimmen nicht überein.'));
        try{
          await api('/admin-auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:pw.currentPassword.value,newPassword:n})});
          result('password-result',true,t('Password changed.','Passwort geändert.'));
          pw.reset();
          setTimeout(()=>location.replace(nextUrl()),800);
        }catch(err){result('password-result',false,t('Password change failed. ','Passwortänderung fehlgeschlagen. ')+(err.message||err));}
      });
    }

    const setup=document.getElementById('mfa-setup');
    if(setup){
      setup.addEventListener('click',async()=>{
        try{
          const j=await api('/admin-auth/mfa/setup');
          document.getElementById('mfa-secret').textContent=j.secret;
          document.getElementById('mfa-otpauth').value=j.otpauth;
          document.getElementById('mfa-panel').classList.remove('hidden');
          result('mfa-result',true,t('Add this secret to an authenticator app, then enter the 6-digit code.','Dieses Geheimnis in eine Authenticator-App eintragen und dann den 6-stelligen Code eingeben.'));
        }catch(err){result('mfa-result',false,t('Could not start 2FA setup. ','2FA-Einrichtung konnte nicht gestartet werden. ')+(err.message||err));}
      });
    }

    const enable=document.getElementById('mfa-enable');
    if(enable){
      enable.addEventListener('click',async()=>{
        try{
          await api('/admin-auth/mfa/enable',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:document.getElementById('mfa-code').value})});
          result('mfa-result',true,t('Two-factor authentication enabled.','Zwei-Faktor-Authentifizierung aktiviert.'));
          document.getElementById('mfa-panel').classList.add('hidden');
        }catch(err){result('mfa-result',false,t('Could not enable 2FA. ','2FA konnte nicht aktiviert werden. ')+(err.message||err));}
      });
    }

    const disable=document.getElementById('mfa-disable-form');
    if(disable){
      disable.addEventListener('submit',async e=>{
        e.preventDefault();
        try{
          await api('/admin-auth/mfa/disable',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:disable.password.value})});
          result('mfa-result',true,t('Two-factor authentication disabled.','Zwei-Faktor-Authentifizierung deaktiviert.'));
          disable.reset();
        }catch(err){result('mfa-result',false,t('Could not disable 2FA. ','2FA konnte nicht deaktiviert werden. ')+(err.message||err));}
      });
    }
  });
})();
