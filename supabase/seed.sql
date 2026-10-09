-- Local development seed (supabase db reset). Demo users only — password: Demo-Pass-123
-- Alice (owner of "Northwind Studio") and Bob (owner of a separate workspace) power the RLS tests.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change, email_change_token_new)
values
  ('00000000-0000-0000-0000-000000000000','a1111111-1111-4111-8111-111111111111','authenticated','authenticated',
   'alice@flowpilot.demo', crypt('Demo-Pass-123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Alice Carter"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','b2222222-2222-4222-8222-222222222222','authenticated','authenticated',
   'bob@flowpilot.demo', crypt('Demo-Pass-123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bob Nguyen"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u where u.email in ('alice@flowpilot.demo','bob@flowpilot.demo')
on conflict do nothing;

do $$
declare
  ws_a uuid; ws_b uuid; c1 uuid; c2 uuid; p1 uuid; p2 uuid; pb uuid;
  alice uuid := 'a1111111-1111-4111-8111-111111111111';
  bob   uuid := 'b2222222-2222-4222-8222-222222222222';
begin
  select workspace_id into ws_a from public.workspace_members where user_id = alice and role = 'owner' limit 1;
  select workspace_id into ws_b from public.workspace_members where user_id = bob   and role = 'owner' limit 1;
  update public.workspaces set name = 'Northwind Studio' where id = ws_a;
  update public.workspaces set name = 'Bob''s Workshop'   where id = ws_b;
  update public.subscriptions set plan = 'pro' where workspace_id = ws_a;

  insert into public.clients (workspace_id, name, email, company) values
    (ws_a, 'Maya Okafor', 'maya@lumen.co', 'Lumen Health') returning id into c1;
  insert into public.clients (workspace_id, name, email, company) values
    (ws_a, 'Daniel Reyes', 'daniel@harbor.io', 'Harbor Logistics') returning id into c2;

  insert into public.projects (workspace_id, client_id, name, description, due_date) values
    (ws_a, c1, 'Lumen patient portal', 'Redesign and rebuild the patient-facing portal.', current_date + 30) returning id into p1;
  insert into public.projects (workspace_id, client_id, name, description, due_date) values
    (ws_a, c2, 'Harbor tracking dashboard', 'Real-time shipment dashboard.', current_date + 55) returning id into p2;
  insert into public.projects (workspace_id, name) values (ws_b, 'Beta project — private to Bob') returning id into pb;

  insert into public.tasks (workspace_id, project_id, title, status, priority, assigned_to, due_date) values
    (ws_a, p1, 'Audit current patient flows',   'done',        'high',   alice, current_date - 3),
    (ws_a, p1, 'Wireframe appointment booking', 'in_progress', 'high',   alice, current_date + 4),
    (ws_a, p1, 'Design system tokens',          'review',      'medium', alice, current_date + 6),
    (ws_a, p1, 'Accessibility review',          'todo',        'medium', null,  current_date + 14),
    (ws_a, p2, 'Define dashboard KPIs',         'in_progress', 'urgent', alice, current_date + 2),
    (ws_a, p2, 'Map carrier API schema',        'todo',        'low',    null,  current_date + 20),
    (ws_b, pb, 'Bob''s private task',           'todo',        'medium', bob,   null);
end $$;
