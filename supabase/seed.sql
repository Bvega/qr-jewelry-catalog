-- Local development registry only. No owner Finds, users, or credentials belong here.
insert into public.collections (id, label, status, sort_order, description)
values
  ('jewelry', 'Jewelry', 'active', 1, 'Wearable finds selected for style, detail, and everyday discovery.'),
  ('vintage', 'Vintage', 'coming_soon', 2, 'Distinctive pieces with character, history, and lasting appeal.'),
  ('home-decor', 'Home & Decor', 'coming_soon', 3, 'Useful and decorative finds for comfortable, personal spaces.'),
  ('kitchen', 'Kitchen', 'coming_soon', 4, 'Practical kitchen finds chosen for everyday use.'),
  ('collectibles', 'Collectibles', 'coming_soon', 5, 'Interesting pieces worth noticing, keeping, or sharing.'),
  ('new-items', 'New Items', 'coming_soon', 6, 'Unused finds offered locally at honest prices.')
on conflict (id) do update
set label = excluded.label,
    status = excluded.status,
    sort_order = excluded.sort_order,
    description = excluded.description;
