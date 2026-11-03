"use strict";
/* Catalogue classé par thème : une section par thème, puzzles du plus facile au plus difficile. */
const nav=document.getElementById("levelNav"),catalogue=document.getElementById("catalogue");
const category=document.getElementById("categoryFilter"),difficulty=document.getElementById("difficultyFilter");
const THEMES=window.EC_THEMES||[...new Set(Object.values(EC_CATALOG).map(p=>p.category))];
const ALL_IDS=EC_LEVELS.flatMap(l=>l.ids);
const INTRO={"Animaux":"Des animaux photographiés dans la nature.","Planètes":"La Terre et les planètes vues par les missions spatiales.","Quartiers":"Des rues et des maisons d’ici et d’ailleurs.","Magasins":"Les boutiques de tous les jours.","Anime":"Des illustrations colorées dans le style des dessins animés japonais.","Méditerranée":"Mer turquoise, fleurs et villages blancs.","Château enchanté":"Un château de conte, des dragons et des paysages féeriques.","Animaux magiques":"Licornes, cerfs de lumière et animaux de légende.","Magie":"Sorcières, grimoires et potions sous les étoiles."};
const slug=t=>[...t.normalize("NFD").toLowerCase()].map(c=>/[a-z0-9]/.test(c)?c:/[\u0300-\u036f]/.test(c)?"":"-").join("").split("-").filter(Boolean).join("-");
THEMES.forEach(theme=>{const a=document.createElement("a");a.href="#theme-"+slug(theme);a.textContent=theme;nav.append(a)});
function card(id){const p=EC_CATALOG[id],a=document.createElement("a");a.className="card";a.href="puzzle.html?id="+encodeURIComponent(id);const visual=document.createElement("div");visual.className="visual";const img=document.createElement("img");img.src=p.image;img.alt=p.name;img.loading="lazy";visual.append(img);const body=document.createElement("div");body.className="content";const meta=document.createElement("div");meta.className="meta";meta.textContent="Niveau "+p.level+" · "+p.size*p.size+" morceaux";const name=document.createElement("h3");name.textContent=p.name;const play=document.createElement("div");play.className="play";play.textContent="Jouer au puzzle →";body.append(meta,name,play);a.append(visual,body);return a}
function renderCatalogue(){catalogue.textContent='';let total=0;
  for(const theme of THEMES){if(category.value!=="all"&&category.value!==theme)continue;
    const ids=ALL_IDS.filter(id=>EC_CATALOG[id].category===theme&&(difficulty.value==="all"||EC_CATALOG[id].level===Number(difficulty.value))).sort((a,b)=>EC_CATALOG[a].level-EC_CATALOG[b].level);
    if(!ids.length)continue;total+=ids.length;
    const section=document.createElement("section");section.id="theme-"+slug(theme);
    const h=document.createElement("h2");h.textContent=theme;const sub=document.createElement("p");sub.textContent=(INTRO[theme]||"")+" "+ids.length+" puzzle"+(ids.length>1?"s":"")+", du niveau le plus facile au plus difficile.";
    const grid=document.createElement("div");grid.className="grid";ids.forEach(id=>grid.append(card(id)));section.append(h,sub,grid);catalogue.append(section)}
  document.getElementById("filterCount").textContent=total+" puzzle"+(total>1?"s":"")+" disponible"+(total>1?"s":"")}
category.onchange=difficulty.onchange=renderCatalogue;renderCatalogue();
