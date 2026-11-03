'use strict';
/* Saves the time of a solved puzzle in the student account (shared Assiduité accounts). */
const URL_SB='https://dcnfxwtszqeqfaxlbfbl.supabase.co',KEY='sb_publishable_UTy7pKbk6xnw6mjRoy08GQ_5OuU1ymE',FN='/functions/v1/assiduite',SKEY='pz-session';
/* Some school filters block POST requests: the server function also accepts GET (data in the x-ec header). */
const modeGet={get(){try{return localStorage.getItem('pz-get')==='1'}catch{return false}},set(){try{localStorage.setItem('pz-get','1')}catch{}}};
function enBase64(o){const b=new TextEncoder().encode(JSON.stringify(o));let s='';b.forEach(c=>{s+=String.fromCharCode(c)});return btoa(s)}
async function timed(u,o){const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),15000);try{return await fetch(u,{...o,signal:ctl.signal,cache:'no-store'})}finally{clearTimeout(t)}}
async function retry(u,o){let last;for(let i=0;i<3;i++){try{return await timed(u,o)}catch(e){last=e;await new Promise(r=>setTimeout(r,700*(i+1)))}}console.warn('Network failure',u,last);throw Error('Impossible de joindre le serveur. Réessaie dans un instant.')}
async function refreshSession(s){const body={action:'refresh',refresh_token:s.refresh_token};let r;
  if(modeGet.get())r=await timed(URL_SB+FN,{method:'GET',headers:{apikey:KEY,'x-ec':enBase64(body)}}).catch(()=>null);
  if(!r)r=await retry(URL_SB+FN,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body)}).catch(()=>null);
  if(!r){r=await timed(URL_SB+FN,{method:'GET',headers:{apikey:KEY,'x-ec':enBase64(body)}});modeGet.set()}
  if(!r.ok)throw Error('Ta session a expiré. Reconnecte-toi dans ton espace de classe.');
  const n=await r.json();try{localStorage.setItem(SKEY,JSON.stringify(n))}catch{}try{sessionStorage.setItem(SKEY,JSON.stringify(n))}catch{}return n}
const resultNote=document.createElement('p');resultNote.setAttribute('role','status');resultNote.setAttribute('aria-live','polite');const retryResult=document.createElement('button');retryResult.textContent='Réessayer l’enregistrement';retryResult.hidden=true;const back=document.createElement('a');back.className='return-link';back.href='classe.html';back.textContent='Retour à mon compte élève';back.style.display='inline-block';back.style.margin='12px';const resultArea=document.createElement('div');resultArea.className='result-area';resultArea.style.marginTop='20px';resultArea.append(resultNote,retryResult,back);(document.querySelector('main')||document.body).append(resultArea);let pendingResult=null,busy=false;
async function saveResult(){if(busy||!pendingResult)return;busy=true;retryResult.disabled=true;retryResult.hidden=true;resultNote.textContent='Enregistrement de ton temps…';
 try{let session=null;try{session=JSON.parse(localStorage.getItem(SKEY)||sessionStorage.getItem(SKEY)||'null')}catch{}
  if(!session){resultNote.textContent='Connecte-toi et ouvre le puzzle depuis ton espace de classe pour enregistrer ton temps.';return}
  if(session.expires_at*1000<Date.now()+60000)session=await refreshSession(session);
  const send=s=>retry(URL_SB+'/rest/v1/rpc/pz_save_result',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_puzzle:pendingResult.puzzle,p_seconds:pendingResult.seconds})});
  let r=await send(session);if(r.status===401){session=await refreshSession(session);r=await send(session)}
  if(!r.ok){let m='';try{const d=await r.json();m=d.message||d.error||''}catch{}throw Error(m||'Enregistrement impossible.')}
  resultNote.textContent='Temps enregistré dans ton compte : '+Math.floor(pendingResult.seconds/60)+' min '+String(pendingResult.seconds%60).padStart(2,'0')+' s.';pendingResult=null}
 catch(e){resultNote.textContent='Ton temps n’a pas été enregistré. '+e.message;retryResult.hidden=false}
 finally{busy=false;retryResult.disabled=false}}
retryResult.onclick=saveResult;window.addEventListener('ec-puzzle-success',e=>{pendingResult={puzzle:new URLSearchParams(location.search).get('id'),seconds:Math.max(1,e.detail.seconds)};saveResult()});

window.addEventListener('ec-puzzle-reset',()=>{pendingResult=null;resultNote.textContent='';retryResult.hidden=true});
