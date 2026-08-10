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
import { G, posterText } from "../lib/charte.jsx";
import { countryToFlag } from "../lib/leaderboard";
import { parisDayOf, parisLastDays } from "../lib/days";
import { PLAY_MODES, MODES_PAR_CLE, RUBRIQUES, FILTRES_VIDES,
         agregeTracking, formatDuree } from "../lib/tracking.js";

const SEUIL_PC = 1000;          // au-delà : barre latérale et grilles multi-colonnes
const FENETRE_MAX = 14;         // jours rapatriés ; les plages plus courtes filtrent côté client
const BLANC = function (a) { return "rgba(255,255,255," + a + ")"; };

// ── Briques visuelles communes ───────────────────────────────────────────────
function Titre(props) {
  return (
    <div style={{fontSize:11,letterSpacing:2,color:BLANC(.4),fontWeight:800,
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

function Vide(props) {
  return (
    <div style={{fontSize:12.5,color:props.alerte?"rgba(255,200,0,.7)":BLANC(.45),
                 background:BLANC(.04),border:"1px solid "+BLANC(.07),
                 borderRadius:12,padding:14,lineHeight:1.5}}>
      {props.children}
    </div>
  );
}

function Carte(props) {
  const c = props.color || G.pelouseClaire;
  return (
    <div style={{background:"linear-gradient(150deg, "+c+"1f, "+BLANC(.03)+" 60%, rgba(0,0,0,.2))",
                 border:"1px solid "+c+"44",borderRadius:18,padding:"16px 14px",textAlign:"center",minWidth:0}}>
      <div style={{...posterText(props.petit?24:38),color:c,lineHeight:1.1,
                   textShadow:"0 0 20px "+c+"40",overflowWrap:"anywhere"}}>{props.valeur}</div>
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
      <div style={{height:22,background:BLANC(.05),borderRadius:8,overflow:"hidden"}}>
        <div style={{height:"100%",width:Math.round(r.n/props.max*100)+"%",minWidth:r.n?8:0,
                     background:r.color,opacity:i===0?1:.55,borderRadius:8,transition:"width .4s"}}/>
      </div>
      {props.sous ? <div style={{fontSize:10.5,color:BLANC(.34),fontWeight:600,marginTop:3}}>{props.sous}</div> : null}
    </div>
  );
}

function Segments(props) {
  const total = props.parts.reduce(function (s, p) { return s + p.n; }, 0) || 1;
  return (
    <>
      <div style={{display:"flex",height:34,borderRadius:10,overflow:"hidden",border:"1px solid "+BLANC(.1)}}>
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
                    padding:props.colonne?"11px 14px":"10px 14px",borderRadius:12,cursor:"pointer",
                    whiteSpace:"nowrap",fontFamily:G.font,fontWeight:800,fontSize:13.5,
                    border:"1px solid "+(actif?G.pelouse:BLANC(.14)),
                    background:actif?"rgba(0,230,118,.16)":BLANC(.04),
                    color:actif?G.pelouseClaire:BLANC(.6),transition:"all .15s"}}>
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
      <span style={{fontSize:10,letterSpacing:1.5,color:BLANC(.4),fontWeight:800,textTransform:"uppercase"}}>
        {props.label}
      </span>
      <select value={props.valeur} onChange={function (e) { props.onChange(e.target.value); }}
        style={{appearance:"none",width:"100%",padding:"9px 11px",borderRadius:10,cursor:"pointer",
                border:"1px solid "+(props.actif?G.pelouse:BLANC(.14)),
                background:props.actif?"rgba(0,230,118,.14)":"rgba(10,20,14,.9)",
                color:props.actif?G.pelouseClaire:"#fff",fontFamily:G.font,fontWeight:700,fontSize:13}}>
        {props.options.map(function (o) {
          return <option key={o.v} value={o.v} style={{background:"#0A140E"}}>{o.l}</option>;
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
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {v.parJour.map(function (d, i) {
        return (
          <div key={d.day} style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:104,flexShrink:0,fontSize:12.5,textTransform:"capitalize",
                         color:i===0?G.pelouseClaire:BLANC(.6),fontWeight:i===0?800:600}}>
              {i===0 ? "Aujourd'hui" : jolieDate(d.day)}
            </div>
            <div style={{flex:1,height:26,background:BLANC(.05),borderRadius:8,overflow:"hidden",minWidth:40}}>
              <div style={{height:"100%",width:Math.round(d.players/max*100)+"%",minWidth:d.players?8:0,
                           background:i===0?"linear-gradient(90deg,#00E676,#B9F600)":"rgba(96,165,250,.55)",
                           borderRadius:8,transition:"width .4s"}}/>
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
        <div style={{background:"linear-gradient(160deg, rgba(0,230,118,.16), "+BLANC(.03)+" 55%, rgba(0,0,0,.25))",
                     border:"1px solid rgba(0,230,118,.35)",borderRadius:22,padding:"22px 20px",
                     textAlign:"center",boxShadow:"0 16px 44px -16px rgba(0,230,118,.4)"}}>
          <div style={{fontSize:11,letterSpacing:2,color:BLANC(.55),fontWeight:800,textTransform:"uppercase"}}>
            {v.plage === 1 ? "Aujourd'hui" : "Sur " + v.plage + " jours"}
            {v.filtresActifs ? " · filtré" : ""}
          </div>
          <div style={{...posterText(pc?88:76),color:G.pelouseClaire,lineHeight:1,
                       textShadow:"0 0 26px rgba(0,230,118,.45)"}}>{v.actifs}</div>
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
        <div style={{fontSize:11,color:BLANC(.3),fontWeight:600,marginTop:8,paddingLeft:4,lineHeight:1.5}}>
          p = parties terminées · a = joueurs sans compte. La vue couvre toujours 14 jours ;
          la plage ne change que les compteurs.
        </div>
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
            <div style={{fontSize:11,color:BLANC(.3),fontWeight:600,marginTop:8,paddingLeft:4,lineHeight:1.5}}>
              Seul le temps écran réel compte : app en arrière-plan exclue.
            </div>
          </>
        )}
      </Bloc>
      <Bloc titre={"📱 Appareils · " + v.plage + " j"}>
        {totOs === 0 ? (
          <Vide>Aucun appareil identifié sur cette fenêtre.</Vide>
        ) : (
          <>
            <Segments parts={[
              { label:"🍎 iOS", n:os.ios, fond:BLANC(.75), encre:"#000", texte:"#fff" },
              { label:"🤖 Android", n:os.android, fond:"linear-gradient(90deg,#3DDC84,#00E676)", encre:"#0A1410", texte:"#3DDC84" },
              { label:"💻 Autre", n:os.other, fond:BLANC(.25), texte:BLANC(.5) },
            ]}/>
            <div style={{fontSize:10.5,color:BLANC(.3),marginTop:6,paddingLeft:4}}>
              Appareils uniques ayant ouvert l'app (depuis l'ajout du suivi OS).
            </div>
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
            <div style={{display:"grid",gap:13,gridTemplateColumns:pc?"1fr 1fr":"1fr"}}>
              {fenetre.map(function (r, i) {
                return <BarreMode key={r.key} r={r} i={i} total={v.totalParties} max={maxF}
                                  sous={r.solo + " solo" + (r.online ? " · " + r.online + " en ligne" : "")}/>;
              })}
            </div>
            <div style={{textAlign:"right",fontSize:11,color:BLANC(.35),fontWeight:600,paddingRight:4,marginTop:10}}>
              {v.totalParties.toLocaleString("fr-FR")} parties lancées sur la fenêtre
            </div>
          </>
        )}
      </Bloc>
      <Bloc titre={"Solo vs En ligne · " + v.plage + " j"}>
        {(v.solo + v.enLigne) === 0 ? (
          <Vide>Aucune partie à répartir sur cette fenêtre.</Vide>
        ) : (
          <Segments parts={[
            { label:"🎮 Solo", n:v.solo, fond:"rgba(96,165,250,.55)", texte:"#8CC0FF" },
            { label:"🌐 En ligne", n:v.enLigne, fond:"linear-gradient(90deg,#00E676,#B9F600)", encre:"#0A1410", texte:G.pelouseClaire },
          ]}/>
        )}
      </Bloc>
      {global ? (
        <Bloc titre="🏆 Parties par mode · depuis le début">
          {totalGlobal === 0 ? (
            <Vide>Aucune partie enregistrée pour l'instant.</Vide>
          ) : (
            <>
              <div style={{display:"grid",gap:13,gridTemplateColumns:pc?"1fr 1fr":"1fr"}}>
                {global.map(function (r, i) {
                  return <BarreMode key={r.key} r={r} i={i} total={totalGlobal} max={maxG}
                                    sous={r.solo + " solo" + (r.online ? " · " + r.online + " en ligne" : "")}/>;
                })}
              </div>
              <div style={{textAlign:"right",fontSize:11,color:BLANC(.35),fontWeight:600,paddingRight:4,marginTop:10}}>
                {totalGlobal.toLocaleString("fr-FR")} parties au total
              </div>
              {depuis ? (
                <div style={{fontSize:11,color:BLANC(.3),fontWeight:600,lineHeight:1.5,marginTop:6,paddingLeft:4}}>
                  Suivi par mode démarré le {depuis} — les parties jouées avant ne sont pas comptées ici.
                  Cette section ignore les filtres de mode et de support : elle vient de comptes serveur.
                </div>
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
        <div style={{flex:"1 1 200px",fontSize:11,color:BLANC(.35),fontWeight:600,lineHeight:1.5,paddingLeft:4}}>
          {classes.length} joueurs · {v.joueursInscrits} inscrits, {classes.length - v.joueursInscrits} sans
          compte (identifiant d'appareil).
        </div>
        <Choix label="Trier par" valeur={tri} onChange={setTri} options={[
          { v:"parties", l:"Parties" }, { v:"modes", l:"Modes différents" }, { v:"pseudo", l:"Pseudo" },
        ]}/>
      </div>
      <div style={{display:"grid",gap:10,gridTemplateColumns:pc?"repeat(auto-fit, minmax(320px, 1fr))":"1fr"}}>
        {montres.map(function (p, i) {
          const modes = Object.keys(p.modes).map(function (k) { return { k:k, n:p.modes[k], meta:MODES_PAR_CLE[k] }; })
            .sort(function (a, b) { return b.n - a.n; });
          return (
            <div key={p.pid} style={{background:BLANC(.04),border:"1px solid "+BLANC(.08),
                                     borderRadius:12,padding:"10px 12px",minWidth:0}}>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <span style={{fontSize:11,color:BLANC(.3),fontWeight:800,minWidth:18}}>{i+1}</span>
                <span style={{fontSize:13,fontWeight:800,color:p.pseudo?"#fff":BLANC(.5),
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {p.pseudo ? "@" + p.pseudo : "anonyme · " + p.pid}
                </span>
                <span style={{flex:1}}/>
                <span style={{fontSize:13,fontWeight:800,color:G.pelouseClaire,flexShrink:0}}>{p.n}</span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:7}}>
                {modes.map(function (m) {
                  const meta = m.meta || { emoji:"•", label:m.k, color:"#888" };
                  return (
                    <span key={m.k} style={{fontSize:11,fontWeight:700,color:meta.color,
                                            background:meta.color+"1a",border:"1px solid "+meta.color+"33",
                                            borderRadius:999,padding:"3px 8px",whiteSpace:"nowrap"}}>
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
          style={{width:"100%",marginTop:12,padding:11,borderRadius:12,cursor:"pointer",
                  border:"1px solid "+BLANC(.15),background:BLANC(.05),color:"#fff",
                  fontFamily:G.font,fontWeight:800,fontSize:13}}>
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
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:BLANC(.04),
                                     border:"1px solid "+BLANC(.07),borderRadius:12,padding:"10px 14px",minWidth:0}}>
                  <span style={{fontSize:16,width:22,textAlign:"center",flexShrink:0}}>
                    {u.country ? countryToFlag(u.country) : "🌍"}
                  </span>
                  <span style={{flex:1,fontSize:14,fontWeight:800,color:"#fff",overflow:"hidden",
                                textOverflow:"ellipsis",whiteSpace:"nowrap"}}>@{u.pseudo}</span>
                  <span style={{fontSize:12,color:BLANC(.45),fontWeight:600,flexShrink:0}}>{quand}</span>
                </div>
              );
            })}
          </div>
        )}
        {data.recent && data.recent.length && !data.recentHasDate ? (
          <div style={{fontSize:11,color:"rgba(255,200,0,.7)",marginTop:10,paddingLeft:4}}>
            ⚠️ La date de création n'est pas enregistrée (colonne <code>created_at</code> absente de bb_pseudos).
          </div>
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
  const [filtres, setFiltres] = useState(FILTRES_VIDES);
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
    <div style={{textAlign:pc?"left":"center",marginBottom:pc?18:20}}>
      <div style={{fontSize:11,letterSpacing:3,color:BLANC(.45),fontWeight:800,textTransform:"uppercase"}}>
        Tableau de bord · privé
      </div>
      <div style={{...posterText(pc?30:34),letterSpacing:2,color:"#fff",marginTop:4}}>
        GOAT <span style={{color:G.pelouseClaire}}>STATS</span>
      </div>
    </div>
  );

  const enCeMoment = (
    <div style={{background:"linear-gradient(135deg, rgba(0,230,118,.18), rgba(0,0,0,.25))",
                 border:"1px solid rgba(0,230,118,.4)",borderRadius:18,padding:"16px 18px",
                 display:"flex",alignItems:"center",gap:14,overflow:"hidden"}}>
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
      <div style={{...posterText(44),color:G.pelouseClaire,lineHeight:1,
                   textShadow:"0 0 20px rgba(0,230,118,.45)"}}>{liveNow == null ? "—" : liveNow}</div>
    </div>
  );

  const boutonRafraichir = (
    <button onClick={function () { setData(null); }}
      style={{width:"100%",padding:11,borderRadius:12,cursor:"pointer",border:"1px solid "+BLANC(.15),
              background:BLANC(.05),color:"#fff",fontFamily:G.font,fontWeight:800,fontSize:14}}>
      ↻ Rafraîchir
    </button>
  );

  const barreFiltres = v ? (
    <div style={{background:"rgba(8,16,11,.86)",border:"1px solid "+BLANC(.09),borderRadius:16,
                 padding:"12px 14px",marginBottom:18,
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
        <span style={{fontSize:10,letterSpacing:1.5,color:BLANC(.4),fontWeight:800,textTransform:"uppercase"}}>
          Joueur
        </span>
        <input value={filtres.recherche} onChange={function (e) { majFiltre("recherche")(e.target.value); }}
          placeholder="pseudo ou identifiant…"
          style={{width:"100%",padding:"9px 11px",borderRadius:10,boxSizing:"border-box",
                  border:"1px solid "+(filtres.recherche?G.pelouse:BLANC(.14)),
                  background:filtres.recherche?"rgba(0,230,118,.14)":"rgba(10,20,14,.9)",
                  color:"#fff",fontFamily:G.font,fontWeight:700,fontSize:13}}/>
      </label>
      {v.filtresActifs ? (
        <button onClick={function () { setFiltres(Object.assign({}, FILTRES_VIDES, { plage: filtres.plage })); }}
          style={{padding:"9px 14px",borderRadius:10,cursor:"pointer",border:"1px solid "+BLANC(.2),
                  background:BLANC(.06),color:"#fff",fontFamily:G.font,fontWeight:800,fontSize:12.5}}>
          ✕ {v.filtresActifs} filtre{v.filtresActifs > 1 ? "s" : ""}
        </button>
      ) : null}
    </div>
  ) : null;

  const contenu = !v ? (
    <div style={{textAlign:"center",padding:"60px 0",color:BLANC(.5),fontSize:15}}>⏳ Chargement…</div>
  ) : (
    <>
      {barreFiltres}
      {rubrique === "resume"   ? <RubriqueResume   v={v} data={data} pc={pc}/> : null}
      {rubrique === "audience" ? <RubriqueAudience v={v} data={data} pc={pc}/> : null}
      {rubrique === "modes"    ? <RubriqueModes    v={v} data={data} pc={pc}/> : null}
      {rubrique === "joueurs"  ? <RubriqueJoueurs  v={v} data={data} pc={pc}/> : null}
      {rubrique === "comptes"  ? <RubriqueComptes  v={v} data={data} pc={pc}/> : null}
      <div style={{textAlign:"center",fontSize:11,color:v.aEvents?BLANC(.3):"rgba(255,200,0,.7)",
                   marginTop:16,lineHeight:1.5}}>
        {v.aEvents
          ? "Actifs = joueurs uniques (inscrits + anonymes) vus dans la fenêtre, heure de Paris. « Parties » = parties terminées avec un score."
          : "⚠️ Table bb_events absente : les anonymes ne sont pas comptés et le détail par mode est indisponible."}
      </div>
    </>
  );

  const fond = "radial-gradient(ellipse 120% 60% at 50% 0%, #0f2a1a 0%, #060d09 60%, #030603 100%)";

  if (pc) {
    return (
      <div style={{position:"fixed",inset:0,zIndex:9999,background:fond,overflowY:"auto",
                   fontFamily:G.font,display:"flex",alignItems:"flex-start"}}>
        <aside style={{position:"sticky",top:0,width:262,flexShrink:0,alignSelf:"stretch",
                       padding:"26px 18px",borderRight:"1px solid "+BLANC(.08),
                       display:"flex",flexDirection:"column",gap:14}}>
          {enTete}
          {enCeMoment}
          <Onglets colonne options={RUBRIQUES} valeur={rubrique} onChange={setRubrique}/>
          <div style={{flex:1}}/>
          {boutonRafraichir}
        </aside>
        <main style={{flex:1,minWidth:0,padding:"26px 30px 60px",maxWidth:1500}}>{contenu}</main>
      </div>
    );
  }

  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:fond,overflowY:"auto",
                 WebkitOverflowScrolling:"touch",fontFamily:G.font,
                 padding:"calc(30px + env(safe-area-inset-top)) 20px calc(40px + env(safe-area-inset-bottom))"}}>
      <div style={{maxWidth:560,margin:"0 auto"}}>
        {enTete}
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
