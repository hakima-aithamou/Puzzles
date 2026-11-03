import { createClient } from "npm:@supabase/supabase-js@2.57.4";
/* Fonction serveur : site des puzzles « Mille et une pièces » + site Horizon (EduCentre).
   Connexion élève : prénom + nom + mot de passe ; un code de classe permet de rejoindre une classe.
   Un élève peut appartenir à plusieurs classes (table ec_class_members).
   Chaque puzzle réussi est enregistré pour suivre la progression de l’élève. */
const url=Deno.env.get("SUPABASE_URL")!;
const admin=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const TEACHER="hakima.ait-hamou@cepeo.on.ca";
const PUZZLES=["animals-1","animals-2","animals-3","animals-4","animals-5","animals-6","planets-1","planets-2","planets-3","planets-4","planets-5","planets-6","neighborhoods-1","neighborhoods-2","neighborhoods-3","neighborhoods-4","neighborhoods-5","neighborhoods-6","shops-1","shops-2","shops-3","shops-4","shops-5","shops-6","anime-1","anime-2","anime-3","anime-4","anime-5","anime-6","mediterranee-1","mediterranee-2","mediterranee-3","mediterranee-4","mediterranee-5","mediterranee-6","chateau-1","chateau-2","chateau-3","chateau-4","chateau-5","chateau-6","chateau-7","chateau-8","chateau-9","magiques-1","magiques-2","magiques-3","magiques-4","magiques-5","magiques-6","magiques-7","magiques-8","magiques-9","magie-1","magie-2","magie-3","magie-4","magie-5","magie-6","magie-7","magie-8","magie-9","montagnes","puzzle-original","port","ville","espace-7x7","port-8x8","ville-9x9","jardin-3x3","ocean-3x3","desert-3x3","jardin-4x4","ocean-4x4","desert-4x4","jardin-6x6","ocean-6x6","desert-6x6","jardin-8x8","ocean-8x8","desert-8x8"];
const ACTIVITIES=["formes","calculs","finances","heure","mesures","trajets","dessins","droites","partage","suites"];
const NAME_TAKEN="Ce prénom et ce nom sont déjà utilisés par un autre élève. Ajoute l’initiale de ton deuxième prénom ou de ton nom (par exemple « Léo T. »), ou demande à Mme Hakima.";
async function hash(first:string,last:string){const value=first.trim().normalize("NFKC").toLocaleLowerCase("fr")+"|"+last.trim().normalize("NFKC").toLocaleLowerCase("fr");return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,"0")).join("");}
const validName=(f:unknown,l:unknown)=>typeof f==="string"&&typeof l==="string"&&!!f.trim()&&!!l.trim()&&f.length<=100&&l.length<=100;
const validPassword=(p:unknown)=>typeof p==="string"&&p.length>=8&&p.length<=128;
const isUuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);
async function classesOf(studentId:string){const {data,error}=await admin.from("ec_class_members").select("class_id").eq("student_id",studentId);if(error)throw error;return (data||[]).map(m=>m.class_id);}
/* Crée le compte d'authentification + la fiche élève. */
async function createStudent(first:string,last:string,password:string){
  const h=await hash(first,last);
  const {data:dup}=await admin.from("ec_students").select("id").eq("login_hash",h).maybeSingle();
  if(dup)return {error:NAME_TAKEN};
  const {data,error}=await admin.auth.admin.createUser({email:h+"@students.edu-centre.invalid",password,email_confirm:true});
  if(error)return {error:"Ce mot de passe est refusé ou ce nom existe déjà. Choisis un autre mot de passe."};
  const {error:e}=await admin.from("ec_students").insert({id:data.user.id,class_id:null,first_name:first.trim(),last_name:last.trim(),login_hash:h});
  if(e){await admin.auth.admin.deleteUser(data.user.id);if(String(e.message).includes("login_hash"))return {error:NAME_TAKEN};throw e;}
  return {id:data.user.id};
}
Deno.serve(async(req)=>{
/* Toutes les origines sont acceptées : le site GitHub, une autre adresse du site, un fichier ouvert depuis l’ordinateur.
   Aucun cookie n’est utilisé : chaque demande porte son propre jeton de connexion. */
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info,x-ec","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Max-Age":"86400","Content-Type":"application/json"};
const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
if(req.method==="OPTIONS")return out({});
/* Demande « GET » : même contenu, placé dans l’en-tête x-ec (pour les réseaux qui bloquent les envois « POST »). */
const viaGet=req.method==="GET"&&!!req.headers.get("x-ec");
if(req.method!=="POST"&&!viaGet)return out({error:"Méthode non autorisée"},405);
try {
let b:any;
if(viaGet){try{b=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(req.headers.get("x-ec")!),c=>c.charCodeAt(0))))}catch{return out({error:"Demande illisible."},400)}}
else b=await req.json();
if(!b||typeof b!=="object")return out({error:"Demande illisible."},400);

/* ===================== Élève : inscription et connexion ===================== */
if(b.action==="student_signup"){
  if(!validName(b.first,b.last)||!validPassword(b.password))return out({error:"Indique ton prénom, ton nom et un mot de passe de 8 caractères ou plus."},400);
  const r=await createStudent(b.first,b.last,b.password);if(r.error)return out({error:r.error},400);
  // Si un code de classe est envoyé, l'élève est ajouté à cette classe.
  if(typeof b.code==="string"&&b.code.trim()&&b.code.length<=20){const {data:c}=await admin.from("ec_classes").select("id").eq("code",b.code.trim().toUpperCase()).maybeSingle();if(c)await admin.from("ec_class_members").upsert({class_id:c.id,student_id:r.id});}
  return out({ok:true});
}
if(b.action==="student_login"){
  if(typeof b.first!=="string"||typeof b.last!=="string"||typeof b.password!=="string"||b.first.length>100||b.last.length>100||b.password.length>128)return out({error:"Connexion impossible."},400);
  const {data:s}=await admin.from("ec_students").select("id").eq("login_hash",await hash(b.first,b.last)).maybeSingle();
  if(!s)return out({error:"Prénom, nom ou mot de passe incorrect."},401);
  const {data:u}=await admin.auth.admin.getUserById(s.id);
  if(!u?.user?.email)return out({error:"Prénom, nom ou mot de passe incorrect."},401);
  const client=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{persistSession:false}});
  const {data,error}=await client.auth.signInWithPassword({email:u.user.email,password:b.password});
  if(error)return out({error:"Prénom, nom ou mot de passe incorrect."},401);
  // Un élève déjà inscrit qui saisit un code de classe rejoint aussi cette classe.
  if(typeof b.code==="string"&&b.code.trim()&&b.code.length<=20){const {data:c}=await admin.from("ec_classes").select("id").eq("code",b.code.trim().toUpperCase()).maybeSingle();if(c)await admin.from("ec_class_members").upsert({class_id:c.id,student_id:s.id});}
  return out({session:data.session});
}

/* Session : renouvellement et connexion par courriel, aussi possibles par la fonction (réseaux filtrés). */
if(b.action==="refresh"){
  if(typeof b.refresh_token!=="string"||!b.refresh_token||b.refresh_token.length>500)return out({error:"Ta session a expiré. Reconnecte-toi."},401);
  const client=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{persistSession:false}});
  const {data,error}=await client.auth.refreshSession({refresh_token:b.refresh_token});
  if(error||!data.session)return out({error:"Ta session a expiré. Reconnecte-toi."},401);
  return out(data.session);
}
if(b.action==="password_login"){
  if(typeof b.email!=="string"||typeof b.password!=="string"||b.email.length>200||b.password.length>128)return out({error:"Connexion impossible."},400);
  const client=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{persistSession:false}});
  const {data,error}=await client.auth.signInWithPassword({email:b.email.trim(),password:b.password});
  if(error||!data.session)return out({error:"Courriel ou mot de passe incorrect, ou compte pas encore confirmé."},400);
  return out(data.session);
}

/* ===================== Utilisateur connecté ===================== */
const token=(req.headers.get("authorization")||"").slice(7);
if(!token)return out({error:"Connecte-toi pour continuer."},401);
const {data:{user},error:authError}=await admin.auth.getUser(token);
if(authError||!user)return out({error:"Ta session a expiré. Reconnecte-toi."},401);
const teacher=user.email?.toLowerCase()===TEACHER&&!!user.email_confirmed_at;
const {data:student}=await admin.from("ec_students").select("id,first_name,last_name,created_at").eq("id",user.id).maybeSingle();

/* ---------- Horizon : résultats de mathématiques ---------- */
if(b.action==="save_math_result"){
  if(!student)return out({error:"Connecte-toi avec ton compte élève pour enregistrer ton résultat."},403);
  if(!ACTIVITIES.includes(b.activity)||!Number.isInteger(b.level)||b.level<1||b.level>20||!Number.isInteger(b.total)||b.total<1||b.total>1000||!Number.isInteger(b.score)||b.score<0||b.score>b.total||!Number.isInteger(b.seconds)||b.seconds<0||b.seconds>86400)return out({error:"Résultat invalide."},400);
  const {error}=await admin.from("ec_math_results").insert({student_id:user.id,activity:b.activity,level:b.level,score:b.score,total:b.total,seconds:b.seconds});
  if(error)throw error;return out({ok:true});
}
if(b.action==="math_dashboard"){
  if(teacher){
    const {data:classes,error}=await admin.from("ec_classes").select("id,name,created_at").eq("teacher_id",user.id).order("created_at");if(error)throw error;
    const {data:students,error:se}=await admin.from("ec_students").select("id,first_name,last_name,created_at").order("last_name");if(se)throw se;
    const {data:members,error:me}=await admin.from("ec_class_members").select("class_id,student_id");if(me)throw me;
    const {data:results,error:re}=await admin.from("ec_math_results").select("student_id,activity,level,score,total,seconds,completed_at").order("completed_at",{ascending:false}).limit(10000);if(re)throw re;
    return out({role:"teacher",classes,students,members,results});
  }
  if(student){
    const ids=await classesOf(user.id);
    const {data:classes}=ids.length?await admin.from("ec_classes").select("id,name").in("id",ids).order("name"):{data:[]};
    const {data:results,error}=await admin.from("ec_math_results").select("activity,level,score,total,seconds,completed_at").eq("student_id",user.id).order("completed_at",{ascending:false}).limit(2000);if(error)throw error;
    return out({role:"student",student,classes,results});
  }
  return out({error:"Ce compte ne possède pas d’espace de classe."},403);
}

/* ---------- Puzzles ---------- */
if(b.action==="save_result"){
  if(!student)return out({error:"Compte élève requis."},403);
  if(!PUZZLES.includes(b.puzzle))return out({error:"Puzzle inconnu."},400);
  if(!Number.isInteger(b.seconds)||b.seconds<0||b.seconds>604800)return out({error:"Temps invalide."},400);
  const {error}=await admin.from("ec_results").upsert({student_id:user.id,puzzle:b.puzzle,seconds:b.seconds,completed_at:new Date().toISOString()},{onConflict:"student_id,puzzle"});
  if(error)throw error;return out({ok:true});
}
if(b.action==="dashboard"){
  if(teacher){
    const {data:classes,error}=await admin.from("ec_classes").select("*").eq("teacher_id",user.id).order("created_at");if(error)throw error;
    const ids=(classes||[]).map(c=>c.id);
    const {data:members}=ids.length?await admin.from("ec_class_members").select("class_id,student_id,added_at").in("class_id",ids):{data:[]};
    const {data:all}=await admin.from("ec_students").select("id,first_name,last_name,created_at");
    const byId=new Map((all||[]).map(s=>[s.id,s]));
    // Une ligne par appartenance (format attendu par la page des puzzles : student.class_id).
    const students=(members||[]).filter(m=>byId.has(m.student_id)).map(m=>({...byId.get(m.student_id),class_id:m.class_id,added_at:m.added_at}));
    const {data:assignments}=ids.length?await admin.from("ec_assignments").select("*").in("class_id",ids):{data:[]};
    const sids=[...new Set(students.map(s=>s.id))];
    const {data:results,error:re}=sids.length?await admin.from("ec_results").select("student_id,puzzle,seconds,completed_at").in("student_id",sids):{data:[],error:null};if(re)throw re;
    return out({role:"teacher",classes,students,all_students:all||[],assignments,results});
  }
  if(student){
    const ids=await classesOf(user.id);
    const {data:classes}=ids.length?await admin.from("ec_classes").select("id,name").in("id",ids).order("name"):{data:[]};
    const {data:assignments}=ids.length?await admin.from("ec_assignments").select("id,puzzle,class_id").in("class_id",ids):{data:[]};
    
    const {data:results,error}=await admin.from("ec_results").select("puzzle,seconds,completed_at").eq("student_id",user.id);if(error)throw error;
    return out({role:"student",student:{...student,class_id:ids[0]||null},classes:classes||[],assignments:assignments||[],results});
  }
  return out({error:"Ce compte ne possède pas d’espace de classe."},403);
}

/* ===================== Enseignante uniquement ===================== */
if(!teacher)return out({error:"Accès enseignant requis."},403);

if(b.action==="create_class"){
  if(typeof b.name!=="string"||!b.name.trim()||b.name.length>100)return out({error:"Indique un nom de classe (100 caractères maximum)."},400);
  const {error}=await admin.from("ec_classes").insert({teacher_id:user.id,name:b.name.trim()});if(error)throw error;return out({ok:true});
}
/* Gestion des élèves (indépendante des classes) */
if(b.action==="create_student"){
  if(!validName(b.first,b.last)||!validPassword(b.password))return out({error:"Indique le prénom, le nom et un mot de passe de 8 caractères ou plus."},400);
  const r=await createStudent(b.first,b.last,b.password);if(r.error)return out({error:r.error},400);
  const cls=Array.isArray(b.class_ids)?b.class_ids:(isUuid(b.class_id)?[b.class_id]:[]);
  if(cls.length){const {data:own}=await admin.from("ec_classes").select("id").eq("teacher_id",user.id).in("id",cls.filter(isUuid));if(own?.length)await admin.from("ec_class_members").upsert(own.map(c=>({class_id:c.id,student_id:r.id})));}
  return out({ok:true,id:r.id});
}
if(["update_student","delete_student","reset_student_password"].includes(b.action)){
  if(!isUuid(b.student_id))return out({error:"Élève introuvable."},400);
  const {data:target}=await admin.from("ec_students").select("id,first_name,last_name").eq("id",b.student_id).maybeSingle();
  if(!target)return out({error:"Élève introuvable."},404);
  if(b.action==="delete_student"){
    if(b.confirm_name!==undefined&&b.confirm_name!==target.first_name+" "+target.last_name)return out({error:"Recopie le prénom et le nom pour confirmer."},400);
    const {error}=await admin.auth.admin.deleteUser(target.id);if(error)throw error;
    await admin.from("ec_students").delete().eq("id",target.id);
    return out({ok:true});
  }
  if(b.action==="reset_student_password"){
    if(!validPassword(b.password))return out({error:"Choisis un mot de passe de 8 caractères ou plus."},400);
    const {error}=await admin.auth.admin.updateUserById(target.id,{password:b.password});
    if(error)return out({error:"Ce mot de passe est refusé. Choisis-en un autre."},400);
    return out({ok:true});
  }
  if(!validName(b.first,b.last))return out({error:"Indique le prénom et le nom (100 caractères maximum)."},400);
  const h=await hash(b.first,b.last);
  const {data:dup}=await admin.from("ec_students").select("id").eq("login_hash",h).neq("id",target.id).maybeSingle();
  if(dup)return out({error:"Un autre élève porte déjà ce prénom et ce nom."},400);
  const {error}=await admin.from("ec_students").update({first_name:b.first.trim(),last_name:b.last.trim(),login_hash:h}).eq("id",target.id);
  if(error)throw error;return out({ok:true});
}
/* Ajouter ou retirer des élèves d'une classe (cases à cocher) */
if(b.action==="add_members"||b.action==="remove_members"){
  const {data:c}=await admin.from("ec_classes").select("id").eq("id",b.class_id).eq("teacher_id",user.id).maybeSingle();
  if(!c)return out({error:"Classe inaccessible."},403);
  if(!Array.isArray(b.student_ids)||!b.student_ids.length||b.student_ids.length>500||!b.student_ids.every(isUuid))return out({error:"Coche au moins un élève."},400);
  if(b.action==="add_members"){
    const {data:ok}=await admin.from("ec_students").select("id").in("id",b.student_ids);
    const {error}=await admin.from("ec_class_members").upsert((ok||[]).map(s=>({class_id:c.id,student_id:s.id})));if(error)throw error;
    return out({ok:true,count:(ok||[]).length});
  }
  const {error}=await admin.from("ec_class_members").delete().eq("class_id",c.id).in("student_id",b.student_ids);if(error)throw error;
  return out({ok:true});
}
/* Actions sur une classe précise */
const {data:c}=await admin.from("ec_classes").select("id,name").eq("id",b.class_id).eq("teacher_id",user.id).maybeSingle();
if(!c)return out({error:"Classe inaccessible."},403);
if(b.action==="update_class"){
  if(typeof b.name!=="string"||!b.name.trim()||b.name.length>100)return out({error:"Indique un nom de classe (100 caractères maximum)."},400);
  const {error}=await admin.from("ec_classes").update({name:b.name.trim()}).eq("id",c.id);if(error)throw error;return out({ok:true});
}
if(b.action==="delete_class"){
  if(b.confirm_name!==c.name)return out({error:"Recopie le nom exact de la classe pour confirmer."},400);
  const {error}=await admin.from("ec_classes").delete().eq("id",c.id);if(error)throw error;return out({ok:true});
}
if(b.action==="share"){if(!PUZZLES.includes(b.puzzle))return out({error:"Puzzle inconnu."},400);const {error}=await admin.from("ec_assignments").upsert({class_id:c.id,puzzle:b.puzzle},{onConflict:"class_id,puzzle"});if(error)throw error;return out({ok:true});}
if(b.action==="unshare"){const {error}=await admin.from("ec_assignments").delete().eq("class_id",c.id).eq("id",b.assignment_id);if(error)throw error;return out({ok:true});}
return out({error:"Action inconnue."},400);
}catch(e){console.error("edu-centre erreur:",e instanceof Error?e.name+": "+e.message:String(e));return out({error:"Impossible de terminer cette action. Réessaie."},400);}
});
