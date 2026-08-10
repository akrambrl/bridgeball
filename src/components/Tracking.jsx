// Tableau de bord de suivi — back-office privé, ouvert par ?stats=CODE.
//
// Il vivait dans 350 lignes de JSX au milieu de LePont.jsx, en une seule colonne
// de 520 px : dix sections empilées, un seul filtre (la plage de jours), et rien
// pour naviguer. Sur un écran d'ordinateur il restait une bande étroite au
// centre. Ici : des rubriques, une barre de filtres qui traverse tous les
// chiffres (voir lib/tracking.js), et une mise en page qui occupe la largeur
// disponible sans casser l'affichage sur téléphone.
//
// Le calcul est dans lib/tracking.js, testé par src/test/tracking.test.ts. Ce
// fichier ne fait que du rendu et de la collecte.
import React, { useState, useEffect, useMemo } from "react";
import { G, posterText, btn, fondCharte, areneCharte } from "../lib/charte.jsx";
import { countryToFlag } from "../lib/leaderboard";
import { parisDayOf, parisLastDays } from "../lib/days";
import { PLAY_MODES, MODES_PAR_CLE, RUBRIQUES, FILTRES_VIDES, PLAGE_DEFAUT,
         agregeTracking, formatDuree } from "../lib/tracking.js";

const SEUIL_PC = 1000;          // au-delà : barre latérale et grilles multi-colonnes
const FENETRE_MAX = 14;         // jours rapatriés ; les plages plus courtes filtrent côté client
// Le crème et ses transparences ne valent QUE dans un panneau de nuit. Sur l'or,
// seule l'encre se lit : le crème y tombe à 1,4 de contraste. D'où deux familles
// distinctes — BLANC pour l'intérieur des panneaux, ENCRE pour ce qui est posé à
// nu sur le fond (libellés de section, notes de bas de bloc).
const BLANC = function (a) { return "rgba(255,255,255," + a + ")"; };
const ENCRE = function (a) { return "rgba(8,17,9," + a + ")"; };
// Le rectangle de contenu de la charte : nuit opaque, trait plein, ombre dure.
// Opaque et non translucide — un voile sombre sur l'or vire au khaki et emporte
// ses libellés avec lui.
const PANNEAU = { background:G.nuit, border:G.trait, boxShadow:G.ombre, borderRadius:G.rayon };

// ── Briques visuelles communes ───────────────────────────────────────────────
function Titre(props) {
  return (
    <div style={{fontSize:11,letterSpacing:2,color:ENCRE(.62),fontWeight:800,
                 textTransform:"uppercase",marginBottom:10,paddingLeft:4}}>
      {props.children}
    </div>
  );
}

function Bloc(props) {
  return (
    <section style={{marginBottom:props.serre?14:24,minWidth:0}}>
      {props.titre ? <Titre>{props.titre}</Titre> : null}
      {props.children}
    </section>
  );
}

// Enveloppe tout ce qui n'est pas déjà un panneau : barres, listes, segments.
function Panneau(props) {
  return <div style={{...PANNEAU,padding:props.padding || 14,minWidth:0}}>{props.children}</div>;
}

// Note de bas de bloc, posée à nu sur l'or : encre PLEINE. À 62 % elle se noyait
// dans les lignes de vitesse de l'arène — un libellé de section, plus gros et
// espacé, s'en sort à 62 %, pas une phrase de 11 px.
function Note(props) {
  return (
    <div style={{fontSize:11,color:G.encre,fontWeight:700,lineHeight:1.5,
                 marginTop:8,paddingLeft:4,textAlign:props.droite?"right":"left"}}>
      {props.children}
    </div>
  );
}

function Vide(props) {
  return (
    <div style={{...PANNEAU,padding:16,lineHeight:1.5,fontSize:12.5,fontWeight:600,
                 color:props.alerte?G.projecteur:BLANC(.55)}}>
      {props.children}
    </div>
  );
}

function Carte(props) {
  const c = props.color || G.pelouseClaire;
  return (
    <div style={{...PANNEAU,padding:"16px 14px",textAlign:"center",minWidth:0}}>
      <div style={{...posterText(props.petit?24:38),color:c,lineHeight:1.1,
                   overflowWrap:"anywhere"}}>{props.valeur}</div>
      <div style={{fontSize:10.5,letterSpacing:1,color:BLANC(.6),fontWeight:800,
                   textTransform:"uppercase",marginTop:7}}>{props.label}</div>
      {props.sous ? <div style={{fontSize:10,color:BLANC(.35),fontWeight:600,marginTop:3}}>{props.sous}</div> : null}
    </div>
  );
}

function Grille(props) {
  return (
    <div style={{display:"grid",gap:12,
                 gridTemplateColumns:"repeat(auto-fit, minmax("+(props.min||150)+"px, 1fr))"}}>
      {props.children}
    </div>
  );
}

// Barre horizontale nommée : le libellé au-dessus et non dans une colonne fixe,
// sinon « Devinette du jour » se fait tronquer sur un écran de téléphone.
function BarreMode(props) {
  const r = props.r, i = props.i;
  const pct = props.total ? Math.round(r.n / props.total * 100) : 0;
  return (
    <div style={{minWidth:0}}>
      <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:4}}>
        <span style={{fontSize:12.5}}>{r.emoji}</span>
        <span style={{fontSize:12.5,color:i===0?r.color:BLANC(.7),fontWeight:i===0?800:600,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</span>
        {i===0 && r.n>0 ? <span style={{fontSize:11}}>👑</span> : null}
        <span style={{flex:1}}/>
        <span style={{fontSize:13,color:"#fff",fontWeight:800,flexShrink:0}}>
          {r.n}<span style={{color:BLANC(.35),fontWeight:600,fontSize:11}}> · {pct}%</span>
        </span>
      </div>
      <div style={{height:22,background:"rgba(0,0,0,.45)",border:G.traitFin,
                   borderRadius:G.rayonS,overflow:"hidden"}}>
        <div style={{height:"100%",width:Math.round(r.n/props.max*100)+"%",minWidth:r.n?8:0,
                     background:r.color,opacity:i===0?1:.6,transition:"width .4s"}}/>
      </div>
      {props.sous ? <div style={{fontSize:10.5,color:BLANC(.34),fontWeight:600,marginTop:3}}>{props.sous}</div> : null}
    </div>
  );
}

function Segments(props) {
  const total = props.parts.reduce(function (s, p) { return s + p.n; }, 0) || 1;
  return (
    <>
      <div style={{display:"flex",height:34,borderRadius:G.rayonS,overflow:"hidden",border:G.traitFin}}>
        {props.parts.filter(function (p) { return p.n > 0; }).map(function (p) {
          const pct = Math.round(p.n / total * 100);
          return (
            <div key={p.label} style={{width:pct+"%",background:p.fond,minWidth:36,display:"flex",
                                       alignItems:"center",justifyContent:"center",fontSize:12,
                                       fontWeight:800,color:p.encre||"#fff"}}>{pct}%</div>
          );
        })}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:12,justifyContent:"space-between",
                   marginTop:8,fontSize:12,fontWeight:700}}>
        {props.parts.map(function (p) {
          return <span key={p.label} style={{color:p.texte||"#fff"}}>{p.label} · {p.n}</span>;
        })}
      </div>
    </>
  );
}

// ── Contrôles ────────────────────────────────────────────────────────────────
function Onglets(props) {
  return (
    <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2,
                 flexDirection:props.colonne?"column":"row"}}>
      {props.options.map(function (o) {
        const actif = props.valeur === o.key;
        return (
          <button key={o.key} onClick={function () { props.onChange(o.key); }}
            style={{flex:props.colonne?"none":"1 0 auto",textAlign:props.colonne?"left":"center",
                    padding:props.colonne?"11px 14px":"10px 14px",borderRadius:G.rayonS,cursor:"pointer",
                    whiteSpace:"nowrap",fontFamily:G.font,fontWeight:800,fontSize:13.5,
                    border:G.trait,boxShadow:actif?"none":"3px 3px 0 "+G.encre,
                    transform:actif?"translate(3px,3px)":"none",
                    background:actif?G.projecteur:G.nuit,
                    color:actif?G.encre:BLANC(.72),transition:"transform .12s, background .12s"}}>
            {o.emoji ? o.emoji + " " : ""}{o.label}
          </button>
        );
      })}
    </div>
  );
}

function Choix(props) {
  return (
    <label style={{display:"flex",flexDirection:"column",gap:5,minWidth:0,flex:"1 1 150px"}}>
      <span style={{fontSize:10,letterSpacing:1.5,color:props.surOr?ENCRE(.62):BLANC(.5),
                    fontWeight:800,textTransform:"uppercase"}}>
        {props.label}
      </span>
      <select value={props.valeur} onChange={function (e) { props.onChange(e.target.value); }}
        style={{appearance:"none",width:"100%",padding:"9px 11px",borderRadius:G.rayonS,cursor:"pointer",
                border:G.traitFin,background:props.actif?G.projecteur:G.nuit,
                color:props.actif?G.encre:"#fff",fontFamily:G.font,fontWeight:700,fontSize:13}}>
        {props.options.map(function (o) {
          return <option key={o.v} value={o.v} style={{background:G.nuit,color:"#fff"}}>{o.l}</option>;
        })}
      </select>
    </label>
  );
}

// ── Rubriques ────────────────────────────────────────────────────────────────
function jolieDate(iso) {
  const dt = new Date(iso + "T12:00:00");
  return dt.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function JourParJour(props) {
  const v = props.v;
  const max = Math.max(1, ...v.parJour.map(function (d) { return d.players; }));
  return (
    <Panneau>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {v.parJour.map(function (d, i) {
        return (
          <div key={d.day} style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:104,flexShrink:0,fontSize:12.5,textTransform:"capitalize",
                         color:i===0?G.projecteur:BLANC(.6),fontWeight:i===0?800:600}}>
              {i===0 ? "Aujourd'hui" : jolieDate(d.day)}
            </div>
            <div style={{flex:1,height:26,background:"rgba(0,0,0,.45)",border:G.traitFin,
                         borderRadius:G.rayonS,overflow:"hidden",minWidth:40}}>
              <div style={{height:"100%",width:Math.round(d.players/max*100)+"%",minWidth:d.players?8:0,
                           background:i===0?G.projecteur:"rgba(96,165,250,.6)",transition:"width .4s"}}/>
            </div>
            <div style={{width:104,textAlign:"right",flexShrink:0,fontSize:13,color:"#fff",fontWeight:800}}>
              {d.players}
              <span style={{color:BLANC(.35),fontWeight:600,fontSize:11}}> · {d.games}p</span>
              {v.aEvents && d.anon ? <span style={{color:BLANC(.28),fontWeight:600,fontSize:11}}> · {d.anon}a</span> : null}
            </div>
          </div>
        );
      })}
    </div>
    </Panneau>
  );
}

function RubriqueResume(props) {
  const v = props.v, data = props.data, pc = props.pc;
  const fmt = function (n) { return n == null ? "—" : n.toLocaleString("fr-FR"); };
  const at = data.allTime || {};
  const pat = data.playsAllTime;
  const partiesTotal = pat ? Object.keys(pat).reduce(function (s, k) { return s + pat[k].solo + pat[k].online; }, 0) : null;
  const enLigneTotal = (at.duels || 0) + (at.rooms || 0);
  return (
    <>
      <Bloc>
        <div style={{...PANNEAU,boxShadow:G.ombreL,padding:"22px 20px",textAlign:"center"}}>
          <div style={{fontSize:11,letterSpacing:2,color:BLANC(.55),fontWeight:800,textTransform:"uppercase"}}>
            {v.plage === 1 ? "Aujourd'hui" : "Sur " + v.plage + " jours"}
            {v.filtresActifs ? " · filtré" : ""}
          </div>
          <div style={{...posterText(pc?88:76),color:G.projecteur,lineHeight:1}}>{v.actifs}</div>
          <div style={{fontSize:14,color:BLANC(.7),fontWeight:700}}>
            {v.plage === 1 ? "actifs aujourd'hui" : "joueurs actifs · " + v.plage + " j"}
            {v.aEvents ? " · dont " + v.anonymes + " anonyme" + (v.anonymes > 1 ? "s" : "") : ""}
            {" · " + v.parties + " parties"}{v.duels ? " · " + v.duels + " duels" : ""}
          </div>
        </div>
      </Bloc>
      <Bloc titre="📈 Depuis le début">
        <Grille min={pc ? 200 : 150}>
          <Carte valeur={fmt(partiesTotal)} label="parties jouées" color={G.pelouseClaire}
                 sous={pat ? "tous modes confondus" : "table bb_events absente"}/>
          <Carte valeur={fmt(at.games)} label="scores enregistrés" color="#60a5fa"
                 sous="modes qui classent un score"/>
          <Carte valeur={fmt(enLigneTotal)} label="parties en ligne" color="#FF8A2A"
                 sous={fmt(at.duels) + " duels · " + fmt(at.rooms) + " salons"}/>
          <Carte valeur={fmt(at.accounts)} label="comptes créés" color={G.projecteur}
                 sous="depuis le lancement"/>
        </Grille>
      </Bloc>
      <Bloc titre={"Parties sur la fenêtre · " + v.plage + " j"}>
        <Grille min={pc ? 200 : 150}>
          <Carte valeur={v.parties} label={"parties / " + v.plage + " j"} color="#60a5fa"/>
          <Carte valeur={v.totalParties} label={"lancées / " + v.plage + " j"} color={G.pelouseClaire}
                 sous={v.aEvents ? "tous modes" : "bb_events absente"}/>
          <Carte valeur={v.duels} label={"duels / " + v.plage + " j"} color="#FF8A2A"/>
          <Carte valeur={v.joueurs.length} label="joueurs vus" color={G.projecteur}
                 sous={v.joueursInscrits + " inscrits"}/>
        </Grille>
      </Bloc>
      <Bloc titre="Jour par jour · 14 j · heure de Paris">
        <JourParJour v={v}/>
      </Bloc>
    </>
  );
}

function RubriqueAudience(props) {
  const v = props.v, pc = props.pc;
  const os = v.os, totOs = os.ios + os.android + os.other;
  return (
    <>
      <Bloc titre="Jour par jour · 14 j · heure de Paris">
        <JourParJour v={v}/>
        <Note>p = parties terminées · a = joueurs sans compte. La vue couvre toujours
              14 jours ; la plage ne change que les compteurs.</Note>
      </Bloc>
      <Bloc titre={"⏱️ Temps passé dans l'app · " + v.plage + " j"}>
        {!v.sessions ? (
          <Vide>Aucune session mesurée sur cette fenêtre. La mesure ne remonte pas avant le
                déploiement qui l'a introduite.</Vide>
        ) : (
          <>
            <Grille min={pc ? 190 : 140}>
              <Carte petit valeur={formatDuree(v.tempsTotal / v.sessions)} label="par session" color={G.pelouseClaire}/>
              <Carte petit valeur={formatDuree(v.tempsTotal / Math.max(1, v.tempsJoueurs))} label="par joueur" color="#60a5fa"/>
              <Carte petit valeur={formatDuree(v.tempsTotal)} label="temps cumulé" color={G.projecteur}/>
              <Carte petit valeur={v.sessions} label="sessions" color="#C084FC" sous={v.tempsJoueurs + " joueurs"}/>
            </Grille>
            <Note>Seul le temps écran réel compte : app en arrière-plan exclue.</Note>
          </>
        )}
      </Bloc>
      <Bloc titre={"📱 Appareils · " + v.plage + " j"}>
        {totOs === 0 ? (
          <Vide>Aucun appareil identifié sur cette fenêtre.</Vide>
        ) : (
          <>
            <Panneau><Segments parts={[
              { label:"🍎 iOS", n:os.ios, fond:G.creme, encre:G.encre, texte:G.creme },
              { label:"🤖 Android", n:os.android, fond:G.pelouse, encre:"#fff", texte:G.pelouseClaire },
              { label:"💻 Autre", n:os.other, fond:BLANC(.3), texte:BLANC(.55) },
            ]}/></Panneau>
            <Note>Appareils uniques ayant ouvert l'app (depuis l'ajout du suivi OS).</Note>
          </>
        )}
      </Bloc>
    </>
  );
}

function RubriqueModes(props) {
  const v = props.v, data = props.data, pc = props.pc;
  const fenetre = PLAY_MODES.map(function (m) { return Object.assign({}, m, v.parMode[m.key]); })
    .sort(function (a, b) { return b.n - a.n; });
  const maxF = Math.max(1, ...fenetre.map(function (r) { return r.n; }));
  const pat = data.playsAllTime;
  const global = pat ? PLAY_MODES.map(function (m) {
      const c = pat[m.key] || { solo:0, online:0 };
      return Object.assign({}, m, { solo:c.solo, online:c.online, n:c.solo + c.online });
    }).sort(function (a, b) { return b.n - a.n; }) : null;
  const totalGlobal = global ? global.reduce(function (s, r) { return s + r.n; }, 0) : 0;
  const maxG = global ? Math.max(1, ...global.map(function (r) { return r.n; })) : 1;
  const depuis = data.trackingSince
    ? new Date(data.trackingSince).toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" })
    : null;
  return (
    <>
      <Bloc titre={"🎮 Parties par mode · " + v.plage + " j"}>
        {!v.aEvents ? (
          <Vide alerte>⚠️ Table <code>bb_events</code> absente : le suivi par mode arrivera dès qu'elle existe.</Vide>
        ) : v.totalParties === 0 ? (
          <Vide>Aucune partie sur cette fenêtre avec ces filtres.</Vide>
        ) : (
          <>
            <Panneau padding={16}>
            <div style={{display:"grid",gap:13,gridTemplateColumns:pc?"1fr 1fr":"1fr"}}>
              {fenetre.map(function (r, i) {
                return <BarreMode key={r.key} r={r} i={i} total={v.totalParties} max={maxF}
                                  sous={r.solo + " solo" + (r.online ? " · " + r.online + " en ligne" : "")}/>;
              })}
            </div>
            </Panneau>
            <Note droite>{v.totalParties.toLocaleString("fr-FR")} parties lancées sur la fenêtre</Note>
          </>
        )}
      </Bloc>
      <Bloc titre={"Solo vs En ligne · " + v.plage + " j"}>
        {(v.solo + v.enLigne) === 0 ? (
          <Vide>Aucune partie à répartir sur cette fenêtre.</Vide>
        ) : (
          <Panneau><Segments parts={[
            { label:"🎮 Solo", n:v.solo, fond:G.ciel, texte:"#8CC0FF" },
            { label:"🌐 En ligne", n:v.enLigne, fond:G.pelouse, texte:G.pelouseClaire },
          ]}/></Panneau>
        )}
      </Bloc>
      {global ? (
        <Bloc titre="🏆 Parties par mode · depuis le début">
          {totalGlobal === 0 ? (
            <Vide>Aucune partie enregistrée pour l'instant.</Vide>
          ) : (
            <>
              <Panneau padding={16}>
            <div style={{display:"grid",gap:13,gridTemplateColumns:pc?"1fr 1fr":"1fr"}}>
                {global.map(function (r, i) {
                  return <BarreMode key={r.key} r={r} i={i} total={totalGlobal} max={maxG}
                                    sous={r.solo + " solo" + (r.online ? " · " + r.online + " en ligne" : "")}/>;
                })}
              </div>
              </Panneau>
              <Note droite>{totalGlobal.toLocaleString("fr-FR")} parties au total</Note>
              {depuis ? (
                <Note>Suivi par mode démarré le {depuis} — les parties jouées avant ne sont pas
                      comptées ici. Cette section ignore les filtres de mode et de support :
                      elle vient de comptes serveur.</Note>
              ) : null}
            </>
          )}
        </Bloc>
      ) : null}
    </>
  );
}

function RubriqueJoueurs(props) {
  const v = props.v, pc = props.pc;
  const [tri, setTri] = useState("parties");
  const [tout, setTout] = useState(false);
  const classes = useMemo(function () {
    const l = v.joueurs.slice();
    if (tri === "modes") l.sort(function (a, b) { return Object.keys(b.modes).length - Object.keys(a.modes).length || b.n - a.n; });
    if (tri === "pseudo") l.sort(function (a, b) { return String(a.pseudo || "zzz" + a.pid).localeCompare(String(b.pseudo || "zzz" + b.pid)); });
    return l;
  }, [v.joueurs, tri]);
  if (!v.aEvents) return <Bloc titre="👤 Qui joue à quoi"><Vide alerte>⚠️ Table <code>bb_events</code> absente : le détail par joueur en dépend.</Vide></Bloc>;
  if (!classes.length) return <Bloc titre="👤 Qui joue à quoi"><Vide>Aucun joueur ne correspond à ces filtres.</Vide></Bloc>;
  const montres = tout ? classes : classes.slice(0, pc ? 30 : 15);
  return (
    <Bloc titre={"👤 Qui joue à quoi · " + v.plage + " j"}>
      <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end",marginBottom:12}}>
        <div style={{flex:"1 1 200px",fontSize:11,color:G.encre,fontWeight:700,lineHeight:1.5,paddingLeft:4}}>
          {classes.length} joueurs · {v.joueursInscrits} inscrits, {classes.length - v.joueursInscrits} sans
          compte (identifiant d'appareil).
        </div>
        <Choix surOr label="Trier par" valeur={tri} onChange={setTri} options={[
          { v:"parties", l:"Parties" }, { v:"modes", l:"Modes différents" }, { v:"pseudo", l:"Pseudo" },
        ]}/>
      </div>
      <div style={{display:"grid",gap:10,gridTemplateColumns:pc?"repeat(auto-fit, minmax(320px, 1fr))":"1fr"}}>
        {montres.map(function (p, i) {
          const modes = Object.keys(p.modes).map(function (k) { return { k:k, n:p.modes[k], meta:MODES_PAR_CLE[k] }; })
            .sort(function (a, b) { return b.n - a.n; });
          return (
            <div key={p.pid} style={{...PANNEAU,padding:"10px 12px",minWidth:0}}>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <span style={{fontSize:11,color:BLANC(.3),fontWeight:800,minWidth:18}}>{i+1}</span>
                <span style={{...posterText(16,p.pseudo?G.white:BLANC(.5)),
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {p.pseudo ? "@" + p.pseudo : "anonyme · " + p.pid}
                </span>
                <span style={{flex:1}}/>
                <span style={{...posterText(18,G.projecteur),flexShrink:0}}>{p.n}</span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:7}}>
                {modes.map(function (m) {
                  const meta = m.meta || { emoji:"•", label:m.k, color:"#888" };
                  return (
                    <span key={m.k} style={{fontSize:11,fontWeight:700,color:meta.color,
                                            background:meta.color+"22",border:G.traitFin,
                                            borderRadius:G.rayonS,padding:"3px 8px",whiteSpace:"nowrap"}}>
                      {meta.emoji} {meta.label} · {m.n}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {classes.length > montres.length ? (
        <button onClick={function () { setTout(true); }}
          style={{...btn(G.nuit,G.white,15),width:"100%",marginTop:12}}>
          Afficher les {classes.length - montres.length} autres joueurs
        </button>
      ) : null}
    </Bloc>
  );
}

function RubriqueComptes(props) {
  const v = props.v, data = props.data, pc = props.pc;
  return (
    <>
      <Bloc titre="🆔 Derniers comptes créés">
        {!v.comptes.length ? (
          <Vide>Aucun compte à afficher{v.filtresActifs ? " avec ces filtres" : ""}.</Vide>
        ) : (
          <div style={{display:"grid",gap:6,gridTemplateColumns:pc?"repeat(auto-fit, minmax(300px, 1fr))":"1fr"}}>
            {v.comptes.map(function (u, i) {
              const dt = data.recentHasDate && u.created_at ? new Date(u.created_at) : null;
              const quand = dt
                ? dt.toLocaleDateString("fr-FR", { day:"numeric", month:"short" }) + " · " +
                  dt.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" })
                : "";
              return (
                <div key={i} style={{...PANNEAU,display:"flex",alignItems:"center",gap:10,
                                     padding:"10px 14px",minWidth:0}}>
                  <span style={{fontSize:16,width:22,textAlign:"center",flexShrink:0}}>
                    {u.country ? countryToFlag(u.country) : "🌍"}
                  </span>
                  <span style={{flex:1,...posterText(17,G.white),overflow:"hidden",
                                textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{u.pseudo}</span>
                  <span style={{fontSize:12,color:BLANC(.45),fontWeight:600,flexShrink:0}}>{quand}</span>
                </div>
              );
            })}
          </div>
        )}
        {data.recent && data.recent.length && !data.recentHasDate ? (
          <Note>⚠️ La date de création n'est pas enregistrée (colonne <code>created_at</code> absente
                de bb_pseudos).</Note>
        ) : null}
      </Bloc>
      <Bloc titre="Comptes · total">
        <Grille min={pc ? 200 : 150}>
          <Carte valeur={(data.accounts || 0).toLocaleString("fr-FR")} label="comptes créés" color={G.projecteur}/>
          <Carte valeur={v.joueursInscrits} label={"inscrits actifs · " + v.plage + " j"} color={G.pelouseClaire}/>
          <Carte valeur={v.anonymes} label={"anonymes · " + v.plage + " j"} color="#60a5fa"
                 sous={v.aEvents ? "identifiant d'appareil" : "bb_events absente"}/>
        </Grille>
      </Bloc>
    </>
  );
}

// ── Le tableau de bord ───────────────────────────────────────────────────────
export default function Tracking(props) {
  const sb = props.sb;
  const [data, setData] = useState(null);
  const [liveNow, setLiveNow] = useState(null);
  const [rubrique, setRubrique] = useState("resume");
  // Ouvert sur PLAGE_DEFAUT et non sur la plage neutre : la première question
  // qu'on se pose en ouvrant le tableau de bord est « et aujourd'hui ? ».
  const [filtres, setFiltres] = useState(Object.assign({}, FILTRES_VIDES, { plage: PLAGE_DEFAUT }));
  const [largeur, setLargeur] = useState(function () {
    try { return window.innerWidth; } catch (e) { return 390; }
  });
  const pc = largeur >= SEUIL_PC;

  useEffect(function () {
    function onResize() { setLargeur(window.innerWidth); }
    window.addEventListener("resize", onResize);
    return function () { window.removeEventListener("resize", onResize); };
  }, []);

  // « En ce moment » — rafraîchi toutes les 15 s tant que le dashboard est ouvert.
  useEffect(function () {
    let stop = false;
    async function poll() {
      const depuis = new Date(Date.now() - 80 * 1000).toISOString(); // vu dans les 80 dernières s
      const rows = await sb.fetchAll("bb_presence?select=player_id&last_seen=gte." + depuis + "&order=player_id.asc", 10000);
      if (!stop) setLiveNow(Array.isArray(rows) ? rows.length : null);
    }
    poll();
    const iv = setInterval(poll, 15000);
    return function () { stop = true; clearInterval(iv); };
  }, [sb]);

  // Chargement : la fenêtre MAX une seule fois, le filtrage se fait côté client.
  useEffect(function () {
    if (data) return;
    let mort = false;
    (async function () {
      const depuis = new Date(Date.now() - FENETRE_MAX * 24 * 3600 * 1000).toISOString();
      // fetchAll et pas fetch : au-delà de 1000 lignes l'API tronque en silence,
      // et 14 jours de bb_events dépassent largement ce seuil.
      // `mode` est demandé sur bb_scores pour que le filtre de mode s'applique
      // aussi aux scores, et pas seulement aux événements.
      const scores = await sb.fetchAll("bb_scores?select=player_id,created_at,mode&created_at=gte." + depuis + "&order=created_at.desc", 20000) || [];
      const events = await sb.fetchAll("bb_events?select=player_id,created_at,type&created_at=gte." + depuis + "&order=created_at.desc", 50000);
      const aEvents = Array.isArray(events);
      const pseudos = await sb.fetchAll("bb_pseudos?select=player_id,pseudo&order=player_id.asc", 100000) || [];
      const duels = await sb.fetchAll("bb_duels?select=id,created_at&created_at=gte." + depuis + "&order=created_at.desc", 20000) || [];
      // Jour calendaire (Paris) attaché UNE fois par ligne : le regroupement et le
      // filtrage se font ensuite par comparaison de chaînes, sans repasser par Intl.
      for (const r of scores) r.day = parisDayOf(r.created_at);
      if (aEvents) for (const r of events) r.day = parisDayOf(r.created_at);
      let recent = await sb.fetch("bb_pseudos?select=pseudo,country,created_at&order=created_at.desc&limit=60");
      let recentHasDate = true;
      if (!recent) { recentHasDate = false; recent = await sb.fetch("bb_pseudos?select=pseudo,country&limit=60") || []; }
      const allTime = {
        games:    await sb.count("bb_scores"),
        duels:    await sb.count("bb_duels"),
        rooms:    await sb.count("bb_rooms"),
        accounts: await sb.count("bb_pseudos"),
        grid:     await sb.count("bb_gg_scores"),
      };
      // Répartition par mode sur TOUT l'historique : des comptes exacts par type,
      // sans transférer de lignes, donc léger même quand bb_events grossit.
      let playsAllTime = null, trackingSince = null;
      if (aEvents) {
        playsAllTime = {};
        await Promise.all(PLAY_MODES.map(async function (m) {
          const paire = await Promise.all([
            sb.count("bb_events", "type=eq.play_" + m.key),
            sb.count("bb_events", "type=eq.play_" + m.key + "_online"),
          ]);
          playsAllTime[m.key] = { solo: paire[0] || 0, online: paire[1] || 0 };
        }));
        const premier = await sb.fetch("bb_events?select=created_at&type=like.play_*&order=created_at.asc&limit=1");
        if (Array.isArray(premier) && premier[0]) trackingSince = premier[0].created_at;
      }
      if (mort) return;
      setData({
        rawScores: scores, rawEvents: aEvents ? events : null, hasEvents: aEvents,
        regIds: pseudos.map(function (p) { return p.player_id; }),
        pseudoById: pseudos.reduce(function (a, p) { if (p.pseudo) a[p.player_id] = p.pseudo; return a; }, {}),
        accounts: pseudos.length,
        rawDuels: duels.map(function (d) { return parisDayOf(d.created_at); }),
        recent: recent, recentHasDate: recentHasDate,
        allTime: allTime, playsAllTime: playsAllTime, trackingSince: trackingSince,
      });
    })();
    return function () { mort = true; };
  }, [data, sb]);

  // parisLastDays dépend de l'heure : figé au chargement des données pour que le
  // découpage des jours ne bouge pas sous les pieds à chaque changement de filtre.
  const jours = useMemo(function () { return parisLastDays(FENETRE_MAX, Date.now()); }, [data]);
  const v = useMemo(function () { return agregeTracking(data, filtres, jours); }, [data, filtres, jours]);

  const majFiltre = function (cle) {
    return function (val) { setFiltres(function (f) { return Object.assign({}, f, { [cle]: val }); }); };
  };

  const enTete = (
    <div style={{textAlign:pc?"left":"center",marginBottom:pc?18:0}}>
      <div style={{fontSize:11,letterSpacing:3,color:BLANC(.55),fontWeight:800,textTransform:"uppercase"}}>
        Tableau de bord · privé
      </div>
      <div style={{...posterText(pc?30:36),letterSpacing:2,color:G.creme,marginTop:4}}>
        GOAT <span style={{color:G.projecteur}}>STATS</span>
      </div>
    </div>
  );

  const enCeMoment = (
    <div style={{...PANNEAU,padding:"16px 18px",display:"flex",alignItems:"center",gap:14,overflow:"hidden"}}>
      <div style={{position:"relative",width:12,height:12,flexShrink:0}}>
        <span style={{position:"absolute",inset:0,borderRadius:"50%",background:G.pelouse,boxShadow:"0 0 10px #00E676"}}/>
        <span style={{position:"absolute",inset:-4,borderRadius:"50%",border:"2px solid #00E676",
                      animation:"livePulse 1.8s ease-out infinite"}}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:11,letterSpacing:2,color:BLANC(.6),fontWeight:800,textTransform:"uppercase"}}>
          En ce moment
        </div>
        <div style={{fontSize:12,color:BLANC(.45),fontWeight:600,marginTop:1}}>
          {liveNow == null ? "table bb_presence à créer" : (liveNow > 1 ? "personnes sur l'app" : "personne sur l'app")}
        </div>
      </div>
      <div style={{...posterText(44),color:G.pelouseClaire,lineHeight:1}}>{liveNow == null ? "—" : liveNow}</div>
    </div>
  );

  const boutonRafraichir = (
    <button onClick={function () { setData(null); }}
      style={{...btn(G.nuit,G.white,16),width:"100%"}}>
      ↻ Rafraîchir
    </button>
  );

  const barreFiltres = v ? (
    <div style={{...PANNEAU,padding:"12px 14px",marginBottom:18,
                 display:"flex",flexWrap:"wrap",gap:12,alignItems:"flex-end"}}>
      <Choix label="Plage" valeur={String(filtres.plage)}
             onChange={function (x) { majFiltre("plage")(parseInt(x, 10)); }}
             options={[{v:"1",l:"Aujourd'hui"},{v:"5",l:"5 jours"},{v:"10",l:"10 jours"},{v:"14",l:"14 jours"}]}/>
      <Choix label="Mode" valeur={filtres.mode} onChange={majFiltre("mode")} actif={filtres.mode !== "tous"}
             options={[{v:"tous",l:"Tous les modes"}].concat(PLAY_MODES.map(function (m) {
               return { v:m.key, l:m.emoji + " " + m.label };
             }))}/>
      <Choix label="Public" valeur={filtres.public} onChange={majFiltre("public")} actif={filtres.public !== "tous"}
             options={[{v:"tous",l:"Tout le monde"},{v:"inscrits",l:"Inscrits"},{v:"anonymes",l:"Sans compte"}]}/>
      <Choix label="Support" valeur={filtres.support} onChange={majFiltre("support")} actif={filtres.support !== "tous"}
             options={[{v:"tous",l:"Solo + en ligne"},{v:"solo",l:"Solo"},{v:"en-ligne",l:"En ligne"}]}/>
      <label style={{display:"flex",flexDirection:"column",gap:5,flex:"2 1 200px",minWidth:0}}>
        <span style={{fontSize:10,letterSpacing:1.5,color:BLANC(.5),fontWeight:800,textTransform:"uppercase"}}>
          Joueur
        </span>
        <input value={filtres.recherche} onChange={function (e) { majFiltre("recherche")(e.target.value); }}
          placeholder="pseudo ou identifiant…"
          style={{width:"100%",padding:"9px 11px",borderRadius:G.rayonS,boxSizing:"border-box",
                  border:G.traitFin,background:filtres.recherche?G.projecteur:G.bgCard,
                  color:filtres.recherche?G.encre:"#fff",fontFamily:G.font,fontWeight:700,fontSize:13}}/>
      </label>
      {v.filtresActifs ? (
        <button onClick={function () { setFiltres(Object.assign({}, FILTRES_VIDES, { plage: filtres.plage })); }}
          style={{...btn(G.maillot,G.white,14),padding:"9px 14px"}}>
          ✕ {v.filtresActifs} filtre{v.filtresActifs > 1 ? "s" : ""}
        </button>
      ) : null}
    </div>
  ) : null;

  const contenu = !v ? (
    <div style={{textAlign:"center",padding:"60px 0",...posterText(22,G.encre,0)}}>⏳ Chargement…</div>
  ) : (
    <>
      {barreFiltres}
      {rubrique === "resume"   ? <RubriqueResume   v={v} data={data} pc={pc}/> : null}
      {rubrique === "audience" ? <RubriqueAudience v={v} data={data} pc={pc}/> : null}
      {rubrique === "modes"    ? <RubriqueModes    v={v} data={data} pc={pc}/> : null}
      {rubrique === "joueurs"  ? <RubriqueJoueurs  v={v} data={data} pc={pc}/> : null}
      {rubrique === "comptes"  ? <RubriqueComptes  v={v} data={data} pc={pc}/> : null}
      <div style={{textAlign:"center",fontSize:11,fontWeight:700,color:G.encre,
                   marginTop:16,lineHeight:1.5}}>
        {v.aEvents
          ? "Actifs = joueurs uniques (inscrits + anonymes) vus dans la fenêtre, heure de Paris. « Parties » = parties terminées avec un score."
          : "⚠️ Table bb_events absente : les anonymes ne sont pas comptés et le détail par mode est indisponible."}
      </div>
    </>
  );

  // Le fond de l'app, pas un dégradé vert à part : ce tableau de bord est la
  // même maison. `isolation:isolate` est indispensable — l'arène est un calque à
  // zIndex -1, et sans contexte d'empilement elle passerait derrière ce fond.

  if (pc) {
    return (
      <div style={{position:"fixed",inset:0,zIndex:9999,background:fondCharte,overflowY:"auto",
                   isolation:"isolate",fontFamily:G.font,display:"flex",alignItems:"flex-start"}}>
        {areneCharte}
        {/* La barre latérale prend l'encre du bandeau de l'app : sur l'or, une
            colonne translucide virerait au khaki et ses libellés avec elle. */}
        <aside style={{position:"sticky",top:0,width:262,flexShrink:0,alignSelf:"stretch",zIndex:2,
                       background:G.encre,borderRight:G.trait,padding:"26px 18px",
                       display:"flex",flexDirection:"column",gap:14}}>
          {enTete}
          {enCeMoment}
          <Onglets colonne options={RUBRIQUES} valeur={rubrique} onChange={setRubrique}/>
          <div style={{flex:1}}/>
          {boutonRafraichir}
        </aside>
        <main style={{flex:1,minWidth:0,zIndex:1,padding:"26px 30px 60px",maxWidth:1500}}>{contenu}</main>
      </div>
    );
  }

  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:fondCharte,overflowY:"auto",
                 isolation:"isolate",WebkitOverflowScrolling:"touch",fontFamily:G.font,
                 paddingBottom:"calc(40px + env(safe-area-inset-bottom))"}}>
      {areneCharte}
      {/* Bandeau d'encre collant, comme le classement : le titre y est dans un
          panneau, donc il peut prendre l'or. Posé à nu sur le fond, il aurait
          disparu — sur l'or, seule l'encre se lit. */}
      <div style={{position:"sticky",top:0,zIndex:3,background:G.encre,borderBottom:G.traitFin,
                   padding:"max(14px, env(safe-area-inset-top)) 20px 14px",textAlign:"center"}}>
        {enTete}
      </div>
      <div style={{maxWidth:560,margin:"0 auto",padding:"18px 20px 0"}}>
        <div style={{marginBottom:14}}>{enCeMoment}</div>
        <div style={{marginBottom:14}}>{boutonRafraichir}</div>
        <div style={{marginBottom:16}}>
          <Onglets options={RUBRIQUES} valeur={rubrique} onChange={setRubrique}/>
        </div>
        {contenu}
      </div>
    </div>
  );
}
