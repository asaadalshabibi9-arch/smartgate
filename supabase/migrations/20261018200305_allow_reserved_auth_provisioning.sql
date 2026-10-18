-- A14: GoTrue inserts auth.users before applying Admin API app_metadata.
-- Authorize that insert using the private durable reservation, not metadata
-- that does not exist yet. Profile creation still requires trusted metadata.
create function private.is_reserved_auth_identity(p_id uuid, p_email text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
   select 1 from private.administration_audit a
   join private.platform_administrators p on p.user_id=a.actor_user_id
   where a.command='reserve_account'
     and a.result->>'id'=p_id::text
     and lower(a.input->>'email')=lower(p_email)
 );
$$;
revoke all on function private.is_reserved_auth_identity(uuid,text) from public,anon,authenticated;
-- Auth service has no end-user auth.uid(); only its database role may call
-- this narrow predicate. It cannot read or change the private reservation table.
grant usage on schema private to supabase_auth_admin;
grant execute on function private.is_reserved_auth_identity(uuid,text) to supabase_auth_admin;

create or replace function private.block_public_signup()
returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('postgres','supabase_admin') then return new; end if;
 if current_user='supabase_auth_admin'
    and private.is_reserved_auth_identity(new.id,new.email) then return new; end if;
 raise exception 'public_signup_disabled';
end;
$$;
