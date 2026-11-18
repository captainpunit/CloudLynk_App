// Builds CloudLynk's public website into website/dist: the legal pages Google Play needs,
// the Android App Links file, and the fallback page for /open/... links.
//
//   node website/build.mjs           build, listing any [brackets] still to fill
//   node website/build.mjs --strict  fail if a [bracket] or a setting is missing (for launch)
//
// Settings come from website/site.json (copy site.example.json). The page text comes from
// docs/store/*.md, so the drafts and the published pages never drift apart.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = path.join(here, "dist");
const strict = process.argv.includes("--strict");

const configFile = fs.existsSync(path.join(here, "site.json"))
  ? "site.json"
  : "site.example.json";
const site = JSON.parse(fs.readFileSync(path.join(here, configFile), "utf8"));
const problems = [];
if (configFile !== "site.json")
  problems.push("website/site.json is missing; using site.example.json");
if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(site.appSigningSha256 ?? ""))
  problems.push(
    "appSigningSha256 is not set (Play Console → Test and release → App integrity)",
  );

const escape = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const inline = (s) =>
  escape(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');

/** The small markdown subset the drafts use. Notes to the client (> Draft ...) are dropped. */
function render(md) {
  const html = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (line.startsWith(">")) {
      while (i < lines.length && lines[i].startsWith(">")) i++;
    } else if (/^#{1,3} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      html.push(`<h${level}>${inline(line.slice(level + 1))}</h${level}>`);
      i++;
    } else if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|"))
        rows.push(lines[i++]);
      const cells = (row) =>
        row
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
      const [head, , ...body] = rows;
      html.push(
        '<div class="table"><table><thead><tr>' +
          cells(head)
            .map((c) => `<th>${inline(c)}</th>`)
            .join("") +
          "</tr></thead><tbody>" +
          body
            .map(
              (r) =>
                `<tr>${cells(r)
                  .map(
                    (c, n) =>
                      `<td data-label="${escape(cells(head)[n] ?? "")}">${inline(c)}</td>`,
                  )
                  .join("")}</tr>`,
            )
            .join("") +
          "</tbody></table></div>",
      );
    } else if (/^(- |\d+\. )/.test(line)) {
      const ordered = /^\d/.test(line);
      const items = [];
      while (
        i < lines.length &&
        (/^(- |\d+\. )/.test(lines[i]) || /^ {2,}\S/.test(lines[i]))
      ) {
        if (/^ {2,}/.test(lines[i]))
          items[items.length - 1] += " " + lines[i].trim();
        else items.push(lines[i].replace(/^(- |\d+\. )/, ""));
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      html.push(
        `<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`,
      );
    } else {
      const para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#|>|\||- |\d+\. )/.test(lines[i])
      )
        para.push(lines[i++].trim());
      html.push(`<p>${inline(para.join(" "))}</p>`);
    }
  }
  return html.join("\n");
}

const style = fs.readFileSync(path.join(here, "style.css"), "utf8");
const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>${style}</style>
</head>
<body>
<main>
${body}
<footer><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="/delete-account/">Delete your account</a></footer>
</main>
</body>
</html>
`;

function write(rel, content) {
  const file = path.join(out, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// Empty the folder rather than delete it: on Windows a folder a server is using can't be removed.
fs.mkdirSync(out, { recursive: true });
for (const entry of fs.readdirSync(out))
  fs.rmSync(path.join(out, entry), { recursive: true, force: true });

const pages = [
  ["privacy/index.html", "privacy-policy.md", "Privacy policy · CloudLynk"],
  ["terms/index.html", "terms.md", "Terms of use · CloudLynk"],
  [
    "delete-account/index.html",
    "account-deletion.md",
    "Delete your account · CloudLynk",
  ],
];
for (const [rel, source, title] of pages) {
  const md = fs.readFileSync(path.join(root, "docs/store", source), "utf8");
  const published = md.replace(/^>.*\n(>.*\n)*/m, "");
  for (const gap of new Set(published.match(/\[[^\]]+\](?!\()/g) ?? []))
    problems.push(`${source}: ${gap} is not filled in`);
  write(rel, page(title, render(md)));
}

const playUrl = `https://play.google.com/store/apps/details?id=${site.androidPackage}`;
write(
  "index.html",
  page(
    "CloudLynk",
    `<h1>CloudLynk</h1>
<p>Watch channels from creators you follow. One Plus plan opens every paid channel.</p>
<p><a class="button" href="${playUrl}">Get it on Google Play</a></p>
<p>Questions: <a href="mailto:${escape(site.supportEmail)}">${escape(site.supportEmail)}</a></p>`,
  ),
);

// Shown only when the app is not installed: Android opens verified /open links in the app.
// An ad link carries its ad flag through the Play install, so the new member still counts
// as coming from an advert (see mobile/src/domain/ad-referrer.ts).
write(
  "open/index.html",
  page(
    "Open in CloudLynk",
    `<h1>Watch this on CloudLynk</h1>
<p>Install the free app to open this link.</p>
<p><a class="button" id="play" href="${playUrl}">Get it on Google Play</a></p>
<script>
  var u = new URL(location.href);
  var ad = u.pathname.replace(/\\/+$/, '') === '/open/ad' || u.searchParams.get('ad') === '1';
  if (ad) document.getElementById('play').href = ${JSON.stringify(playUrl)} +
    '&referrer=' + encodeURIComponent('utm_source=cloudlynk&utm_medium=ad_link');
</script>`,
  ),
);

write(
  ".well-known/assetlinks.json",
  JSON.stringify(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: site.androidPackage,
          sha256_cert_fingerprints: [site.appSigningSha256],
        },
      },
    ],
    null,
    2,
  ) + "\n",
);

// Cloudflare Pages (and Netlify) read these two files.
write("_redirects", "/open/* /open/index.html 200\n");
write(
  "_headers",
  "/.well-known/assetlinks.json\n  Content-Type: application/json\n  Access-Control-Allow-Origin: *\n",
);

console.log(`Built ${path.relative(root, out)} from ${configFile}`);
if (problems.length) {
  console.log(`\nStill to do before launch:\n- ${problems.join("\n- ")}`);
  if (strict) process.exit(1);
}
