'use strict';
/* Classroom space of "Mille et une pièces".
   Sign-in uses the same accounts, classes and students as Assiduité, Habiletés and TEJ2O
   ("assiduite" server function). Puzzle data goes through the pz_* database functions. */
const URL_SB='https://dcnfxwtszqeqfaxlbfbl.supabase.co',KEY='sb_publishable_UTy7pKbk6xnw6mjRoy08GQ_5OuU1ymE',FN='/functions/v1/assiduite';
const puzzles=Object.fromEntries(Object.entries(EC_CATALOG).map(([id,p])=>[id,p.name+' · '+(p.category?p.category+' · ':'')+p.size+' × '+p.size]));
/* The session stays on this device until "Se déconnecter". */
const SKEY='pz-session';
const store={get(){try{return localStorage.getItem(SKEY)||sessionStorage.getItem(SKEY)}catch{return null}},set(v){try{localStorage.setItem(SKEY,v)}catch{}try{sessionStorage.setItem(SKEY,v)}catch{}},del(){try{localStorage.removeItem(SKEY)}catch{}try{sessionStorage.removeItem(SKEY)}catch{}}};
let session;try{session=JSON.parse(store.get()||'null')}catch{session=null}
try{localStorage.removeItem('ec-session');sessionStorage.removeItem('ec-session')}catch{}
const el=id=>document.getElementById(id);const say=t=>el('notice').textContent=t;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(s){if(s&&!s.expires_at&&s.expires_in)s.expires_at=Math.floor(Date.now()/1000)+s.expires_in;session=s;if(s)store.set(JSON.stringify(s));else store.del()}
const NET_MSG='Impossible de joindre le serveur. Attends quelques secondes et réessaie. Si ça continue, préviens ton enseignant(e).';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- Server calls ---------- */
/* Some school filters block POST requests: the server function also accepts GET (data in the x-ec header).
   The device remembers it for the next times. */
const modeGet={get(){try{return localStorage.getItem('pz-get')==='1'}catch{return false}},set(){try{localStorage.setItem('pz-get','1')}catch{}}};
function enBase64(o){const b=new TextEncoder().encode(JSON.stringify(o));let s='';b.forEach(c=>{s+=String.fromCharCode(c)});return btoa(s)}
async function timed(url,opts){const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),15000);try{return await fetch(url,{...opts,signal:ctl.signal,cache:'no-store'})}finally{clearTimeout(t)}}
async function lire(r){let d;try{d=await r.json()}catch{throw Error(r.ok?'Réponse inattendue du serveur. Réessaie.':'Le serveur a refusé la demande (code '+r.status+'). Réessaie.')}if(!r.ok||(d&&d.error&&typeof d.error==='string'))throw Error((d&&(d.error||d.message||d.msg))||'Action impossible. Réessaie.');return d}
async function fn(body,token){
  const h={apikey:KEY,...(token?{Authorization:'Bearer '+token}:{})};let r,last;
  if(modeGet.get()){try{r=await timed(URL_SB+FN,{method:'GET',headers:{...h,'x-ec':enBase64(body)}})}catch(e){last=e}}
  for(let i=0;i<3&&!r;i++){try{r=await timed(URL_SB+FN,{method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify(body)})}catch(e){last=e;await sleep(700*(i+1))}}
  if(!r){try{r=await timed(URL_SB+FN,{method:'GET',headers:{...h,'x-ec':enBase64(body)}});modeGet.set()}catch(e){last=e}}
  if(!r){console.warn('Network failure',last);throw Error(NET_MSG)}
  return lire(r);
}
async function refresh(){try{save(await fn({action:'refresh',refresh_token:session.refresh_token}))}catch(e){if(e.message!==NET_MSG){save(null);throw Error('Ta session a expiré. Reconnecte-toi.')}throw e}}
async function rpc(name,args={}){
  if(!session)throw Error('Connecte-toi pour continuer.');
  if(session.expires_at*1000<Date.now()+60000)await refresh();
  let r,last;
  for(let i=0;i<3&&!r;i++){try{r=await timed(URL_SB+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(args)})}catch(e){last=e;await sleep(700*(i+1))}}
  if(!r){console.warn('Network failure',last);throw Error(NET_MSG)}
  if(r.status===401){await refresh();return rpc(name,args)}
  if(r.status===204)return null;
  return lire(r);
}
async function run(box,f){const buttons=box.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);say('');try{await f()}catch(e){say(e.message)}finally{buttons.forEach(b=>b.disabled=false)}}

/* ---------- Sign-in (same as Assiduité and TEJ2O) ---------- */
const UI={tab:new URLSearchParams(location.search).get('role')==='teacher'?'prof':new URLSearchParams(location.search).get('role')==='student'?'eleve':'',mode:'login',prefill:null,info:null,forgotQ:null};
const GUIDE={eleve:{premiere:[
 {v:'',c:'.role[data-tab="eleve"]',t:'Sur cette page, clique sur',b:'Je suis élève',f:'Clique ici'},
 {v:'eleve',m:'login',c:'[data-mode="identify"]',t:'Clique sur le lien',b:'S’identifier pour recevoir mon mot de passe',f:'Clique ici'},
 {v:'eleve',m:'identify',c:'#lFirst,#lLast',t:'Écris ton prénom, puis ton nom.',f:'Écris ici'},
 {v:'eleve',m:'identify',c:'#loginBtn',t:'Clique sur le bouton',b:'S’identifier',f:'Clique ici'},
 {t:'Ton mot de passe s’affiche pendant 30 secondes, une seule fois. Prends une capture d’écran ou écris-le sur une feuille.',ic:'📸'},
 {t:'Ensuite, connecte-toi : regarde « Les autres fois ».',ic:'➡️'}],
 ensuite:[
 {v:'',c:'.role[data-tab="eleve"]',t:'Sur cette page, clique sur',b:'Je suis élève',f:'Clique ici'},
 {v:'eleve',m:'login',c:'#lFirst,#lLast',t:'Écris ton prénom et ton nom.',f:'Écris ici'},
 {v:'eleve',m:'login',c:'#lPass',t:'Écris ton mot de passe (celui de ta capture d’écran).',f:'Écris ici'},
 {v:'eleve',m:'login',c:'#loginBtn',t:'Clique sur le bouton',b:'Se connecter',f:'Clique ici'},
 {t:'C’est le même mot de passe que pour Assiduité, Habiletés et TEJ2O. Si tu l’as déjà récupéré là-bas, connecte-toi directement.',ic:'🔑'}]},
 prof:{premiere:[
 {v:'',c:'.role[data-tab="prof"]',t:'Sur cette page, clique sur',b:'Je suis enseignant(e)',f:'Clique ici'},
 {v:'prof',m:'login',c:'[data-mode="signup"]',t:'Clique sur le lien',b:'Créer un compte',f:'Clique ici'},
 {v:'prof',m:'signup',c:'#lFirst,#lLast',t:'Écris ton prénom, puis ton nom.',f:'Écris ici'},
 {v:'prof',m:'signup',c:'#lPass,#lPass2',t:'Choisis ton mot de passe (8 caractères ou plus) et écris-le deux fois.',f:'Écris ici'},
 {v:'prof',m:'signup',c:'#lQ,#lA',t:'Écris une question secrète et sa réponse. Elles te serviront si tu oublies ton mot de passe.',f:'Écris ici'},
 {v:'prof',m:'signup',c:'#loginBtn',t:'Clique sur le bouton',b:'Créer mon compte',f:'Clique ici'},
 {t:'Attends que Mme Hakima approuve ton compte. Ensuite, connecte-toi comme dans « Les autres fois ».',ic:'⏳'}],
 ensuite:[
 {v:'',c:'.role[data-tab="prof"]',t:'Sur cette page, clique sur',b:'Je suis enseignant(e)',f:'Clique ici'},
 {v:'prof',m:'login',c:'#lFirst,#lLast',t:'Écris ton prénom et ton nom.',f:'Écris ici'},
 {v:'prof',m:'login',c:'#lPass',t:'Écris ton mot de passe.',f:'Écris ici'},
 {v:'prof',m:'login',c:'#loginBtn',t:'Clique sur le bouton',b:'Se connecter',f:'Clique ici'},
 {t:'C’est le même compte et le même mot de passe que pour Assiduité, Habiletés et TEJ2O.',ic:'🔑'}]}};
let gMin=null,gJeton=0;
const gRole=()=>UI.tab||UI.guideRole||'eleve', gQuand=()=>UI.guideQuand||(UI.mode==='identify'?'premiere':UI.tab==='eleve'&&UI.mode==='login'?'ensuite':'premiere'), gListe=()=>GUIDE[gRole()][gQuand()];
function guideHtml(){const r=gRole(),q=gQuand(),L=gListe();let n=0;
 return`<aside class="guide pz-panel" aria-label="Comment me connecter"><h2>🧭 Comment me connecter ?</h2>
 ${!UI.tab?`<div class="pz-tabs"><button type="button" class="pz-tab ${r==='eleve'?'on':''}" data-grole="eleve">Je suis élève</button><button type="button" class="pz-tab ${r==='prof'?'on':''}" data-grole="prof">Je suis enseignant(e)</button></div>`:''}
 <div class="pz-tabs"><button type="button" class="pz-tab ${q==='premiere'?'on':''}" data-gquand="premiere">${r==='eleve'?'1. La première fois : s’identifier':'La première fois'}</button><button type="button" class="pz-tab ${q==='ensuite'?'on':''}" data-gquand="ensuite">${r==='eleve'?'2. Les autres fois : se connecter':'Les autres fois'}</button></div>
 <ol class="g-etapes">${L.map((o,i)=>`<li data-gi="${i}"><span class="g-num">${o.ic?o.ic:++n}</span><div>${esc(o.t)}${o.b?` <span class="g-chip">${esc(o.b)}</span>`:''}</div>${o.c?`<button type="button" class="secondary small g-voir" data-gvoir="${i}">👉 Montre-moi</button>`:''}</li>`).join('')}</ol>
 <button type="button" data-gtout="1">▶ Montre-moi toutes les étapes</button></aside>`}
function guideEffacer(){clearTimeout(gMin);gMin=null;document.querySelectorAll('.g-fleche').forEach(e=>e.remove());document.querySelectorAll('.g-cible').forEach(e=>e.classList.remove('g-cible'));document.querySelectorAll('.g-etapes li.g-actif').forEach(e=>e.classList.remove('g-actif'))}
function guideAller(o){if(o.v===undefined)return;if(o.v===''){if(UI.tab){UI.guideRole=UI.tab;UI.tab='';UI.mode='login';UI.prefill=null;renderLogin()}return}
 if(UI.tab!==o.v||UI.mode!==o.m){UI.tab=o.v;UI.mode=o.m;UI.prefill=null;UI.info=null;UI.forgotQ=null;renderLogin()}}
function guideMontrer(i){guideEffacer();UI.guideRole=gRole();UI.guideQuand=gQuand();const o=gListe()[i];if(!o)return;guideAller(o);
 const li=document.querySelector(`.g-etapes li[data-gi="${i}"]`);if(li)li.classList.add('g-actif');if(!o.c)return;
 const t=[...document.querySelectorAll(o.c)];if(!t.length)return;t.forEach(e=>e.classList.add('g-cible'));t[0].scrollIntoView({block:'center',behavior:'smooth'});
 const j=++gJeton;setTimeout(()=>{if(j===gJeton)guidePlacer(t[0],o.f||'Clique ici')},450)}
function guidePlacer(target,txt){document.querySelectorAll('.g-fleche').forEach(e=>e.remove());const r=target.getBoundingClientRect(),dessous=r.top<110,d=document.createElement('div');
 d.className='g-fleche'+(dessous?' dessous':'');d.setAttribute('aria-hidden','true');d.innerHTML=`<span class="g-bulle">${esc(txt)}</span><svg viewBox="0 0 60 70" width="54" height="63"><path d="M22 2h16v38h16L30 68 6 40h16z" fill="#e8553d" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>`;
 document.body.append(d);const w=d.offsetWidth,h=d.offsetHeight,x=Math.max(6,Math.min(innerWidth-w-6,r.left+Math.min(r.width/2,120)-w/2));d.style.left=x+scrollX+'px';d.style.top=(dessous?r.bottom+6:r.top-h-6)+scrollY+'px'}
function guideTout(){const L=gListe();let i=0;const suite=()=>{if(i>=L.length){gMin=setTimeout(guideEffacer,2500);return}guideMontrer(i);i++;gMin=setTimeout(suite,3200)};suite()}

function renderLogin(err){
 guideEffacer();const box=el('login');el('dashboard').hidden=true;box.hidden=false;
 const entete=`<p class="pz-lead">Connexion avec ton prénom, ton nom et ton mot de passe. C’est le même compte que pour Assiduité, Habiletés et TEJ2O.</p>`;
 if(!UI.tab){
  box.innerHTML=entete+(err?`<div class="pz-msg err">${esc(err)}</div>`:'')+`<div class="roles"><button type="button" class="role" data-tab="eleve"><span class="ico">🎒</span><b>Je suis élève</b><span>Je fais les puzzles partagés par mon enseignant(e).</span></button><button type="button" class="role" data-tab="prof"><span class="ico">🧑‍🏫</span><b>Je suis enseignant(e)</b><span>Je partage des puzzles et je vois les résultats.</span></button></div>
  <div class="pz-panel"><b>🎒 Élève : 2 étapes</b><ol><li><b>La première fois</b>, clique sur « Je suis élève », puis sur <b>« S’identifier »</b> : ton mot de passe s’affiche une seule fois. Note-le !</li><li><b>Les autres fois</b>, clique sur « Je suis élève » et <b>« Se connecter »</b> avec ton prénom, ton nom et ce mot de passe.</li></ol><small>Tu as déjà ton mot de passe d’Assiduité, d’Habiletés ou de TEJ2O ? C’est le même : connecte-toi directement.</small></div>`+guideHtml();
  return;
 }
 const eleve=UI.tab==='eleve',m=UI.mode,ident=eleve&&m==='identify',sg=!eleve&&m==='signup',fg=!eleve&&m==='forgot',q=fg?UI.forgotQ:null;
 const titre=eleve?(ident?'Première connexion':'Espace élève'):sg?'Créer mon compte':fg?'Mot de passe oublié':'Espace enseignant';
 const intro=eleve?(ident?'Écris ton prénom et ton nom. Ton mot de passe s’affichera pendant 30 secondes, une seule fois : prends une capture d’écran ou écris-le.':'Connecte-toi avec ton prénom, ton nom et ton mot de passe. Pas encore de mot de passe ? Clique d’abord sur « S’identifier » plus bas.')
  :sg?'Choisis ton mot de passe et une question secrète. Ton compte sera actif dès que Mme Hakima l’aura approuvé. Ce compte sert aussi pour Assiduité, Habiletés et TEJ2O.'
  :fg?(q?'Réponds à ta question secrète, puis choisis un nouveau mot de passe.':'Écris ton prénom et ton nom pour afficher ta question secrète.'):'Connecte-toi avec ton prénom, ton nom et ton mot de passe (le même que dans Assiduité).';
 const ro=fg&&q?' readonly':'';
 const champ=(id,lab,type,auto,extra='')=>`<label for="${id}">${lab}<input type="${type}" id="${id}" autocomplete="${auto}"${extra} required></label>`;
 let plus='';
 if(sg)plus=champ('lPass','Mot de passe (8 caractères ou plus)','password','new-password',' minlength="8"')+champ('lPass2','Confirme le mot de passe','password','new-password',' minlength="8"')+champ('lQ','Question secrète','text','off',' maxlength="200" placeholder="Ex. : Le nom de ma première école ?"')+champ('lA','Réponse','text','off',' maxlength="200"');
 else if(fg&&q)plus=`<p class="pz-q">Ta question secrète : <b>${esc(q)}</b></p>`+champ('lA','Ta réponse','text','off',' maxlength="200"')+champ('lPass','Nouveau mot de passe (8 caractères ou plus)','password','new-password',' minlength="8"')+champ('lPass2','Confirme le nouveau mot de passe','password','new-password',' minlength="8"');
 else if(!ident&&!fg)plus=champ('lPass','Mot de passe','password','current-password');
 const bouton=ident?'S’identifier':sg?'Créer mon compte':fg?(q?'Changer mon mot de passe':'Afficher ma question'):'Se connecter';
 const liens=eleve?(ident?'Tu as déjà ton mot de passe ? <button type="button" class="link" data-mode="login">Se connecter</button>':'Première connexion ? <button type="button" class="link" data-mode="identify">S’identifier pour recevoir mon mot de passe</button><br>Mot de passe oublié ? Demande à ton enseignant(e) de t’en donner un nouveau.')
  :(sg||fg?'Tu as déjà un compte ? <button type="button" class="link" data-mode="login">Se connecter</button>':'Pas encore de compte ? <button type="button" class="link" data-mode="signup">Créer un compte</button><br>Mot de passe oublié ? <button type="button" class="link" data-mode="forgot">Répondre à ma question secrète</button>');
 box.innerHTML=entete+`<div class="pz-login"><button type="button" class="link" data-tab="">← ${eleve?'Je ne suis pas élève':'Je ne suis pas enseignant(e)'}</button><h2>${eleve?'🎒':'🧑‍🏫'} ${titre}</h2><p>${intro}</p>${UI.info?`<div class="pz-msg ok">${esc(UI.info)}</div>`:''}${err?`<div class="pz-msg err">${esc(err)}</div>`:''}
 <form id="loginForm" autocomplete="on"><label for="lFirst">Prénom<input id="lFirst" autocomplete="given-name" maxlength="100" value="${esc(UI.prefill?.first||'')}"${ro} required></label><label for="lLast">Nom<input id="lLast" autocomplete="family-name" maxlength="100" value="${esc(UI.prefill?.last||'')}"${ro} required></label>${plus}<div id="loginMsg"></div><button id="loginBtn">${bouton}</button></form><p class="pz-liens">${liens}</p></div>`+guideHtml();
 const f=(fg&&q)?el('lA'):(UI.prefill?.first&&!ident&&!sg&&!fg?el('lPass'):el('lFirst'));f&&f.focus();
 el('loginForm').onsubmit=e=>{e.preventDefault();soumettre()};
}
el('login').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.gvoir!==undefined){guideMontrer(+b.dataset.gvoir);return}
 if(b.dataset.gtout){guideTout();return}
 if(b.dataset.grole){UI.guideRole=b.dataset.grole;UI.guideQuand=null;renderLogin();return}
 if(b.dataset.gquand){UI.guideRole=gRole();UI.guideQuand=b.dataset.gquand;renderLogin();return}
 if(b.dataset.tab!==undefined){UI.tab=b.dataset.tab;UI.mode='login';UI.prefill=null;UI.info=null;UI.forgotQ=null;UI.guideQuand=null;renderLogin();return}
 if(b.dataset.mode){UI.mode=b.dataset.mode;UI.info=null;UI.forgotQ=null;UI.guideQuand=null;renderLogin()}});
async function soumettre(){
 const first=el('lFirst').value.trim(),last=el('lLast').value.trim(),msg=el('loginMsg'),btn=el('loginBtn'),lab=btn.textContent,v=id=>el(id)?el(id).value:'';
 const prof=UI.tab==='prof',m=UI.mode;msg.innerHTML='';
 if(!first||!last){msg.innerHTML='<div class="pz-msg err">Écris le prénom et le nom.</div>';return}
 btn.disabled=true;btn.textContent='Un instant…';
 try{
  if(m==='identify'){const r=await fn({action:'student_identify',first,last});UI.mode='login';UI.prefill={first:r.first_name,last:r.last_name};renderLogin();fiche(r.first_name+' '+r.last_name,r.password);return}
  if(prof&&m==='signup'){
   const p=v('lPass'),p2=v('lPass2'),qq=v('lQ').trim(),ra=v('lA').trim();
   if(p.length<8)throw Error('Le mot de passe doit avoir 8 caractères ou plus.');if(p!==p2)throw Error('Les deux mots de passe ne sont pas identiques.');
   if(qq.length<3)throw Error('Écris ta question secrète.');if(!ra)throw Error('Écris la réponse à ta question secrète.');
   const r=await fn({action:'teacher_signup',first,last,password:p,question:qq,answer:ra});UI.mode='login';UI.prefill={first,last};UI.info=r.message;renderLogin();return;
  }
  if(prof&&m==='forgot'){
   if(!UI.forgotQ){const r=await fn({action:'teacher_forgot_question',first,last});UI.forgotQ=r.question;UI.prefill={first,last};renderLogin();return}
   const ra=v('lA').trim(),p=v('lPass'),p2=v('lPass2');
   if(!ra)throw Error('Écris ta réponse.');if(p.length<8)throw Error('Le nouveau mot de passe doit avoir 8 caractères ou plus.');if(p!==p2)throw Error('Les deux mots de passe ne sont pas identiques.');
   const r=await fn({action:'teacher_forgot_reset',first,last,answer:ra,password:p});UI.mode='login';UI.forgotQ=null;UI.prefill={first,last};UI.info=r.message;renderLogin();return;
  }
  const password=v('lPass');if(!password)throw Error('Écris le mot de passe.');
  const r=await fn({action:prof?'teacher_login':'student_login',first,last,password});
  save(r.session);UI.info=null;UI.prefill=null;await dashboard();
 }catch(err){msg.innerHTML=`<div class="pz-msg err">${esc(err.message)}</div>`;btn.disabled=false;btn.textContent=lab}
}
/* One-time password card: visible 30 seconds. */
function fiche(nom,mdp){
 const d=document.createElement('div');d.className='fiche-fond';
 d.innerHTML=`<div class="fiche" role="dialog" aria-modal="true"><small>Ton mot de passe</small><h2>${esc(nom)}</h2><div class="mdp">${esc(mdp)}</div><p>Prends une capture d’écran ou écris-le. Il disparaît dans <b id="ficheS">30</b> secondes et ne sera plus affiché.</p><button type="button" id="ficheOk">J’ai noté mon mot de passe</button></div>`;
 document.body.append(d);const fermer=()=>{clearInterval(t);d.remove()};el('ficheOk').onclick=fermer;
 let n=30;const t=setInterval(()=>{n--;const s=el('ficheS');if(s)s.textContent=n;if(n<=0)fermer()},1000);
}

/* ---------- Dashboard ---------- */
el('logout').onclick=async()=>{guideEffacer();save(null);el('classes').textContent='';UI.tab='';renderLogin();say('Tu es déconnecté(e).')};
async function dashboard(){
 const d=await rpc('pz_dashboard');
 if(!d||!d.role){save(null);UI.tab='';renderLogin('Ce compte n’est pas un compte élève ou enseignant. Connecte-toi avec ton prénom, ton nom et ton mot de passe.');return}
 guideEffacer();el('login').hidden=true;el('dashboard').hidden=false;const teacher=d.role==='teacher';
 el('welcome').textContent=teacher?'Mes classes':'Bonjour '+d.student.first_name+' !';el('classes').textContent='';
 if(!teacher){renderStudent(d);return}
 const note=node('p','Les classes et les élèves se gèrent dans Assiduité (les mêmes pour Habiletés et TEJ2O). Ici, tu partages des puzzles et tu suis les résultats.');note.className='table-note';el('classes').append(note);
 if(!d.classes.length){el('classes').append(node('p','Tu n’as pas encore de classe. Crée-la dans Assiduité : elle apparaîtra ici.'));return}
 el('classes').append(sharePanel(d.classes,d.assignments||[]),classIndex(d.classes,d.students||[]));
 for(const c of d.classes){
  const box=node('article');box.className='classbox';box.append(node('h2',c.name));
  const members=d.students.filter(s=>s.class_id===c.id);
  const info=node('p',members.length+' élève'+(members.length>1?'s':''));info.className='class-note';box.append(info);
  const assignments=(d.assignments||[]).filter(a=>a.class_id===c.id);
  box.append(node('h3','Puzzles partagés'));const list=node('div');list.className='puzzles';
  if(!assignments.length)list.append(node('p','Aucun puzzle partagé pour le moment.'));
  for(const a of assignments){const wrap=node('div');const link=node('a',puzzles[a.puzzle]||a.puzzle);link.href='puzzle.html?id='+a.puzzle;link.target='_blank';link.rel='noopener';wrap.append(link);
   const btn=node('button','Retirer');btn.type='button';btn.onclick=()=>run(box,async()=>{await rpc('pz_unshare',{p_class:c.id,p_assignment:a.id});await dashboard()});wrap.append(btn);list.append(wrap)}
  box.append(list);
  const roster=node('details');roster.className='class-roster';roster.append(node('summary','Élèves ('+members.length+')'));const ul=node('ul');
  for(const s of members.slice().sort((a,b)=>(a.last_name+' '+a.first_name).localeCompare(b.last_name+' '+b.first_name,'fr')))ul.append(node('li',s.first_name+' '+s.last_name));
  if(!ul.children.length)ul.append(node('li','Aucun élève. Ajoute-les dans Assiduité.'));roster.append(ul);
  box.append(roster,classSummary(c,d.students||[],d.results||[]),classResults(c,d.students||[],assignments,d.results||[]));
  collapse(box,c);el('classes').append(box);
 }
}

function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}

function formatDuration(seconds){return Math.floor(seconds/60)+' min '+String(seconds%60).padStart(2,'0')+' s'}

function classResults(c,students,assignments,results){const section=node('section');section.className='class-results';section.append(node('h3','Résultats des élèves'));const description=node('p','Temps de la dernière réussite, mesuré depuis le premier déplacement.');description.className='table-note';section.append(description);const members=students.filter(s=>s.class_id===c.id).sort((a,b)=>(a.last_name+' '+a.first_name).localeCompare(b.last_name+' '+b.first_name,'fr'));if(!members.length){section.append(node('p','Ajoute des élèves pour voir leurs résultats.'));return section}const table=node('table');table.append(node('caption','Puzzles et temps — '+c.name));const head=node('thead'),headers=node('tr');for(const title of ['Élève','Puzzle','Statut','Temps','Étoiles','Dernière réussite']){const th=node('th',title);th.setAttribute('scope','col');headers.append(th)}head.append(headers);table.append(head);const body=node('tbody');for(const student of members){const completed=results.filter(r=>r.student_id===student.id);const ids=[...new Set([...assignments.map(a=>a.puzzle),...completed.map(r=>r.puzzle)])];if(!ids.length){const row=node('tr');row.append(node('td',student.first_name+' '+student.last_name));const empty=node('td','Aucun puzzle partagé');empty.colSpan=5;row.append(empty);body.append(row)}for(const id of ids){const result=completed.find(r=>r.puzzle===id),row=node('tr');row.append(node('td',student.first_name+' '+student.last_name),node('td',puzzles[id]||id),node('td',result?'Réussi':'Aucune réussite enregistrée'),node('td',result?formatDuration(result.seconds):'—'),node('td',result?starText(id,result.seconds):'—'),node('td',result?new Date(result.completed_at).toLocaleString('fr-CA',{dateStyle:'short',timeStyle:'short'}):'—'));body.append(row)}}table.append(body);const scroll=node('div');scroll.className='table-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','Tableau des résultats, défilement horizontal');scroll.append(table);const refresh=node('button','Actualiser les résultats');refresh.type='button';refresh.className='secondary';refresh.onclick=()=>run(section,async()=>{await dashboard();say('Résultats actualisés.')});section.append(refresh,scroll);return section}

/* ===== Teacher: summary sheet of a class ===== */
function classSummary(c,students,results){
  const section=node('section');section.className='class-results';section.append(node('h3','Fiche des élèves'));
  const note=node('p','Progression sur l’ensemble des puzzles, partagés ou non.');note.className='table-note';section.append(note);
  const members=students.filter(s=>s.class_id===c.id).sort((a,b)=>(a.last_name+' '+a.first_name).localeCompare(b.last_name+' '+b.first_name,'fr'));
  if(!members.length){section.append(node('p','Aucun élève dans cette classe. Ajoute les élèves dans Assiduité : ils apparaîtront ici.'));return section}
  const levelIds=EC_LEVELS.flatMap(l=>l.ids),fmt=d=>d?new Date(d).toLocaleDateString('fr-CA',{day:'numeric',month:'short',year:'numeric'}):'—';
  const table=node('table');table.append(node('caption','Fiche des élèves — '+c.name));
  const head=node('thead'),hr=node('tr');for(const t of ['Élève','Puzzles réussis','Niveau le plus élevé réussi','Dernière activité','Compte créé le']){const th=node('th',t);th.scope='col';hr.append(th)}head.append(hr);table.append(head);
  const body=node('tbody');
  for(const s of members){
    const mine=results.filter(r=>r.student_id===s.id),n=mine.filter(r=>levelIds.includes(r.puzzle)).length;
    const top=Math.max(0,...mine.map(r=>(EC_CATALOG[r.puzzle]&&EC_CATALOG[r.puzzle].level)||0));
    const last=mine.reduce((m,r)=>!m||r.completed_at>m?r.completed_at:m,null);
    const tr=node('tr');tr.append(node('td',s.first_name+' '+s.last_name),node('td',n+' / '+levelIds.length),node('td',top?'Niveau '+top:'—'),node('td',last?fmt(last):'Aucune réussite'),node('td',fmt(s.created_at)));body.append(tr);
  }
  table.append(body);const scroll=node('div');scroll.className='table-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','Fiche des élèves, défilement horizontal');scroll.append(table);section.append(scroll);
  return section;
}

/* ===== Teacher: class list and collapsible sections ===== */
let justCreated=false;const openClasses=new Set();
function classIndex(classes,students){
  const box=node('section');box.className='class-index';box.append(node('h3','Mes classes ('+classes.length+')'));
  const ul=node('ul');
  for(const c of classes){const n=students.filter(s=>s.class_id===c.id).length;const li=node('li');const a=node('a',c.name);a.href='#classe-'+c.id;
    a.onclick=e=>{e.preventDefault();openClasses.add(c.id);const t=document.getElementById('classe-'+c.id);if(t){t.querySelector('details').open=true;t.scrollIntoView({behavior:'smooth',block:'start'})}};
    const meta=node('span',' · '+n+' élève'+(n>1?'s':''));meta.className='index-meta';li.append(a,meta);ul.append(li)}
  box.append(ul);return box}
function collapse(box,c){
  box.id='classe-'+c.id;const keep=[...box.children].filter(ch=>ch.tagName==='H2'||ch.classList.contains('class-note'));
  const det=node('details');det.className='class-details';const sum=node('summary','Puzzles partagés, élèves et résultats');det.append(sum);
  for(const ch of [...box.children])if(!keep.includes(ch))det.append(ch);
  if(justCreated){openClasses.add(c.id);justCreated=false}
  det.open=openClasses.has(c.id);det.ontoggle=()=>{det.open?openClasses.add(c.id):openClasses.delete(c.id)};
  box.append(det)}

/* ===== Share a puzzle: three arrow selectors (class, theme, level) ===== */
const share={c:0,t:0,l:0,id:null};
function spinner(label,values,key,onChange){
  const wrap=node('div');wrap.className='spin';const lab=node('span',label);lab.className='spin-label';
  const box=node('div');box.className='spin-box';const out=node('output');out.setAttribute('aria-live','polite');
  const arrows=node('div');arrows.className='spin-arrows';
  const set=i=>{share[key]=(i+values.length)%values.length;out.textContent=values[share[key]];onChange()};
  for(const [t,d,txt] of [['▲',1,'Suivant'],['▼',-1,'Précédent']]){const b=node('button',t);b.type='button';b.setAttribute('aria-label',txt+' — '+label);b.onclick=()=>set(share[key]+d);arrows.append(b)}
  out.textContent=values[share[key]];box.append(out,arrows);wrap.append(lab,box);
  wrap.tabIndex=0;wrap.onkeydown=e=>{if(e.key==='ArrowUp'){e.preventDefault();set(share[key]+1)}if(e.key==='ArrowDown'){e.preventDefault();set(share[key]-1)}};
  return wrap}
function sharePanel(classes,assignments){
  const themes=window.EC_THEMES||[...new Set(Object.values(EC_CATALOG).map(p=>p.category))];
  share.c=Math.min(share.c,classes.length-1);
  const sec=node('section');sec.className='share-panel';sec.append(node('h3','Partager un puzzle'));
  const row=node('div');row.className='spin-row';
  const gallery=node('div');gallery.className='theme-gallery';const card=node('div');card.className='share-card';const img=node('img');img.alt='';const info=node('p');const btn=node('button','Partager avec cette classe');btn.type='button';
  const themeIds=()=>EC_LEVELS.flatMap(l=>l.ids).filter(id=>EC_CATALOG[id].category===themes[share.t]).sort((a,b)=>EC_CATALOG[a].level-EC_CATALOG[b].level);const pick=()=>{const ids=themeIds();if(share.id&&ids.includes(share.id)&&EC_CATALOG[share.id].level===share.l+1)return share.id;return ids.find(id=>EC_CATALOG[id].level===share.l+1)};
  const drawGallery=()=>{gallery.textContent='';const cur=pick();themeIds().forEach(id=>{const p=EC_CATALOG[id],i=p.level-1;const b=node('button');b.type='button';b.className='thumb'+(id===cur?' selected':'');b.setAttribute('aria-pressed',String(id===cur));b.setAttribute('aria-label','Niveau '+(i+1)+' — '+p.name);const im=node('img');im.src=p.image;im.alt='';const cap=node('span','Niveau '+(i+1));if(assignments.some(a=>a.class_id===classes[share.c].id&&a.puzzle===id)){const ok=node('em','✓ partagé');b.append(ok)}b.prepend(im,cap);b.onclick=()=>{share.l=i;share.id=id;levelOut.textContent=String(i+1);render()};gallery.append(b)})};const render=()=>{drawGallery();const id=pick(),c=classes[share.c];if(!id){info.textContent='Aucun puzzle pour ce choix.';img.hidden=true;btn.disabled=true;return}
    const p=EC_CATALOG[id];img.hidden=false;img.src=p.image;img.alt=p.name;info.textContent='';info.append(node('strong',p.name),node('span','Niveau '+p.level+' · '+p.size*p.size+' morceaux'));
    const done=assignments.some(a=>a.class_id===c.id&&a.puzzle===id);btn.disabled=done;btn.textContent=done?'Déjà partagé avec '+c.name:'Partager avec '+c.name};
  const levelSpin=spinner('Niveau',EC_LEVELS.map((_,i)=>String(i+1)),'l',render);const levelOut=levelSpin.querySelector('output');row.append(spinner('Classe',classes.map(c=>c.name),'c',render),spinner('Thème',themes,'t',render),levelSpin);
  btn.onclick=()=>run(sec,async()=>{const id=pick(),c=classes[share.c];await rpc('pz_share',{p_class:c.id,p_puzzle:id});await dashboard();say('« '+EC_CATALOG[id].name+' » est partagé avec la classe '+c.name+'.')});
  card.append(img,info,btn);sec.append(row,gallery,card);render();return sec}

/* ===== Stars: based on time and number of pieces ===== */
function stars(id,seconds){const p=EC_CATALOG[id];const pieces=p?p.size*p.size:16;const base=pieces*7;return seconds<=base?3:seconds<=base*2?2:1}
function starText(id,seconds){const n=stars(id,seconds);return '★'.repeat(n)+'☆'.repeat(3-n)}

/* ===== Student: classes, solved puzzles, last time and stars ===== */
function renderStudent(d){
  const results=d.results||[],done=new Map(results.map(r=>[r.puzzle,r]));
  const sharedAll=new Set((d.assignments||[]).map(a=>a.puzzle));const mine=results.filter(r=>sharedAll.has(r.puzzle));
  const total=mine.reduce((t,r)=>t+stars(r.puzzle,r.seconds),0);
  const head=node('p','Puzzles réussis : '+mine.length+' · Score total : '+total+' ★');head.className='student-total';el('classes').append(head);
  if(!d.classes.length){el('classes').append(node('p','Tu n’es inscrit(e) dans aucune classe pour le moment. Demande à ton enseignant(e) de t’ajouter à sa classe.'));return}
  el('classes').append(node('h3','Mes classes'));
  for(const c of d.classes){
    const det=node('details');det.className='classbox student-class';const sum=node('summary',c.name);det.append(sum);
    const shared=(d.assignments||[]).filter(a=>a.class_id===c.id).map(a=>a.puzzle);
    const ids=[...new Set(shared)].filter(id=>EC_CATALOG[id]).sort((a,b)=>(done.has(b)-done.has(a))||EC_CATALOG[a].level-EC_CATALOG[b].level);
    if(!ids.length){det.append(node('p','Aucun puzzle pour le moment. Ton enseignante va bientôt en partager.'))}
    else{
      const table=node('table');table.className='student-table';const tr=node('tr');for(const t of ['Puzzle','Niveau','Statut','Dernier temps','Score']){const th=node('th',t);th.scope='col';tr.append(th)}const thead=node('thead');thead.append(tr);table.append(thead);
      const tb=node('tbody');
      for(const id of ids){const p=EC_CATALOG[id],r=done.get(id),row=node('tr');
        const cell=node('td');const a=node('a');a.href='puzzle.html?id='+id;const im=node('img');im.src=p.image;im.alt='';a.append(im,document.createTextNode(p.name));cell.append(a);
        const st=node('td',r?'Réussi':'À faire');st.className=r?'ok':'todo';
        const sc=node('td',r?starText(id,r.seconds)+' '+stars(id,r.seconds)+'/3':'—');sc.className='stars';
        row.append(cell,node('td',String(p.level)),st,node('td',r?formatDuration(r.seconds):'—'),sc);tb.append(row)}
      table.append(tb);const wrap=node('div');wrap.className='table-scroll';wrap.append(table);det.append(wrap);}
    el('classes').append(det)}
  const first=el('classes').querySelector('details');if(first&&d.classes.length===1)first.open=true}

/* ---------- Startup ---------- */
if(session)dashboard().catch(e=>{if(e.message!==NET_MSG)save(null);renderLogin(e.message)});else renderLogin();
