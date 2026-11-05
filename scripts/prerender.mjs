import { mkdir, readFile, writeFile } from "node:fs/promises";
import ts from "typescript";
// Reuse the same content without depending on Node's newer TypeScript loader.
const articleSource = await readFile(
  new URL("../src/content.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(articleSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const { articles } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);
const template = await readFile(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let origin;
const siteUrl =
  process.env.VITE_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined);
if (siteUrl) {
  const url = new URL(siteUrl);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("VITE_SITE_URL must be an HTTP(S) origin.");
  origin = url.origin;
}
function metadata(html, title, description, path) {
  return html
    .replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>${escape(title)} | Axiom</title>`,
    )
    .replace(
      /name="description"\s+content="[^"]*"/,
      `name="description" content="${escape(description)}"`,
    )
    .replace(
      /property="og:title"\s+content="[^"]*"/,
      `property="og:title" content="${escape(title)} | Axiom"`,
    )
    .replace(
      /property="og:description"\s+content="[^"]*"/,
      `property="og:description" content="${escape(description)}"`,
    )
    .replace(
      /property="og:image"\s+content="[^"]*"/,
      `property="og:image" content="${origin ?? ""}/social.png"`,
    )
    .replace(
      "</head>",
      `${origin ? `<link rel="canonical" href="${escape(origin + path)}"/><meta property="og:url" content="${escape(origin + path)}"/>` : ""}</head>`,
    );
}
const lessons = JSON.parse(
  await readFile(
    new URL("../src/learning/lessons.json", import.meta.url),
    "utf8",
  ),
);
const courseBody =
  '<header class="global-header"><a href="/">axiom.</a><nav><a href="/start">Start here</a><a href="/studio">Studio</a><a href="/language">Language</a></nav></header><main id="main" class="course-page"><p class="eyebrow">START HERE / NO EXPERIENCE NEEDED</p><h1>Your first Axiom program.</h1><p>Six small steps. Real code. A little more understanding each time. Enable JavaScript for the editable lessons and automatic checks, or read the course below.</p>' +
  lessons
    .map(
      (lesson, i) =>
        '<section class="article-section"><h2>' +
        (i + 1) +
        ". " +
        escape(lesson.title) +
        "</h2><p>" +
        escape(lesson.intro) +
        "</p><p>" +
        escape(lesson.explanation) +
        '</p><pre class="article-code">' +
        escape(lesson.starter) +
        "</pre><p>" +
        escape(lesson.challenge) +
        "</p><p>Target output:</p><pre>" +
        escape(lesson.expected.join("\n")) +
        "</pre><p>" +
        escape(lesson.takeaway) +
        "</p></section>",
    )
    .join("") +
  '<a href="/studio">Open the studio</a></main>';
const courseHtml = metadata(
  template.replace(
    '<div id="root"></div>',
    '<div id="root">' + courseBody + "</div>",
  ),
  "Your first Axiom program",
  "Learn Axiom with six guided, editable lessons. Start with a message and build up to variables, text, decisions, loops and functions.",
  "/start",
);
await mkdir(new URL("../dist/start/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../dist/start/index.html", import.meta.url),
  courseHtml,
);
await writeFile(new URL("../dist/start.html", import.meta.url), courseHtml);
for (const article of articles) {
  const html = `<header class="global-header"><a href="/">axiom.</a><nav><a href="/start">Start here</a><a href="/studio">Studio</a>${articles.map((a) => `<a href="${a.path}">${escape(a.path.slice(1))}</a>`).join("")}</nav></header><main class="docs-page"><aside class="docs-sidebar">${articles.map((a) => `<a href="${a.path}">${escape(a.path.slice(1))}</a>`).join("")}</aside><article><p class="eyebrow">${escape(article.eyebrow)}</p><h1>${escape(article.title)}</h1><p class="article-intro">${escape(article.intro)}</p>${article.sections.map((s, i) => `<section class="article-section" id="section-${i}"><h2>${escape(s.title)}</h2><p>${escape(s.text)}</p>${s.code ? `<pre class="article-code">${escape(s.code)}</pre>` : ""}</section>`).join("")}<a href="/studio">Open the interactive studio</a></article></main>`;
  const dir = new URL(`../dist${article.path}/`, import.meta.url);
  await mkdir(dir, { recursive: true });
  await writeFile(
    new URL("index.html", dir),
    metadata(
      template.replace('<div id="root"></div>', `<div id="root">${html}</div>`),
      article.title,
      article.intro,
      article.path,
    ),
  );
}
// Emit clean-URL aliases as well as directory indexes for static hosts.
for (const article of articles) {
  await writeFile(
    new URL(`../dist${article.path}.html`, import.meta.url),
    await readFile(
      new URL(`../dist${article.path}/index.html`, import.meta.url),
      "utf8",
    ),
  );
}
const home = `<header class="global-header"><a href="/">axiom.</a><nav><a href="/start">Start here</a><a href="/studio">Studio</a>${articles.map((a) => `<a href="${a.path}">${escape(a.path.slice(1))}</a>`).join("")}<a href="/experiments">Experiments</a></nav></header><main class="home"><section class="hero"><div class="hero-copy"><p class="eyebrow">A LANGUAGE YOU CAN SEE EXECUTING</p><h1>The language,<br/><em>in motion.</em></h1><p class="hero-description">Write a program. Explore its structure. Follow every instruction.</p><div class="hero-actions"><a href="/studio" class="button primary">Enter the studio</a><a href="/learn">How it works</a></div><p class="hero-footnote">A programming language project by Mithil Katkoria. Write Axiom code and explore its Rust compiler and virtual machine. New to programming? Start with the guided lessons. Enable JavaScript to use the editable live demonstration and debugger.</p></div></section></main>`;
await writeFile(
  new URL("../dist/index.html", import.meta.url),
  metadata(
    template.replace('<div id="root"></div>', `<div id="root">${home}</div>`),
    "The language, in motion.",
    "A statically typed programming language and interactive compiler explorer. Inspect real tokens, syntax trees, bytecode, and every step of a stack virtual machine.",
    "/",
  ),
);
if (origin) {
  await writeFile(
    new URL("../dist/sitemap.xml", import.meta.url),
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["/", "/start", ...articles.map((a) => a.path), "/experiments"].map((p) => `<url><loc>${escape(origin + p)}</loc></url>`).join("")}</urlset>`,
  );
  await writeFile(
    new URL("../dist/robots.txt", import.meta.url),
    `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
  );
}
console.log(
  `Prerendered homepage and ${articles.length} documentation routes.${origin ? " Canonical URLs and sitemap generated." : " Set VITE_SITE_URL to generate canonical URLs and sitemap for your domain."}`,
);
