-- 0059_referrals_coupons_rpcs.sql
-- Prompt 5: redemption RPCs for coupons and referrals (per ACCOUNT).
--
-- Writes to coupons/referrals/coupon_uses are blocked by RLS (SELECT-only for
-- members), so all mutations go through these SECURITY DEFINER functions. Each
-- one authorizes the caller against the target account (member OR super-admin)
-- before doing anything.
--
-- Scope note: these record the redemption (audit + uses_count). Actually
-- discounting an invoice is handled by the billing provider and is reconciled
-- with the new plan system in Prompt 8 — out of scope here.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: is the current user a member of the given account?
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.current_user_in_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from account_members
    where account_id = p_account_id
      and user_id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- redeem_coupon(account, code) → jsonb
--   { success: bool, error?: text, code?, discount_type?, discount_value?,
--     duration_months? }
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.redeem_coupon(p_account_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_coupon coupons%rowtype;
begin
  -- Authorization: caller must belong to the account (or be super-admin).
  if not (public.current_user_in_account(p_account_id) or public.current_user_is_super_admin()) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  -- Lock the coupon row so concurrent redemptions can't blow past max_uses.
  select * into v_coupon
  from coupons
  where code = upper(trim(p_code))
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if coalesce(v_coupon.is_active, false) = false then
    return jsonb_build_object('success', false, 'error', 'inactive');
  end if;

  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'expired');
  end if;

  -- max_uses = -1 means unlimited.
  if v_coupon.max_uses is not null and v_coupon.max_uses <> -1
     and coalesce(v_coupon.uses_count, 0) >= v_coupon.max_uses then
    return jsonb_build_object('success', false, 'error', 'exhausted');
  end if;

  -- Already redeemed by this account? (unique constraint also guards this.)
  if exists (
    select 1 from coupon_uses
    where coupon_id = v_coupon.id and account_id = p_account_id
  ) then
    return jsonb_build_object('success', false, 'error', 'already_used');
  end if;

  insert into coupon_uses (coupon_id, account_id) values (v_coupon.id, p_account_id);
  update coupons set uses_count = coalesce(uses_count, 0) + 1 where id = v_coupon.id;

  return jsonb_build_object(
    'success', true,
    'code', v_coupon.code,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value,
    'duration_months', v_coupon.duration_months
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- redeem_referral(referred_account, code) → jsonb
--   { success: bool, error?: text, referrer_account_id? }
-- Records that `referred_account` signed up via `code`. status stays 'pending'
-- until conversion (granting the reward is a later/admin step).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.redeem_referral(p_referred_account_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_referrer_id uuid;
begin
  if not (public.current_user_in_account(p_referred_account_id) or public.current_user_is_super_admin()) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select id into v_referrer_id
  from accounts
  where referral_code = upper(trim(p_code));

  if v_referrer_id is null then
    return jsonb_build_object('success', false, 'error', 'invalid_code');
  end if;

  if v_referrer_id = p_referred_account_id then
    return jsonb_build_object('success', false, 'error', 'self_referral');
  end if;

  -- An account can only be referred once.
  if exists (select 1 from referrals where referred_account_id = p_referred_account_id) then
    return jsonb_build_object('success', false, 'error', 'already_referred');
  end if;

  insert into referrals (referrer_account_id, referral_code, referred_account_id, status)
  values (v_referrer_id, upper(trim(p_code)), p_referred_account_id, 'pending');

  return jsonb_build_object('success', true, 'referrer_account_id', v_referrer_id);
end;
$$;

grant execute on function public.current_user_in_account(uuid) to authenticated;
grant execute on function public.redeem_coupon(uuid, text) to authenticated;
grant execute on function public.redeem_referral(uuid, text) to authenticated;
