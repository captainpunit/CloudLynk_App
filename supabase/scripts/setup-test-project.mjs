// Sets up a Supabase project as a CLIENT TEST server: the app's database, sample channels and
// videos, a hosted sample video, three test accounts and the server functions.
// Never run it against the production project: it adds sample content and test accounts.
//
//   npx supabase login                                   (once)
//   node supabase/scripts/setup-test-project.mjs <project-ref> <sample-hls-folder> <accounts-file>
//
// <sample-hls-folder> holds an HLS stream (master.m3u8 and the files it lists); it is uploaded
// to a public bucket and every video in the test build plays it (EXPO_PUBLIC_SAMPLE_VIDEO_URL).
// <accounts-file> receives the test accounts' emails and passwords. Keep it out of git and
// share it only with the people testing. Nothing secret is printed.
// Safe to run again: finished steps are skipped and passwords are kept.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [ref, hlsFolder, accountsFile] = process.argv.slice(2);
if (!/^[a-z0-9]{20}$/.test(ref ?? "") || !hlsFolder || !accountsFile) {
  console.error(
    "Usage: node supabase/scripts/setup-test-project.mjs <project-ref> <sample-hls-folder> <accounts-file>",
  );
  process.exit(1);
}
if (!existsSync(join(hlsFolder, "master.m3u8")))
  throw new Error(`${hlsFolder} has no master.m3u8`);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const url = `https://${ref}.supabase.co`;
const cli = process.env.SUPABASE_CLI ?? "npx";
const cliArgs = process.env.SUPABASE_CLI ? [] : ["--yes", "supabase"];
const supabase = (args, input) =>
  execFileSync(cli, [...cliArgs, ...args], {
    cwd: root,
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
const step = (text) => console.log(`\n== ${text}`);

/** Runs SQL through the Management API (no database password needed); returns rows. */
function sql(query) {
  const out = supabase(["db", "query", "--linked", "--output", "json", query]);
  const start = out.indexOf("[");
  return start === -1 ? [] : JSON.parse(out.slice(start));
}
function sqlFile(path) {
  supabase(["db", "query", "--linked", "-f", path]);
}

step(`Linking ${ref}`);
supabase(["link", "--project-ref", ref], "\n");

step("Applying the database migrations");
sql(`create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text)`);
const applied = new Set(
  sql("select version from supabase_migrations.schema_migrations").map(
    (r) => r.version,
  ),
);
const migrations = readdirSync(join(root, "supabase", "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
for (const file of migrations) {
  const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
  if (applied.has(version)) continue;
  sqlFile(join("supabase", "migrations", file));
  sql(
    `insert into supabase_migrations.schema_migrations(version, name) values ('${version}', '${rest.join("_")}')`,
  );
  console.log(`applied ${file}`);
}
sqlFile(join("supabase", "scripts", "seed-plans.sql"));

step("Reading the project keys");
const keys = JSON.parse(
  supabase(["projects", "api-keys", "--project-ref", ref, "--output", "json"]),
);
const serviceKey = keys.find((k) => k.name === "service_role")?.api_key;
const anonKey = keys.find((k) => k.name === "anon")?.api_key;
if (!serviceKey || !anonKey)
  throw new Error("Could not read the project keys. Is the CLI signed in?");
const api = async (path, init = {}) => {
  const res = await fetch(url + path, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...init.headers,
    },
  });
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    body: text ? JSON.parse(text) : null,
  };
};

step("Creating the test accounts");
const saved = existsSync(accountsFile)
  ? JSON.parse(readFileSync(accountsFile, "utf8"))
  : {};
const people = [
  { label: "admin", email: "admin@cloudlynk.test", name: "Test Admin" },
  { label: "creator", email: "creator@cloudlynk.test", name: "Test Creator" },
  { label: "viewer", email: "viewer@cloudlynk.test", name: "Test Viewer" },
];
const accounts = { server: url, anonKey };
for (const person of people) {
  const password =
    saved[person.label]?.password ??
    `Cl-${randomBytes(9).toString("base64url")}`;
  const existing = sql(
    `select id from auth.users where email = '${person.email}'`,
  )[0];
  let id = existing?.id;
  if (!id) {
    const res = await api("/auth/v1/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: person.email,
        password,
        email_confirm: true,
        user_metadata: { display_name: person.name },
      }),
    });
    if (!res.ok)
      throw new Error(`Creating ${person.label} failed (${res.status})`);
    id = res.body.id;
  }
  accounts[person.label] = { email: person.email, password, id };
}
sql(`update public.profiles set display_name = 'Test Admin', role = 'admin', can_publish = true where id = '${accounts.admin.id}';
  update public.profiles set display_name = 'Test Creator', can_publish = true where id = '${accounts.creator.id}';
  update public.profiles set display_name = 'Test Viewer' where id = '${accounts.viewer.id}'`);
writeFileSync(accountsFile, JSON.stringify(accounts, null, 2));
console.log(`saved to ${accountsFile}`);

step("Adding the sample channels and videos");
if (!sql("select 1 from public.channels limit 1").length) {
  const sample = readFileSync(
    join(root, "supabase", "scripts", "sample-content.sql"),
    "utf8",
  );
  sql(sample.replaceAll(":creator", `'${accounts.creator.id}'`));
}

step("Uploading the sample video");
const bucket = await api("/storage/v1/bucket", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    id: "sample-video",
    name: "sample-video",
    public: true,
  }),
});
if (
  !bucket.ok &&
  bucket.status !== 409 &&
  !/exists/i.test(JSON.stringify(bucket.body))
)
  throw new Error(`Creating the sample-video bucket failed (${bucket.status})`);
const types = {
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  vtt: "text/vtt",
};
for (const file of readdirSync(hlsFolder)) {
  const type = types[file.split(".").pop()];
  if (!type) continue;
  const res = await api(`/storage/v1/object/sample-video/${file}`, {
    method: "POST",
    headers: { "Content-Type": type, "x-upsert": "true" },
    body: readFileSync(join(hlsFolder, file)),
  });
  if (!res.ok) throw new Error(`Uploading ${file} failed (${res.status})`);
}

step("Deploying the server functions");
// Through a file, so the secret never appears in a process list.
const secrets = join(mkdtempSync(join(tmpdir(), "cloudlynk-")), "secrets.env");
writeFileSync(
  secrets,
  `ANDROID_PACKAGE_NAME=com.cloudlynk.app\nCRON_SECRET=${randomBytes(24).toString("hex")}\n`,
  { mode: 0o600 },
);
try {
  supabase(["secrets", "set", "--project-ref", ref, "--env-file", secrets]);
} finally {
  rmSync(dirname(secrets), { recursive: true, force: true });
}
supabase(["functions", "deploy", "--project-ref", ref, "--use-api"]);

console.log(`
Done. Build the test app with:
  EXPO_PUBLIC_SUPABASE_URL=${url}
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<anonKey in ${accountsFile}>
  EXPO_PUBLIC_SAMPLE_VIDEO_URL=${url}/storage/v1/object/public/sample-video/master.m3u8`);
