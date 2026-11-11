-- The five Plus plans. Run once after `supabase db push` (SQL editor or psql).
-- Safe to run again: plans that already exist are left as they are, so prices edited
-- later in Admin → Payments → Plans are not overwritten.
--
-- The plan IDs must match the one-time product IDs in Google Play Console.
-- quota_bytes is the My cloud storage a plan adds; it is 0 until the client confirms
-- storage per plan (edit it in the app afterwards).
insert into public.plans(product_id, name, billing_period, price_paise, quota_bytes, active) values
  ('trial',    'Trial',    'P2D',  6900, 0, true),
  ('silver',   'Silver',   'P7D', 12900, 0, true),
  ('gold',     'Gold',     'P1M', 25900, 0, true),
  ('platinum', 'Platinum', 'P6M', 59900, 0, true),
  ('diamond',  'Diamond',  'P1Y', 99900, 0, true)
on conflict (product_id) do nothing;
