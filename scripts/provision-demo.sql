begin;
create temporary table provisioned_accounts(account_key text, user_id uuid, profile_id uuid, email text, password text, role public.app_role, company_id uuid) on commit drop;
do $$
declare ca uuid; cb uuid; uid uuid; pid uuid; pw text; c uuid; item record;
begin
 if exists(select 1 from auth.users where email like '%@smartgate.test') then raise exception 'demo_accounts_already_exist'; end if;
 insert into public.companies(name,is_simulated) values('شركة المسار التجريبية',true) returning id into ca;
 insert into public.companies(name,is_simulated) values('شركة الأفق التجريبية',true) returning id into cb;
 for item in select * from (values
 ('company','company_admin','مدير شركة المسار','a'),
 ('driver','driver','سالم — سائق تجريبي','a'),
 ('driver2','driver','ناصر — سائق تجريبي','a'),
 ('company2','company_admin','مدير شركة الأفق','b'),
 ('driver3','driver','أحمد — سائق تجريبي','b'),
 ('operator','gate_operator','مشغل البوابتين أ و ب',null),
 ('operator2','gate_operator','مشغل البوابة ج',null),
 ('simulation','demo_admin','مسؤول المحاكاة',null)
 ) as x(key,role,name,co)
 loop
 uid:=gen_random_uuid(); pw:=encode(extensions.gen_random_bytes(18),'hex'); c:=case item.co when 'a' then ca when 'b' then cb else null end;
 insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
 values('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated',item.key||'@smartgate.test',extensions.crypt(pw,extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');
 insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
 values(uid::text,uid,jsonb_build_object('sub',uid::text,'email',item.key||'@smartgate.test','email_verified',true),'email',now(),now());
 insert into public.profiles(user_id,company_id,full_name,role,is_simulated) values(uid,c,item.name,item.role::public.app_role,true) returning id into pid;
 insert into provisioned_accounts values(item.key,uid,pid,item.key||'@smartgate.test',pw,item.role::public.app_role,c);
 if item.key='operator' then insert into public.operator_gates select pid,id from public.gates where code in ('GATE-A','GATE-B'); end if;
 if item.key='operator2' then insert into public.operator_gates select pid,id from public.gates where code='GATE-C'; end if;
 end loop;
 insert into public.trucks(company_id,plate_number,vehicle_type,is_simulated) values(ca,'DEMO-1001','truck',true),(ca,'DEMO-1002','truck',true),(cb,'DEMO-2001','truck',true);
 update public.gates set service_rate_per_hour=case when code='GATE-C' then null else 15 end,telemetry_updated_at=now();
end $$;
select jsonb_agg(to_jsonb(a)) as accounts from provisioned_accounts a;
commit;
