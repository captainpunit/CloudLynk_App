-- Sample channels and videos for a CLIENT TEST project (setup-test-project.mjs), owned by the
-- test creator (:creator is replaced with that account's id). Never run it on production.
-- The stream assets are placeholders: the test build plays one hosted sample video instead.
with c as (
  insert into public.channels(name, description, requires_subscription, status, created_by, is_private, category, cover_url)
  select v.name, v.description, v.paid, 'published', :creator, false, v.category, v.cover
  from (values
    ('Cricket Corner', 'Match highlights and analysis every week.', true, 'Sports', 'https://picsum.photos/seed/cricket/1280/720'),
    ('Kitchen Stories', 'Home recipes from across India.', false, 'Food', 'https://picsum.photos/seed/kitchen/1280/720'),
    ('Tech Tak', 'Phones, gadgets and how things work.', true, 'Technology', 'https://picsum.photos/seed/tech/1280/720')
  ) as v(name, description, paid, category, cover)
  returning id, name, created_by
),
t as (
  insert into public.titles(channel_id, owner_id, kind, name, description, cover_url, min_age, status, published_at)
  select c.id, c.created_by, 'movie', v.name, v.description, v.cover, 0, 'published', now() - v.age
  from c join (values
    ('Cricket Corner', 'India vs Australia highlights', 'Best moments from the final.', 'https://picsum.photos/seed/final/1280/720', interval '1 hour'),
    ('Cricket Corner', 'How to bowl a yorker', 'A coach breaks it down step by step.', 'https://picsum.photos/seed/yorker/1280/720', interval '2 days'),
    ('Kitchen Stories', 'Masala dosa at home', 'Crisp dosa with potato filling.', 'https://picsum.photos/seed/dosa/1280/720', interval '5 hours'),
    ('Kitchen Stories', 'Five minute chutneys', 'Three chutneys for any meal.', 'https://picsum.photos/seed/chutney/1280/720', interval '3 days'),
    ('Tech Tak', 'Best phones under 15,000', 'Tested for a month each.', 'https://picsum.photos/seed/phones/1280/720', interval '1 day')
  ) as v(channel, name, description, cover, age) on v.channel = c.name
  returning id
)
insert into public.stream_assets(title_id, stream_uid, state, duration_seconds)
select id, md5(id::text), 'ready', 180 from t;
