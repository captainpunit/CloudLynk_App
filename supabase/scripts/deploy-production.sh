#!/usr/bin/env bash
# Sets up the production backend in one go: database, plans, function secrets, functions,
# scheduled jobs and a health check. Run it from the repository root on the client's own
# computer (Git Bash on Windows, or a Mac/Linux terminal):
#
#   bash supabase/scripts/deploy-production.sh <project-ref>            # set everything up
#   bash supabase/scripts/deploy-production.sh <project-ref> --check    # only check supabase/.env
#
# Before running:
#   1. Create the Supabase project and note its ref (the part before .supabase.co).
#   2. Copy supabase/.env.example to supabase/.env and fill it in. The file is ignored by git;
#      never commit it or paste it into chat. GOOGLE_PLAY_SERVICE_ACCOUNT_JSON goes on one line.
#   3. Sign in to the Supabase CLI once with `npx supabase login`.
#   4. Optional: export SUPABASE_DB_PASSWORD so linking doesn't ask for it, and
#      export ADMIN_EMAIL=<email> to make that account the first administrator (it must have
#      signed up in the app first).
#
# Every step can be run again safely. Nothing secret is printed.
set -euo pipefail

REF="${1:-}"
MODE="${2:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/supabase/.env"
cd "$ROOT"

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
fail() { printf '\033[31mStopped: %s\033[0m\n' "$1" >&2; exit 1; }
warn() { printf '\033[33mNote: %s\033[0m\n' "$1"; }

[[ "$REF" =~ ^[a-z0-9]{20}$ ]] ||
  fail "give the 20-character project ref, for example: bash supabase/scripts/deploy-production.sh abcdefghijklmnopqrst"
[[ -z "$MODE" || "$MODE" == "--check" ]] || fail "unknown option $MODE (only --check is supported)"

if command -v supabase >/dev/null 2>&1; then SB=(supabase); else SB=(npx --yes supabase); fi
command -v curl >/dev/null 2>&1 || fail "curl is needed"

# ---------------------------------------------------------------- 1. check supabase/.env
step "Checking supabase/.env"
[[ -f "$ENV_FILE" ]] || fail "supabase/.env is missing. Copy supabase/.env.example to supabase/.env and fill it in."

# Reads KEY=value lines without running the file as a script.
value() {
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line#\"}"; line="${line%\"}"
  line="${line#\'}"; line="${line%\'}"
  printf '%s' "$line"
}

REQUIRED=(ANDROID_PACKAGE_NAME GOOGLE_PLAY_SERVICE_ACCOUNT_JSON RTDN_PUSH_AUDIENCE
  RTDN_SERVICE_ACCOUNT_EMAIL META_DATASET_ID META_CAPI_ACCESS_TOKEN META_GRAPH_VERSION CRON_SECRET
  CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_STREAM_API_TOKEN CLOUDFLARE_STREAM_WEBHOOK_SECRET
  CLOUDFLARE_STREAM_SIGNING_KEY_ID CLOUDFLARE_STREAM_SIGNING_JWK_BASE64
  CLOUDFLARE_STREAM_PLAYBACK_HOST STREAM_MAX_UPLOAD_BYTES STREAM_MAX_DURATION_SECONDS)
problems=()
for key in "${REQUIRED[@]}"; do
  [[ -n "$(value "$key")" ]] || problems+=("$key is empty")
done
for key in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY; do
  grep -qE "^$key=" "$ENV_FILE" && problems+=("remove $key: Supabase sets it itself")
done
[[ "$(value ANDROID_PACKAGE_NAME)" == "com.cloudlynk.app" ]] ||
  problems+=("ANDROID_PACKAGE_NAME must be com.cloudlynk.app")
[[ "$(value CLOUDFLARE_STREAM_PLAYBACK_HOST)" =~ ^customer-[a-z0-9-]+\.cloudflarestream\.com$ ]] ||
  problems+=("CLOUDFLARE_STREAM_PLAYBACK_HOST must look like customer-xxxx.cloudflarestream.com (no https://)")
[[ "$(value CRON_SECRET)" =~ ^[A-Za-z0-9_-]{32,}$ ]] ||
  problems+=("CRON_SECRET must be at least 32 letters, digits, - or _ (for example the output of: openssl rand -hex 32)")
[[ "$(value STREAM_MAX_UPLOAD_BYTES)" =~ ^[0-9]+$ ]] || problems+=("STREAM_MAX_UPLOAD_BYTES must be a number")
[[ "$(value STREAM_MAX_DURATION_SECONDS)" =~ ^[0-9]+$ ]] || problems+=("STREAM_MAX_DURATION_SECONDS must be a number")
[[ "$(value RTDN_SERVICE_ACCOUNT_EMAIL)" == *@*.iam.gserviceaccount.com ]] ||
  problems+=("RTDN_SERVICE_ACCOUNT_EMAIL must be a Google service account email (…@….iam.gserviceaccount.com)")
SA_JSON="$(value GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)"
if [[ -n "$SA_JSON" ]]; then
  if command -v node >/dev/null 2>&1; then
    SA_JSON="$SA_JSON" node -e '
      const j = JSON.parse(process.env.SA_JSON);
      if (j.type !== "service_account" || !j.private_key || !j.client_email) process.exit(2);
    ' 2>/dev/null || problems+=("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON must be the whole service account key file, on one line")
  elif [[ "$SA_JSON" != \{* ]]; then
    problems+=("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON must be the whole service account key file, on one line")
  fi
fi
if ((${#problems[@]})); then
  printf '  - %s\n' "${problems[@]}" >&2
  fail "fix supabase/.env and run again"
fi
[[ -z "$(value META_TEST_EVENT_CODE)" ]] ||
  warn "META_TEST_EVENT_CODE is set, so Meta treats events as tests. Empty it before launch."
[[ -n "$(value EXPO_ACCESS_TOKEN)" ]] ||
  warn "EXPO_ACCESS_TOKEN is empty. Push works without it unless enhanced push security is on in Expo."
echo "supabase/.env looks complete."
[[ "$MODE" == "--check" ]] && exit 0

URL="https://$REF.supabase.co"
CRON_SECRET="$(value CRON_SECRET)"
TMP="$(mktemp -d)"
chmod 700 "$TMP"
trap 'rm -rf "$TMP"' EXIT

# ---------------------------------------------------------------- 2. link and database
step "Linking project $REF"
"${SB[@]}" link --project-ref "$REF"

step "Turning on scheduled jobs (pg_cron) and outgoing requests (pg_net)"
"${SB[@]}" db query --linked \
  "create extension if not exists pg_cron; create extension if not exists pg_net with schema extensions;" >/dev/null
echo "Done."

step "Applying database migrations (the CLI lists them and asks to confirm)"
"${SB[@]}" db push --linked

step "Adding the five Plus plans (existing plans are left as they are)"
"${SB[@]}" db query --linked -f supabase/scripts/seed-plans.sql >/dev/null
echo "Done."

# ---------------------------------------------------------------- 3. functions
step "Setting function secrets"
# Only filled-in values: optional keys left empty are skipped.
grep -E '^[A-Z][A-Z0-9_]*=.+' "$ENV_FILE" | sed 's/\r$//' >"$TMP/secrets.env"
"${SB[@]}" secrets set --project-ref "$REF" --env-file "$TMP/secrets.env" >/dev/null
echo "Set $(wc -l <"$TMP/secrets.env" | tr -d ' ') secrets."

step "Deploying every function in supabase/functions"
"${SB[@]}" functions deploy --project-ref "$REF" --use-api

# ---------------------------------------------------------------- 4. scheduled jobs
step "Saving the job settings in Vault and scheduling the jobs"
# CRON_SECRET was checked above to contain only letters, digits, - and _, so it is safe in SQL.
cat >"$TMP/vault.sql" <<SQL
do \$\$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'cron_secret';
  if v_id is null then perform vault.create_secret('$CRON_SECRET', 'cron_secret');
  else perform vault.update_secret(v_id, '$CRON_SECRET'); end if;
  select id into v_id from vault.secrets where name = 'supabase_project_url';
  if v_id is null then perform vault.create_secret('$URL', 'supabase_project_url');
  else perform vault.update_secret(v_id, '$URL'); end if;
end
\$\$;
SQL
"${SB[@]}" db query --linked -f "$TMP/vault.sql" >/dev/null
rm -f "$TMP/vault.sql"
"${SB[@]}" db query --linked -f supabase/scripts/schedule-jobs.sql >/dev/null
echo "Nine jobs scheduled."

# ---------------------------------------------------------------- 5. first administrator
if [[ -n "${ADMIN_EMAIL:-}" ]]; then
  step "Making $ADMIN_EMAIL the administrator"
  [[ "$ADMIN_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "ADMIN_EMAIL is not an email address"
  cat >"$TMP/admin.sql" <<SQL
do \$\$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower('$ADMIN_EMAIL');
  if v_id is null then raise exception 'No account with that email. Sign up in the app first.'; end if;
  update public.profiles set role = 'admin' where id = v_id;
end
\$\$;
SQL
  "${SB[@]}" db query --linked -f "$TMP/admin.sql" >/dev/null
  echo "Done."
fi

# ---------------------------------------------------------------- 6. health check
step "Checking backend-health"
status="$(printf 'header = "x-cron-secret: %s"\n' "$CRON_SECRET" |
  curl -s -o "$TMP/health.json" -w '%{http_code}' -K - "$URL/functions/v1/backend-health" || true)"
if [[ "$status" == "200" ]]; then
  echo "Healthy (200)."
elif [[ "$status" == "000" || -z "$status" ]]; then
  warn "backend-health could not be reached. Check the internet connection and run this step again later."
else
  warn "backend-health answered $status. Right after setup this can mean the jobs haven't run yet; try again in 10 minutes. Details: $(head -c 400 "$TMP/health.json" 2>/dev/null)"
fi

cat <<EOF

The backend is set up. Still to do by hand in the Supabase dashboard ($URL):
  1. Auth → URL Configuration: Site URL and a Redirect URL of https://<link host>/email-confirmed/
  2. Auth → Email templates → Reset password: paste supabase/templates/recovery.html
  3. Auth → SMTP settings: the client's email provider (the built-in sender is limited
     to a few emails an hour)
  4. Google Cloud Pub/Sub push subscription to $URL/functions/v1/play-rtdn-webhook
     (docs/LAUNCH_CHECKLIST.md, section 3)
  5. Check the Cloudflare Stream webhook points at $URL/functions/v1/stream-webhook
     (its secret is CLOUDFLARE_STREAM_WEBHOOK_SECRET)
  6. In the app as the administrator: Admin → Payments, enter the UPI ID, payee name and
     GST rate, check the plans and switch payments on
  7. An uptime monitor on $URL/functions/v1/backend-health with the x-cron-secret header
EOF
