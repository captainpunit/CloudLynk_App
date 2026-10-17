-- Base tables for Meta ads attribution, Play subscriptions and the Meta CAPI outbox.
-- If the existing CloudLynk schema already has subscription tables, merge into those instead.

create table if not exists public.app_installs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  platform text not null default 'android',
  install_referrer text,
  utm_source text,
  utm_campaign text,
  meta_campaign_data jsonb,          -- Meta encrypted referrer payload (utm_content) as received
  meta_anon_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'google_play',
  product_id text not null,
  purchase_token text not null unique,
  status text not null check (status in ('pending','active','in_grace','on_hold','cancelled','expired','refunded')),
  is_trial boolean not null default false,
  paid_until timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

-- Every provider event, kept for idempotency and audit.
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google_play',
  provider_event_id text not null,
  purchase_token text,
  notification_type int,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

-- Outbox: events queued for Meta CAPI and sent by meta-capi-dispatch with retries.
create table if not exists public.meta_event_outbox (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,     -- shared with the app SDK for deduplication
  event_name text not null,          -- e.g. Subscribe, StartTrial, Purchase
  user_id uuid references auth.users (id) on delete set null,
  value numeric(12,2),
  currency text,
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists meta_event_outbox_queued_idx on public.meta_event_outbox (status, created_at);

-- Only server code (service role) writes these tables.
alter table public.app_installs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;
alter table public.meta_event_outbox enable row level security;

create policy "users read own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);
