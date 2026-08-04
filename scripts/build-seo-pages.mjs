// Génère les pages SEO statiques dans dist/ après le build Vite.
//
// Pourquoi : l'app est une SPA React rendue côté client. Google sait exécuter
// JavaScript, mais l'indexation est plus lente et moins fiable qu'avec du HTML
// servi tel quel. Ces pages sont du HTML pur, avec un contenu unique par mode
// de jeu, et renvoient vers l'app via /?play=<mode>.
//
// Elles sont régénérées à chaque `npm run build` — ne pas les éditer à la main,
// modifier scripts/seo-pages.data.mjs à la place.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES, SITE } from "./seo-pages.data.mjs";

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderSection(s) {
  const parts = [`<h2>${esc(s.h2)}</h2>`];
  if (s.body) parts.push(...s.body.map((p) => `<p>${esc(p)}</p>`));
  if (s.list) {
    parts.push(
      "<ul>" +
        s.list
          .map(([t, d]) => `<li><strong>${esc(t)}</strong> — ${esc(d)}</li>`)
          .join("") +
        "</ul>"
    );
  }
  return parts.join("\n        ");
}

function renderPage(p) {
  const url = `${SITE}/${p.slug}/`;
  const others = PAGES.filter((o) => o.slug !== p.slug);

  // JSON-LD. Le FAQPage ne liste que des questions réellement affichées sur la
  // page : baliser des contenus invisibles est une violation des règles Google.
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: `${p.name} — GOAT FC`,
      url,
      description: p.description,
      image: SITE + p.img,
      inLanguage: "fr-FR",
      genre: ["Quiz", "Sports", "Football"],
      gamePlatform: ["Web browser", "iOS", "Android"],
      applicationCategory: "GameApplication",
      operatingSystem: "Web",
      publisher: { "@type": "Organization", name: "GOAT FC", url: SITE + "/" },
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "GOAT FC", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: p.name, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

    <title>${esc(p.title)}</title>
    <meta name="description" content="${esc(p.description)}" />
    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta name="theme-color" content="#0A1410" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="GOAT FC" />
    <meta property="og:locale" content="fr_FR" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(p.title)}" />
    <meta property="og:description" content="${esc(p.description)}" />
    <meta property="og:image" content="${SITE}/og-share.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(p.title)}" />
    <meta name="twitter:description" content="${esc(p.description)}" />
    <meta name="twitter:image" content="${SITE}/og-share.jpg" />

    <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />

${ld.map((o) => `    <script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}

    <style>
      *{ box-sizing: border-box; }
      html, body { margin:0; padding:0; background:#0A1410; color:#fff;
        font-family:Inter,system-ui,-apple-system,sans-serif; line-height:1.65;
        color-scheme:dark; -webkit-text-size-adjust:100%; }
      a { color:${p.accent}; }
      .wrap { max-width:820px; margin:0 auto; padding:24px 20px 72px; }
      header.top { display:flex; align-items:center; justify-content:space-between; gap:16px;
        padding:8px 0 32px; }
      header.top img { height:40px; width:auto; }
      .badge { display:inline-block; font-family:Anton,sans-serif; font-size:12px;
        letter-spacing:.25em; padding:6px 14px; border-radius:999px;
        background:${p.accent}1F; color:${p.accent}; border:1px solid ${p.accent}55; }
      h1 { font-family:Anton,sans-serif; font-weight:400; font-size:clamp(34px,6.5vw,58px);
        line-height:1.05; letter-spacing:.01em; margin:18px 0 8px; }
      .tagline { font-family:Anton,sans-serif; font-size:clamp(18px,3vw,26px);
        letter-spacing:.12em; color:${p.accent}; margin:0 0 22px; }
      h2 { font-family:Anton,sans-serif; font-weight:400; font-size:clamp(24px,3.6vw,34px);
        letter-spacing:.02em; margin:44px 0 10px; }
      h3 { font-size:18px; margin:32px 0 8px; }
      p { color:rgba(255,255,255,.78); margin:0 0 14px; }
      .lead { font-size:clamp(17px,2.2vw,20px); color:rgba(255,255,255,.9); }
      ul { color:rgba(255,255,255,.78); padding-left:22px; margin:0 0 14px; }
      li { margin-bottom:10px; }
      strong { color:#fff; }
      .hero { display:flex; gap:28px; align-items:center; flex-wrap:wrap; margin-bottom:8px; }
      .hero-txt { flex:1 1 320px; min-width:0; }
      .hero img { width:190px; max-width:42vw; height:auto; border-radius:16px;
        box-shadow:0 20px 50px rgba(0,0,0,.7); border:1px solid rgba(255,255,255,.12); }
      .cta { display:inline-block; margin:26px 0 8px; padding:16px 42px; border-radius:16px;
        background:linear-gradient(90deg,#FF8A2A,#FFC93C); color:#1A0F00; text-decoration:none;
        font-family:Anton,sans-serif; font-size:26px; letter-spacing:.1em; }
      .cta-note { font-size:13px; color:rgba(255,255,255,.45); margin:0; }
      .faq-q { font-weight:800; color:#fff; margin:22px 0 4px; }
      nav.other { margin-top:56px; border-top:1px solid rgba(255,255,255,.12); padding-top:28px; }
      nav.other ul { list-style:none; padding:0; display:grid; gap:10px;
        grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); }
      nav.other a { display:block; padding:14px 16px; border-radius:14px; text-decoration:none;
        background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.1); color:#fff; }
      nav.other a:hover { background:rgba(255,255,255,.07); }
      nav.other .n { font-family:Anton,sans-serif; font-size:19px; letter-spacing:.06em; }
      nav.other .t { font-size:13px; color:rgba(255,255,255,.5); }
      footer { margin-top:48px; font-size:13px; color:rgba(255,255,255,.4); }
      footer a { color:rgba(255,255,255,.6); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header class="top">
        <a href="/" aria-label="Accueil GOAT FC"><img src="/logo.png" alt="GOAT FC" /></a>
        <a href="/" style="text-decoration:none;color:rgba(255,255,255,.6);font-size:14px">← Tous les jeux</a>
      </header>

      <main>
        <div class="hero">
          <div class="hero-txt">
            <span class="badge">${esc(p.tagline.toUpperCase())}</span>
            <h1>${esc(p.h1)}</h1>
            <p class="tagline">${esc(p.name)}</p>
          </div>
          <img src="${p.img}" alt="${esc(p.name)} — GOAT FC" width="190" />
        </div>

        <p class="lead">${esc(p.intro)}</p>

        <a class="cta" href="/?play=${p.play}">▶ JOUER</a>
        <p class="cta-note">Gratuit · Sans inscription · Directement dans le navigateur</p>

        ${p.sections.map(renderSection).join("\n\n        ")}

        <h2>Questions fréquentes</h2>
        ${p.faq.map(([q, a]) => `<p class="faq-q">${esc(q)}</p>\n        <p>${esc(a)}</p>`).join("\n        ")}

        <a class="cta" href="/?play=${p.play}">▶ JOUER À ${esc(p.name.toUpperCase())}</a>
      </main>

      <nav class="other" aria-label="Les autres modes de jeu">
        <h2 style="margin-top:0">Les autres modes GOAT FC</h2>
        <ul>
          ${others
            .map(
              (o) =>
                `<li><a href="/${o.slug}/"><span class="n">${esc(o.name)}</span><br /><span class="t">${esc(o.tagline)}</span></a></li>`
            )
            .join("\n          ")}
        </ul>
      </nav>

      <footer>
        <p><a href="/">GOAT FC</a> — quiz football gratuit, jouable sur navigateur et installable en application.</p>
      </footer>
    </div>
  </body>
</html>
`;
}

function renderSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: SITE + "/", priority: "1.0", changefreq: "daily" },
    ...PAGES.map((p) => ({
      loc: `${SITE}/${p.slug}/`,
      priority: "0.8",
      changefreq: "weekly",
    })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join("\n")}
</urlset>
`;
}

for (const p of PAGES) {
  const dir = path.join(DIST, p.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), renderPage(p), "utf8");
  console.log(`  seo  dist/${p.slug}/index.html`);
}

await writeFile(path.join(DIST, "sitemap.xml"), renderSitemap(), "utf8");
console.log(`  seo  dist/sitemap.xml (${PAGES.length + 1} URLs)`);
