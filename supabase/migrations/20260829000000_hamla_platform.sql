-- HAMLA Platform MVP — Part 1
-- This migration adds the schema, security-definer functions, RLS policies,
-- and triggers required to turn HAMLA into a multi-role crowdfunding platform.
--
-- Applied after:
--   20260828193227_aa3be170-...  (seed campaign insert)
--   20260828193243_7ad4e336-...  (existing security hardening)
--   (Lovable-managed)             (base tables + finalize_donation, handle_new_user, set_updated_at)
--
-- Atomic. If any statement fails, the whole migration rolls back.
BEGIN;

-- Enums ----------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('user', 'charity_group', 'admin');

CREATE TYPE charity_status AS ENUM (
  'pending', 'under_review', 'approved', 'rejected',
  'more_info_required', 'suspended'
);

CREATE TYPE app_status AS ENUM (
  'draft', 'submitted', 'under_review', 'approved',
  'rejected', 'more_info_required', 'suspended'
);

CREATE TYPE campaign_status AS ENUM (
  'draft', 'submitted', 'published', 'paused',
  'completed', 'rejected', 'suspended', 'archived'
);

CREATE TYPE payout_status AS ENUM (
  'pending', 'under_review', 'approved',
  'processing', 'paid', 'rejected', 'failed'
);

CREATE TYPE ledger_type AS ENUM (
  'donation', 'payment_fee', 'platform_fee',
  'refund', 'payout', 'payout_fee', 'adjustment'
);

CREATE TYPE audit_action AS ENUM (
  'approve_charity', 'reject_charity', 'suspend_charity',
  'approve_campaign', 'reject_campaign', 'certify_campaign',
  'remove_certification', 'suspend_campaign',
  'approve_payout', 'reject_payout', 'mark_payout_paid',
  'suspend_user', 'reactivate_user',
  'view_charity_document'
);

-- Tables ---------------------------------------------------------------------

CREATE TABLE public.user_roles (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role NOT NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  granted_by  uuid REFERENCES auth.users(id)
);

CREATE TABLE public.charity_groups (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  description           text,
  category              text,
  wilaya                text,
  commune               text,
  address               text,
  phone                 text,
  email                 text,
  website               text,
  representative_name   text,
  representative_phone  text,
  representative_email  text,
  registration_number   text,
  registration_date     date,
  logo_url              text,
  verified              boolean NOT NULL DEFAULT false,
  verified_at           timestamptz,
  status                charity_status NOT NULL DEFAULT 'pending',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.charity_applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  charity_group_id    uuid REFERENCES public.charity_groups(id) ON DELETE SET NULL,
  status              app_status NOT NULL DEFAULT 'submitted',
  admin_notes         text,
  -- denormalized fields so admin review is stable even if the user later edits
  org_name            text NOT NULL,
  org_name_ar         text NOT NULL,
  org_description     text,
  org_category        text,
  org_wilaya          text,
  org_commune         text,
  org_address         text,
  org_phone           text,
  org_email           text,
  org_website         text,
  rep_name            text,
  rep_phone           text,
  rep_email           text,
  registration_number text,
  registration_date   date,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_at         timestamptz,
  reviewed_by         uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_charity_applications_user_id ON public.charity_applications(user_id);
CREATE INDEX idx_charity_applications_status  ON public.charity_applications(status);

CREATE TABLE public.charity_documents (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charity_application_id  uuid NOT NULL REFERENCES public.charity_applications(id) ON DELETE CASCADE,
  type                    text NOT NULL,
  storage_path            text NOT NULL,
  mime_type               text NOT NULL,
  size_bytes              bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  original_filename       text,
  uploaded_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payouts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charity_group_id    uuid NOT NULL REFERENCES public.charity_groups(id) ON DELETE CASCADE,
  campaign_id         uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  amount              numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency            char(3) NOT NULL DEFAULT 'DZD',
  status              payout_status NOT NULL DEFAULT 'pending',
  destination         jsonb NOT NULL,
  requested_at        timestamptz NOT NULL DEFAULT now(),
  approved_at         timestamptz,
  approved_by         uuid REFERENCES auth.users(id),
  paid_at             timestamptz,
  paid_by             uuid REFERENCES auth.users(id),
  external_reference  text,
  rejection_reason    text,
  notes               text
);

CREATE INDEX idx_payouts_charity_group_id ON public.payouts(charity_group_id);
CREATE INDEX idx_payouts_status           ON public.payouts(status);

CREATE TABLE public.ledger_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charity_group_id  uuid REFERENCES public.charity_groups(id) ON DELETE CASCADE,
  campaign_id       uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  donation_id       uuid REFERENCES public.donations(id) ON DELETE SET NULL,
  payout_id         uuid REFERENCES public.payouts(id) ON DELETE SET NULL,
  type              ledger_type NOT NULL,
  amount            numeric(12, 2) NOT NULL,
  currency          char(3) NOT NULL DEFAULT 'DZD',
  status            text NOT NULL DEFAULT 'posted',
  reference         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_ledger_charity_group_id ON public.ledger_entries(charity_group_id);
CREATE INDEX idx_ledger_campaign_id      ON public.ledger_entries(campaign_id);
CREATE INDEX idx_ledger_donation_id      ON public.ledger_entries(donation_id);
CREATE INDEX idx_ledger_payout_id        ON public.ledger_entries(payout_id);

CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES auth.users(id),
  action      audit_action NOT NULL,
  target_type text NOT NULL,
  target_id   text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_admin_id    ON public.audit_logs(admin_id);
CREATE INDEX idx_audit_logs_target      ON public.audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created_at  ON public.audit_logs(created_at DESC);

CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text NOT NULL,
  message     text NOT NULL,
  read        boolean NOT NULL DEFAULT false,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id      ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread       ON public.notifications(user_id) WHERE read = false;

-- Modified tables ------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS charity_group_id uuid REFERENCES public.charity_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS certified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certified_at timestamptz,
  ADD COLUMN IF NOT EXISTS certified_by uuid REFERENCES auth.users(id);

-- The existing campaigns.status is text; cast it to the new enum.
-- All existing values are valid enum members per the seed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'status'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.campaigns
      ALTER COLUMN status DROP DEFAULT,
      ALTER COLUMN status TYPE campaign_status USING status::campaign_status,
      ALTER COLUMN status SET DEFAULT 'draft';
  END IF;
END $$;

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS charity_group_id uuid REFERENCES public.charity_groups(id) ON DELETE SET NULL;

-- Row Level Security --------------------------------------------------------

ALTER TABLE public.user_roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charity_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charity_applications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charity_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;

-- user_roles: see own only, no writes from authenticated
CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- profiles: public SELECT, self UPDATE
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- charity_groups: anonymous sees only approved + verified; authenticated sees own
CREATE POLICY "charity_groups_select_public" ON public.charity_groups
  FOR SELECT TO anon
  USING (status = 'approved' AND verified = true);
CREATE POLICY "charity_groups_select_authenticated" ON public.charity_groups
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (status = 'approved' AND verified = true));

-- charity_applications: see own, insert own, update own only when status allows re-edit
CREATE POLICY "charity_applications_select_own" ON public.charity_applications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "charity_applications_insert_own" ON public.charity_applications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "charity_applications_update_own" ON public.charity_applications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('more_info_required', 'draft'))
  WITH CHECK (user_id = auth.uid());

-- charity_documents: see own application's docs only
CREATE POLICY "charity_documents_select_own" ON public.charity_documents
  FOR SELECT TO authenticated
  USING (
    charity_application_id IN (
      SELECT id FROM public.charity_applications WHERE user_id = auth.uid()
    )
  );

-- payouts: see own charity's, no writes from authenticated
CREATE POLICY "payouts_select_own" ON public.payouts
  FOR SELECT TO authenticated
  USING (
    charity_group_id IN (
      SELECT id FROM public.charity_groups WHERE user_id = auth.uid()
    )
  );

-- ledger_entries: see own charity's, no writes from authenticated
CREATE POLICY "ledger_select_own" ON public.ledger_entries
  FOR SELECT TO authenticated
  USING (
    charity_group_id IN (
      SELECT id FROM public.charity_groups WHERE user_id = auth.uid()
    )
  );

-- audit_logs: admins can read, nobody can write
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- notifications: see/update own, no insert from authenticated
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- campaigns: anonymous sees only published; authenticated charity owners can manage their own
CREATE POLICY "campaigns_select_public" ON public.campaigns
  FOR SELECT TO anon
  USING (status = 'published');
CREATE POLICY "campaigns_select_authenticated" ON public.campaigns
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "campaigns_insert_owner" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    charity_group_id IN (
      SELECT id FROM public.charity_groups
      WHERE user_id = auth.uid() AND verified = true AND status = 'approved'
    )
  );
CREATE POLICY "campaigns_update_owner" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (
    charity_group_id IN (
      SELECT id FROM public.charity_groups
      WHERE user_id = auth.uid() AND verified = true AND status = 'approved'
    )
  );

-- Append-only audit_logs via trigger (not just RLS) ---------------------------

CREATE OR REPLACE FUNCTION public.raise_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; % is not permitted', TG_OP;
END;
$$;

CREATE TRIGGER audit_logs_no_modify
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.raise_append_only();

-- Role functions -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.grant_role(
  _user_id uuid, _role user_role, _granted_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, granted_by)
  VALUES (_user_id, _role, _granted_by)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role, granted_at = now(), granted_by = EXCLUDED.granted_by;
  UPDATE public.profiles SET role = _role WHERE id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_role(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  UPDATE public.profiles SET role = 'user' WHERE id = _user_id;
END;
$$;

-- Grants ---------------------------------------------------------------------
-- has_role and get_my_role are safe to expose to authenticated (read-only).
-- grant_role and revoke_role are service-role only.

REVOKE ALL ON FUNCTION public.has_role(uuid, user_role)      FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, user_role)  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_role()      FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role()  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.grant_role(uuid, user_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_role(uuid, user_role, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.revoke_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_role(uuid) TO service_role;

-- Charity application RPCs ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_charity_application(
  _application_id uuid, _reviewer_id uuid, _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.charity_applications%ROWTYPE;
  v_group_id uuid;
BEGIN
  SELECT * INTO v_app FROM public.charity_applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application % not found', _application_id;
  END IF;

  -- Find or create the charity_groups row.
  SELECT id INTO v_group_id FROM public.charity_groups WHERE user_id = v_app.user_id;
  IF v_group_id IS NULL THEN
    INSERT INTO public.charity_groups (
      user_id, name, slug, description, category, wilaya, commune, address,
      phone, email, website, representative_name, representative_phone,
      representative_email, registration_number, registration_date,
      verified, verified_at, status
    ) VALUES (
      v_app.user_id, v_app.org_name, lower(regexp_replace(v_app.org_name, '[^a-zA-Z0-9]+', '-', 'g')),
      v_app.org_description, v_app.org_category, v_app.org_wilaya, v_app.org_commune, v_app.org_address,
      v_app.org_phone, v_app.org_email, v_app.org_website, v_app.rep_name, v_app.rep_phone, v_app.rep_email,
      v_app.registration_number, v_app.registration_date,
      true, now(), 'approved'
    )
    RETURNING id INTO v_group_id;
  ELSE
    UPDATE public.charity_groups
      SET verified = true, verified_at = now(), status = 'approved', updated_at = now()
      WHERE id = v_group_id;
  END IF;

  UPDATE public.charity_applications
    SET status = 'approved', admin_notes = _notes, reviewed_at = now(), reviewed_by = _reviewer_id,
        charity_group_id = v_group_id
    WHERE id = _application_id;

  PERFORM public.grant_role(v_app.user_id, 'charity_group', _reviewer_id);

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    v_app.user_id, 'charity_approved',
    'تمت الموافقة على طلب جمعيتك',
    'تمت الموافقة على طلبك للحصول على صفة جمعية خيرية. يمكنك الآن إنشاء حملاتك من لوحة تحكم الجمعية.'
  );

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
  VALUES (
    _reviewer_id, 'approve_charity', 'charity_application', _application_id::text,
    jsonb_build_object('charity_group_id', v_group_id, 'notes', _notes)
  );

  RETURN v_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_charity_application(
  _application_id uuid, _reviewer_id uuid, _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  UPDATE public.charity_applications
    SET status = 'rejected', admin_notes = _reason, reviewed_at = now(), reviewed_by = _reviewer_id
    WHERE id = _application_id
    RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Application % not found', _application_id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    v_user_id, 'charity_rejected',
    'تم رفض طلب جمعيتك',
    format('تم رفض طلبك للحصول على صفة جمعية خيرية. السبب: %s', _reason)
  );

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
  VALUES (
    _reviewer_id, 'reject_charity', 'charity_application', _application_id::text,
    jsonb_build_object('reason', _reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_more_info(
  _application_id uuid, _reviewer_id uuid, _notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  UPDATE public.charity_applications
    SET status = 'more_info_required', admin_notes = _notes, reviewed_at = now(), reviewed_by = _reviewer_id
    WHERE id = _application_id
    RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Application % not found', _application_id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    v_user_id, 'charity_more_info',
    'مطلوب معلومات إضافية',
    format('يرجى تحديث طلبك للحصول على صفة جمعية خيرية. ملاحظات الإدارة: %s', _notes)
  );

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
  VALUES (
    _reviewer_id, 'reject_charity', 'charity_application', _application_id::text,
    jsonb_build_object('notes', _notes, 'kind', 'more_info_required')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_charity_application(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_charity_application(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.reject_charity_application(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_charity_application(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.request_more_info(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_more_info(uuid, uuid, text) TO service_role;

-- Default role on signup ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_default_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.ensure_default_user_role();

REVOKE ALL ON FUNCTION public.ensure_default_user_role() FROM PUBLIC;

-- Ledger entry on donation PAID ----------------------------------------------

CREATE OR REPLACE FUNCTION public.record_donation_ledger_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charity_group_id uuid;
  v_campaign_title text;
BEGIN
  -- Only fire when status flips to PAID
  IF NEW.status IS DISTINCT FROM 'PAID' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'PAID' THEN
    RETURN NEW;  -- idempotent: don't re-insert on re-update
  END IF;

  -- Get the charity_group_id from the donation (denormalized at insert)
  v_charity_group_id := NEW.charity_group_id;
  IF v_charity_group_id IS NULL THEN
    SELECT cg.charity_group_id INTO v_charity_group_id
    FROM public.campaigns cg
    WHERE cg.id = NEW.campaign_id;
  END IF;

  IF v_charity_group_id IS NULL THEN
    -- Legacy donation before charity_groups existed; skip ledger write.
    RETURN NEW;
  END IF;

  SELECT title INTO v_campaign_title FROM public.campaigns WHERE id = NEW.campaign_id;

  INSERT INTO public.ledger_entries (
    charity_group_id, campaign_id, donation_id, type, amount, currency, status, reference
  ) VALUES (
    v_charity_group_id, NEW.campaign_id, NEW.id, 'donation', NEW.amount, NEW.currency, 'posted',
    format('donation:%s', NEW.reference)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER donations_after_paid_ledger
  AFTER UPDATE OF status ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.record_donation_ledger_entry();

REVOKE ALL ON FUNCTION public.record_donation_ledger_entry() FROM PUBLIC;

-- Campaign certification and moderation RPCs --------------------------------

CREATE OR REPLACE FUNCTION public.certify_campaign(
  _campaign_id uuid, _admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.campaigns
    SET certified = true, certified_at = now(), certified_by = _admin_id
    WHERE id = _campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign % not found', _campaign_id;
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id)
  VALUES (_admin_id, 'certify_campaign', 'campaign', _campaign_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_campaign_certification(
  _campaign_id uuid, _admin_id uuid, _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.campaigns
    SET certified = false, certified_at = NULL, certified_by = NULL
    WHERE id = _campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign % not found', _campaign_id;
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
  VALUES (
    _admin_id, 'remove_certification', 'campaign', _campaign_id::text,
    jsonb_build_object('reason', _reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_campaign(
  _campaign_id uuid, _admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charity_group_id uuid;
BEGIN
  UPDATE public.campaigns SET status = 'published' WHERE id = _campaign_id
    RETURNING charity_group_id INTO v_charity_group_id;

  IF v_charity_group_id IS NULL THEN
    RAISE EXCEPTION 'Campaign % not found', _campaign_id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message)
  SELECT cg.user_id, 'campaign_published', 'تم نشر حملتك',
    'تم نشر حملتك وهي متاحة الآن للمتبرعين.'
  FROM public.charity_groups cg WHERE cg.id = v_charity_group_id;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id)
  VALUES (_admin_id, 'approve_campaign', 'campaign', _campaign_id::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_campaign(
  _campaign_id uuid, _admin_id uuid, _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charity_group_id uuid;
BEGIN
  UPDATE public.campaigns SET status = 'rejected' WHERE id = _campaign_id
    RETURNING charity_group_id INTO v_charity_group_id;

  IF v_charity_group_id IS NULL THEN
    RAISE EXCEPTION 'Campaign % not found', _campaign_id;
  END IF;

  IF v_charity_group_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    SELECT cg.user_id, 'campaign_rejected', 'تم رفض حملتك',
      format('تم رفض حملتك. السبب: %s', _reason)
    FROM public.charity_groups cg WHERE cg.id = v_charity_group_id;
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
  VALUES (_admin_id, 'reject_campaign', 'campaign', _campaign_id::text,
    jsonb_build_object('reason', _reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.suspend_campaign(
  _campaign_id uuid, _admin_id uuid, _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior_status campaign_status;
  v_charity_group_id uuid;
BEGIN
  SELECT status, charity_group_id INTO v_prior_status, v_charity_group_id
    FROM public.campaigns WHERE id = _campaign_id FOR UPDATE;

  IF v_prior_status IS NULL THEN
    RAISE EXCEPTION 'Campaign % not found', _campaign_id;
  END IF;

  UPDATE public.campaigns SET status = 'suspended' WHERE id = _campaign_id;

  IF v_charity_group_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    SELECT cg.user_id, 'campaign_suspended', 'تم تعليق حملتك',
      format('تم تعليق حملتك مؤقتاً. السبب: %s', _reason)
    FROM public.charity_groups cg WHERE cg.id = v_charity_group_id;
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
  VALUES (_admin_id, 'suspend_campaign', 'campaign', _campaign_id::text,
    jsonb_build_object('reason', _reason, 'prior_status', v_prior_status::text));
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_campaign(
  _campaign_id uuid, _admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior_status text;
BEGIN
  SELECT metadata->>'prior_status' INTO v_prior_status
    FROM public.audit_logs
    WHERE target_type = 'campaign' AND target_id = _campaign_id::text
      AND action = 'suspend_campaign'
    ORDER BY created_at DESC LIMIT 1;

  IF v_prior_status IS NULL THEN
    v_prior_status := 'published';
  END IF;

  UPDATE public.campaigns SET status = v_prior_status::campaign_status WHERE id = _campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign % not found', _campaign_id;
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
  VALUES (_admin_id, 'approve_campaign', 'campaign', _campaign_id::text,
    jsonb_build_object('restored_to', v_prior_status));
END;
$$;

REVOKE ALL ON FUNCTION public.certify_campaign(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.certify_campaign(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.remove_campaign_certification(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_campaign_certification(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.publish_campaign(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_campaign(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reject_campaign(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_campaign(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.suspend_campaign(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suspend_campaign(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.reactivate_campaign(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reactivate_campaign(uuid, uuid) TO service_role;

-- Payout RPCs ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_payout(
  _charity_group_id uuid, _amount numeric, _currency char(3), _destination jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_available numeric;
  v_pending numeric;
  v_payout_id uuid;
BEGIN
  -- Verify the caller owns this charity group
  SELECT user_id INTO v_owner_id FROM public.charity_groups WHERE id = _charity_group_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Charity group % not found', _charity_group_id;
  END IF;
  IF v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to request a payout for this charity group';
  END IF;

  -- Compute available balance from ledger
  SELECT COALESCE(SUM(amount), 0) INTO v_available
    FROM public.ledger_entries
    WHERE charity_group_id = _charity_group_id AND status = 'posted' AND type IN ('donation', 'adjustment');

  -- Subtract already-paid and in-flight payouts
  SELECT COALESCE(SUM(amount), 0) INTO v_pending
    FROM public.payouts
    WHERE charity_group_id = _charity_group_id
      AND status IN ('pending', 'under_review', 'approved', 'processing', 'paid');

  IF (_amount > (v_available - v_pending)) THEN
    RAISE EXCEPTION 'Insufficient balance: requested %, available %', _amount, (v_available - v_pending);
  END IF;

  INSERT INTO public.payouts (charity_group_id, amount, currency, status, destination)
  VALUES (_charity_group_id, _amount, _currency, 'pending', _destination)
  RETURNING id INTO v_payout_id;

  -- Notify all admins
  INSERT INTO public.notifications (user_id, type, title, message)
  SELECT ur.user_id, 'payout_requested', 'طلب سحب جديد',
    format('تلقت منصة حملة طلب سحب جديد بقيمة %s %s.', _amount, _currency)
  FROM public.user_roles ur WHERE ur.role = 'admin';

  RETURN v_payout_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_payout(
  _payout_id uuid, _admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charity_group_id uuid;
  v_amount numeric;
BEGIN
  UPDATE public.payouts SET status = 'approved', approved_at = now(), approved_by = _admin_id
    WHERE id = _payout_id AND status IN ('pending', 'under_review')
    RETURNING charity_group_id, amount INTO v_charity_group_id, v_amount;

  IF v_charity_group_id IS NULL THEN
    RAISE EXCEPTION 'Payout % not found or not in approvable state', _payout_id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message)
  SELECT cg.user_id, 'payout_approved', 'تمت الموافقة على طلب السحب',
    format('تمت الموافقة على طلب السحب بقيمة %s دج.', v_amount)
  FROM public.charity_groups cg WHERE cg.id = v_charity_group_id;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
  VALUES (_admin_id, 'approve_payout', 'payout', _payout_id::text,
    jsonb_build_object('amount', v_amount, 'charity_group_id', v_charity_group_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_payout(
  _payout_id uuid, _admin_id uuid, _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charity_group_id uuid;
  v_amount numeric;
BEGIN
  UPDATE public.payouts SET status = 'rejected', rejection_reason = _reason
    WHERE id = _payout_id AND status IN ('pending', 'under_review')
    RETURNING charity_group_id, amount INTO v_charity_group_id, v_amount;

  IF v_charity_group_id IS NULL THEN
    RAISE EXCEPTION 'Payout % not found or not in rejectable state', _payout_id;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message)
  SELECT cg.user_id, 'payout_rejected', 'تم رفض طلب السحب',
    format('تم رفض طلب السحب. السبب: %s', _reason)
  FROM public.charity_groups cg WHERE cg.id = v_charity_group_id;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
  VALUES (_admin_id, 'reject_payout', 'payout', _payout_id::text,
    jsonb_build_object('reason', _reason, 'amount', v_amount));
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payout_paid(
  _payout_id uuid, _admin_id uuid, _external_reference text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charity_group_id uuid;
  v_amount numeric;
  v_currency char(3);
BEGIN
  UPDATE public.payouts
    SET status = 'paid', paid_at = now(), paid_by = _admin_id, external_reference = _external_reference
    WHERE id = _payout_id AND status IN ('approved', 'processing')
    RETURNING charity_group_id, amount, currency INTO v_charity_group_id, v_amount, v_currency;

  IF v_charity_group_id IS NULL THEN
    RAISE EXCEPTION 'Payout % not found or not in payable state', _payout_id;
  END IF;

  -- The only place a payout decreases the ledger.
  INSERT INTO public.ledger_entries (
    charity_group_id, payout_id, type, amount, currency, status, reference, created_by
  ) VALUES (
    v_charity_group_id, _payout_id, 'payout', -v_amount, v_currency, 'posted',
    format('payout:%s', _payout_id), _admin_id
  );

  INSERT INTO public.notifications (user_id, type, title, message)
  SELECT cg.user_id, 'payout_paid', 'تم تحويل السحب',
    format('تم تأكيد تحويل مبلغ %s %s.', v_amount, v_currency)
  FROM public.charity_groups cg WHERE cg.id = v_charity_group_id;

  INSERT INTO public.audit_logs (admin_id, action, target_type, target_id, metadata)
  VALUES (_admin_id, 'mark_payout_paid', 'payout', _payout_id::text,
    jsonb_build_object('external_reference', _external_reference, 'amount', v_amount));
END;
$$;

REVOKE ALL ON FUNCTION public.request_payout(uuid, numeric, char, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_payout(uuid, numeric, char, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_payout(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_payout(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reject_payout(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_payout(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mark_payout_paid(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_payout_paid(uuid, uuid, text) TO service_role;

-- Charity balances (service-role-only SQL helper) ----------------------------

CREATE OR REPLACE FUNCTION public.get_charity_balances(_charity_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_raised numeric := 0;
  v_total_paid numeric := 0;
  v_pending numeric := 0;
  v_campaign_count int := 0;
  v_donor_count int := 0;
  v_donation_count int := 0;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total_raised
    FROM public.ledger_entries
    WHERE charity_group_id = _charity_group_id AND type = 'donation' AND status = 'posted';

  SELECT COALESCE(SUM(-amount), 0) INTO v_total_paid
    FROM public.ledger_entries
    WHERE charity_group_id = _charity_group_id AND type = 'payout' AND status = 'posted';

  SELECT COALESCE(SUM(p.amount), 0) INTO v_pending
    FROM public.payouts p
    WHERE p.charity_group_id = _charity_group_id
      AND p.status IN ('pending', 'under_review', 'approved', 'processing');

  SELECT COUNT(*) INTO v_campaign_count
    FROM public.campaigns WHERE charity_group_id = _charity_group_id;

  SELECT COUNT(DISTINCT d.user_id) INTO v_donor_count
    FROM public.donations d
    JOIN public.campaigns c ON c.id = d.campaign_id
    WHERE c.charity_group_id = _charity_group_id AND d.status = 'PAID' AND d.user_id IS NOT NULL;

  SELECT COUNT(*) INTO v_donation_count
    FROM public.donations d
    JOIN public.campaigns c ON c.id = d.campaign_id
    WHERE c.charity_group_id = _charity_group_id AND d.status = 'PAID';

  RETURN jsonb_build_object(
    'totalRaisedDzd', v_total_raised,
    'totalPaidDzd', v_total_paid,
    'availableBalanceDzd', v_total_raised - v_total_paid - v_pending,
    'pendingBalanceDzd', v_pending,
    'campaignCount', v_campaign_count,
    'donorCount', v_donor_count,
    'donationCount', v_donation_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_charity_balances(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_charity_balances(uuid) TO service_role;

COMMIT;
