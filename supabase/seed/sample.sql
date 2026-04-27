-- sample.sql — optional seed data for demos.
-- Apply via Supabase SQL Editor *after* the migrations are applied
-- and *after* you (the admin) have signed up.
--
-- This inserts a handful of class templates and a closed day so the
-- public schedule looks alive even before real students sign up.
-- It does NOT create student profiles — those should be real users.

-- A week of group classes typical for a small boxing/kickboxing studio.
insert into public.class_templates
  (name, description, day_of_week, start_time, duration_minutes, capacity, active_from)
values
  ('Boxe Iniciados',     'Aula para alunos a começar.',                 1, '18:00', 60, 12, current_date),
  ('Boxe Avançados',     'Técnica e sparring para alunos com base.',    1, '19:30', 75, 10, current_date),
  ('Kickboxing',         'Aula aberta a todos os níveis.',              2, '19:00', 60, 14, current_date),
  ('Boxe Iniciados',     'Aula para alunos a começar.',                 3, '18:00', 60, 12, current_date),
  ('Kickboxing',         'Aula aberta a todos os níveis.',              4, '19:00', 60, 14, current_date),
  ('Boxe Avançados',     'Técnica e sparring para alunos com base.',    4, '20:30', 75, 10, current_date),
  ('Boxe Open',          'Aberta a todos os níveis. Vem tentar.',       6, '10:00', 60, 16, current_date);

-- Mark next Sunday as closed (studio rests).
-- Compute "next sunday" relative to today.
insert into public.closed_days (date, reason)
values (
  (current_date + ((7 - extract(dow from current_date)::int) % 7))::date,
  'Estúdio fechado ao Domingo'
);
