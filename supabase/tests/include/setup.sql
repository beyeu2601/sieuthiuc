-- Du lieu mau dung chung cho test (chen bang dong "-- @include setup.sql").
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

create schema tests;
create function tests.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function tests.logout() returns void language sql as $$
  select set_config('role', 'postgres', true);
  select set_config('request.jwt.claims', '', true);
$$;
-- id co dinh: sadmin a1, admin a2, ke toan a3, nhan vien cua hang A a4, nhan vien cua hang B a5
create function tests.uid(r text) returns uuid language sql immutable as $$
  select case r when 'sadmin' then '00000000-0000-0000-0000-0000000000a1'
                when 'admin' then '00000000-0000-0000-0000-0000000000a2'
                when 'acc' then '00000000-0000-0000-0000-0000000000a3'
                when 'staff' then '00000000-0000-0000-0000-0000000000a4'
                when 'staffb' then '00000000-0000-0000-0000-0000000000a5' end::uuid
$$;
create function tests.store(c text) returns uuid language sql immutable as $$
  select case c when 'A' then '00000000-0000-0000-0000-00000000000a'
                when 'B' then '00000000-0000-0000-0000-00000000000b' end::uuid
$$;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

insert into auth.users (id, email) values
  (tests.uid('sadmin'), 't_sadmin@sieuthiuc.local'),
  (tests.uid('admin'), 't_admin@sieuthiuc.local'),
  (tests.uid('acc'), 't_acc@sieuthiuc.local'),
  (tests.uid('staff'), 't_staffa@sieuthiuc.local'),
  (tests.uid('staffb'), 't_staffb@sieuthiuc.local');
insert into stores (id, code, name) values (tests.store('A'), 'TA', 'Test A'), (tests.store('B'), 'TB', 'Test B');
insert into profiles (id, username, full_name, role, default_store_id) values
  (tests.uid('sadmin'), 't_sadmin', 'T sadmin', 'sadmin', tests.store('A')),
  (tests.uid('admin'), 't_admin', 'T admin', 'admin', tests.store('A')),
  (tests.uid('acc'), 't_acc', 'T acc', 'accountant', tests.store('A')),
  (tests.uid('staff'), 't_staffa', 'T staff A', 'staff', tests.store('A')),
  (tests.uid('staffb'), 't_staffb', 'T staff B', 'staff', tests.store('B'));
insert into user_stores (user_id, store_id) values
  (tests.uid('sadmin'), tests.store('A')),
  (tests.uid('admin'), tests.store('A')),
  (tests.uid('acc'), tests.store('A')),
  (tests.uid('staff'), tests.store('A')),
  (tests.uid('staffb'), tests.store('B'));
