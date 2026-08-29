# HAMLA Platform MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing HAMLA TanStack Start + Supabase codebase from a single-campaign donation page into a multi-role crowdfunding platform (USER / CHARITY_GROUP / ADMIN) with charity applications, campaign moderation, payout management, a financial ledger, signed-URL document storage, and a SlickPay stub.

**Architecture:** One new SQL migration + one new storage migration applied to the existing Supabase project. New server functions follow the existing `createServerFn` + `requireSupabaseAuth` pattern. New routes follow the existing file-based convention under `src/routes/`. SlickPay is shipped as a stub that throws a clear "not yet configured" error; the existing `algerian-gateway` and `sandbox` providers are untouched and continue to work.

**Tech Stack:** TanStack Start 1.168.32, TanStack Router 1.170.18, React 19.2, Supabase JS 2.112, Postgres (existing Supabase project), Tailwind 4.2, IBM Plex Sans Arabic, recharts 2.15 (already in deps).

**Reference spec:** `docs/superpowers/specs/2026-08-29-hamla-platform-design.md` (committed on `feature/hamla-platform-mvp` as `5a355d9`).

## Global Constraints

These apply to every task. Each is copied verbatim from the approved spec.

- All user-facing text in Arabic, matching the tone of the existing seed campaign (`ساعدوا عائلة أحمد على تجاوز محنتهم`).
- RTL throughout. IBM Plex Sans Arabic as the only font.
- All values in DZD, formatted via the existing `formatDZD` from `src/lib/format.ts`.
- NO secret values (Supabase service role, SlickPay keys) may appear in any committed file. Read via `process.env` only.
- NO changes to `finalize_donation`'s body. The ledger trigger sits alongside it.
- NO removal of the existing `campaigns.verified` column. The three-boolean distinction lives across `campaigns.verified` (existing, kept), `charity_groups.verified` (new), and `campaigns.certified` (new).
- Commit to `feature/hamla-platform-mvp`. Never push to `main`. Never rewrite published history.
- Every admin server-fn calls `requireAdmin(userId)` as its first line.
- Every admin action calls `logAdminAction(...)` from `src/lib/server/audit.server.ts` (built in Part 3).
- Sensitive tables are `service-role`-only for writes via RLS policies in the migration.
- Branch: `feature/hamla-platform-mvp`. Commits are atomic and on this branch.

## Verification philosophy

This plan uses two verification levels, chosen per task:

- **L1 (TypeScript compile):** `npx tsc --noEmit` must pass after each task. Run from the repo root.
- **L2 (Manual smoke test):** For every task that produces user-visible behavior, run `bun run dev` and click through the listed flow. Confirm the Arabic copy renders correctly and the action produces the expected database state.

This repo has no test runner. Adding one is out of scope. ESLint + TypeScript is the type-safety gate; the dev server is the behavior gate.

For SQL changes, the verification is: apply the migration via `psql` (or `supabase db push`), then run the SQL snippet listed in the task and confirm the expected output.

---

# Part 1 — Database

## Task 1.1: Create the schema migration file (empty, validated)

**Files:**
- Create: `supabase/migrations/20260829000000_hamla_platform.sql` (empty header for now)

**Step 1: Confirm we are on the feature branch**

```bash
git status --short
git branch --show-current
```

Expected: clean working tree (or only `m1.sql` and `m2.sql` untracked, which are my local read-copies), current branch is `feature/hamla-platform-mvp`.

**Step 2: Create the empty migration file with the header comment**

Write `supabase/migrations/20260829000000_hamla_platform.sql`:

```sql
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

-- (contents added in subsequent tasks)

COMMIT;
```

**Step 3: Validate the empty migration applies cleanly**

Run against the live Supabase project (paste your service role key into a local `SUPABASE_DB_URL` env var, do not commit it):

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260829000000_hamla_platform.sql
```

Expected: `BEGIN` then `COMMIT`, no errors.

**Step 4: Commit**

```bash
git add supabase/migrations/20260829000000_hamla_platform.sql
git commit -m "chore(db): scaffold empty Part 1 migration"
```

---

## Task 1.2: Add enums

**Files:**
- Modify: `supabase/migrations/20260829000000_hamla_platform.sql` (add inside the BEGIN block)

**Step 1: Add the enums inside the BEGIN block**

Insert before the `COMMIT;`:

```sql
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
```

**Step 2: Apply the migration**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260829000000_hamla_platform.sql
```

Expected: no errors. The enums are created. If you re-run, you must `DROP TYPE` first or wrap in `DO $$ ... $$`; the migration as written will fail on second run. That is acceptable for v1 — we apply it once.

**Step 3: Verify the enums exist**

```bash
psql "$SUPABASE_DB_URL" -c "\dT public.*"
```

Expected: lists `user_role`, `charity_status`, `app_status`, `campaign_status`, `payout_status`, `ledger_type`, `audit_action` with their values.

**Step 4: Commit**

```bash
git add supabase/migrations/20260829000000_hamla_platform.sql
git commit -m "feat(db): add role/status/ledger/audit enums"
```

---

## Task 1.3: Add new tables

**Files:**
- Modify: `supabase/migrations/20260829000000_hamla_platform.sql` (add inside the BEGIN block, after enums)

**Step 1: Add the table definitions**

```sql
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
```

**Step 2: Modify the existing `profiles` and `campaigns` tables**

```sql
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
```

**Step 3: Apply and verify**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260829000000_hamla_platform.sql
psql "$SUPABASE_DB_URL" -c "\dt public.*"
```

Expected: lists all 8 new tables (`user_roles`, `charity_groups`, `charity_applications`, `charity_documents`, `payouts`, `ledger_entries`, `audit_logs`, `notifications`) alongside the 5 existing tables.

Verify the schema changes:

```bash
psql "$SUPABASE_DB_URL" -c "\d public.campaigns" | grep -E "certified|charity_group_id"
psql "$SUPABASE_DB_URL" -c "\d public.donations" | grep charity_group_id
psql "$SUPABASE_DB_URL" -c "\d public.profiles" | grep -E "role|status"
```

Expected: each command prints the expected column.

**Step 4: Confirm the seed campaign is still valid**

```bash
psql "$SUPABASE_DB_URL" -c "SELECT id, title, status FROM public.campaigns;"
```

Expected: returns the Ahmed campaign row, `status = 'published'` (cast to the new enum successfully).

**Step 5: Commit**

```bash
git add supabase/migrations/20260829000000_hamla_platform.sql
git commit -m "feat(db): add 8 new tables, extend profiles/campaigns/donations"
```

---

## Task 1.4: Add RLS policies and the append-only audit trigger

**Files:**
- Modify: `supabase/migrations/20260829000000_hamla_platform.sql` (add after the tables block)

**Step 1: Enable RLS and add policies**

```sql
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
```

**Step 2: Append-only audit log trigger**

```sql
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
```

**Step 3: Apply and verify**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260829000000_hamla_platform.sql
```

Expected: clean apply.

```bash
psql "$SUPABASE_DB_URL" -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;"
```

Expected: lists 14+ policies across the new tables.

Verify the append-only trigger blocks deletion:

```bash
psql "$SUPABASE_DB_URL" -c "INSERT INTO public.audit_logs (admin_id, action, target_type, target_id) VALUES (gen_random_uuid(), 'approve_charity', 'test', 'test'); DELETE FROM public.audit_logs WHERE target_type = 'test';"
```

Expected: the INSERT succeeds, the DELETE fails with `ERROR: audit_logs is append-only; DELETE is not permitted`. Clean up the test row:

```bash
psql "$SUPABASE_DB_URL" -c "TRUNCATE public.audit_logs;"
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260829000000_hamla_platform.sql
git commit -m "feat(db): RLS policies and append-only audit trigger"
```

---

## Task 1.5: Add the role-checking and role-granting functions

**Files:**
- Modify: `supabase/migrations/20260829000000_hamla_platform.sql`

**Step 1: Add the role functions**

```sql
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
```

**Step 2: Apply and verify**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260829000000_hamla_platform.sql
```

Test the functions with your own user ID (paste your Supabase auth user ID, you can find it in Authentication → Users in the dashboard):

```bash
psql "$SUPABASE_DB_URL" -c "SELECT public.has_role('<your-uid>', 'admin');"
```

Expected: returns `false` (you do not have the admin role yet — that comes from the manual grant in Task 1.12).

**Step 3: Commit**

```bash
git add supabase/migrations/20260829000000_hamla_platform.sql
git commit -m "feat(db): has_role, get_my_role, grant_role, revoke_role"
```

---

## Task 1.6: Add charity application RPCs

**Files:**
- Modify: `supabase/migrations/20260829000000_hamla_platform.sql`

**Step 1: Add the RPCs**

```sql
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
```

**Step 2: Apply and verify function existence**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260829000000_hamla_platform.sql
psql "$SUPABASE_DB_URL" -c "\df public.approve_charity_application" -c "\df public.reject_charity_application" -c "\df public.request_more_info"
```

Expected: each `\df` lists the function with the correct argument types.

**Step 3: Commit**

```bash
git add supabase/migrations/20260829000000_hamla_platform.sql
git commit -m "feat(db): charity application approval/rejection/more_info RPCs"
```

---

## Task 1.7: Add the auth.users trigger and ledger trigger

**Files:**
- Modify: `supabase/migrations/20260829000000_hamla_platform.sql`

**Step 1: Add the user-role trigger**

```sql
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
```

**Step 2: Add the ledger trigger on donations**

```sql
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
```

**Step 3: Apply and verify triggers exist**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260829000000_hamla_platform.sql
psql "$SUPABASE_DB_URL" -c "SELECT tgname FROM pg_trigger WHERE tgname IN ('on_auth_user_created_assign_role', 'donations_after_paid_ledger');"
```

Expected: two rows.

**Step 4: Commit**

```bash
git add supabase/migrations/20260829000000_hamla_platform.sql
git commit -m "feat(db): user-role and donation-ledger triggers"
```

---

## Task 1.8: Add campaign certification and moderation RPCs

**Files:**
- Modify: `supabase/migrations/20260829000000_hamla_platform.sql`

**Step 1: Add the RPCs**

```sql
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
```

**Step 2: Apply and verify**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260829000000_hamla_platform.sql
psql "$SUPABASE_DB_URL" -c "\df public.certify_campaign" -c "\df public.remove_campaign_certification" -c "\df public.publish_campaign" -c "\df public.reject_campaign" -c "\df public.suspend_campaign" -c "\df public.reactivate_campaign"
```

Expected: each `\df` lists the function.

**Step 3: Commit**

```bash
git add supabase/migrations/20260829000000_hamla_platform.sql
git commit -m "feat(db): campaign certification and moderation RPCs"
```

---

## Task 1.9: Add payout RPCs and the balance SQL function

**Files:**
- Modify: `supabase/migrations/20260829000000_hamla_platform.sql`

**Step 1: Add the payout RPCs**

```sql
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
```

**Step 2: Add the balance SQL function**

```sql
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
```

**Step 3: Apply and verify**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260829000000_hamla_platform.sql
psql "$SUPABASE_DB_URL" -c "\df public.request_payout" -c "\df public.approve_payout" -c "\df public.reject_payout" -c "\df public.mark_payout_paid" -c "\df public.get_charity_balances"
```

Expected: each function listed.

**Step 4: Smoke-test the balance function**

```bash
psql "$SUPABASE_DB_URL" -c "SELECT public.get_charity_balances(gen_random_uuid());"
```

Expected: returns a jsonb with all numeric fields set to 0 (no campaigns match the random uuid).

**Step 5: Commit**

```bash
git add supabase/migrations/20260829000000_hamla_platform.sql
git commit -m "feat(db): payout RPCs and get_charity_balances helper"
```

---

## Task 1.10: Add storage bucket migration

**Files:**
- Create: `supabase/migrations/20260829000001_storage_buckets.sql`

**Step 1: Create the storage migration**

```sql
-- HAMLA storage buckets (Part 1)
-- Two private buckets: charity-documents and campaign-images.
-- Fallback: if SQL bucket creation fails in your Supabase project,
-- create these manually in Storage > New bucket > Private, then re-run
-- the policy portion of this file.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('charity-documents', 'charity-documents', false, 10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]),
  ('campaign-images', 'campaign-images', false, 10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

-- RLS for charity-documents: authenticated can INSERT at paths under applications/{auth.uid()}/
CREATE POLICY "charity_documents_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'charity-documents'
    AND (storage.foldername(name))[1] = 'applications'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- RLS for campaign-images: authenticated charity owners can INSERT at paths under campaigns/{their_charity_id}/
CREATE POLICY "campaign_images_insert_owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-images'
    AND (storage.foldername(name))[1] = 'campaigns'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.charity_groups WHERE user_id = auth.uid()
    )
  );

-- No SELECT policies on storage.objects for these buckets.
-- Reads go through service_role via signed URLs only.
```

**Step 2: Apply and verify**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260829000001_storage_buckets.sql
```

If the SQL fails (some Supabase projects don't allow `INSERT INTO storage.buckets` via SQL), do this fallback:

1. In the Supabase dashboard → Storage → New bucket → name `charity-documents` → Private → file size limit 10 MB → allowed MIME types `application/pdf, image/jpeg, image/png`.
2. Repeat for `campaign-images` with MIME types `image/jpeg, image/png, image/webp`.
3. Then run only the policy portion (the two `CREATE POLICY` statements) via `psql`.

**Step 3: Verify**

```bash
psql "$SUPABASE_DB_URL" -c "SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id IN ('charity-documents', 'campaign-images');"
```

Expected: two rows, both `public = false`, both `file_size_limit = 10485760`.

```bash
psql "$SUPABASE_DB_URL" -c "SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname IN ('charity_documents_insert_own', 'campaign_images_insert_owner');"
```

Expected: two rows.

**Step 4: Commit**

```bash
git add supabase/migrations/20260829000001_storage_buckets.sql
git commit -m "feat(db): private storage buckets for charity documents and campaign images"
```

---

## Task 1.11: Update `types.ts` to match the new schema

**Files:**
- Modify: `src/integrations/supabase/types.ts`

**Step 1: Add the new types inside the `Database.public.Tables` object**

Open `src/integrations/supabase/types.ts` and locate the `Tables: {` block. Replace `profiles:`, `campaigns:`, and `donations:` with the versions that include the new columns (full code below). Then add the 8 new table definitions before the closing `}` of `Tables`.

Replace the `profiles:` block with:

```typescript
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      },
```

Replace the `campaigns:` block entirely with:

```typescript
      campaigns: {
        Row: {
          beneficiary: string | null
          category: string | null
          certified: boolean
          certified_at: string | null
          certified_by: string | null
          charity_group_id: string | null
          cover_image: string | null
          created_at: string
          currency: string
          description: string | null
          donor_count: number
          goal_amount: number
          id: string
          location: string | null
          organizer_avatar: string | null
          organizer_id: string | null
          organizer_name: string
          organizer_relation: string | null
          raised_amount: number
          slug: string
          status: Database["public"]["Enums"]["campaign_status"]
          story: string | null
          title: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          beneficiary?: string | null
          category?: string | null
          certified?: boolean
          certified_at?: string | null
          certified_by?: string | null
          charity_group_id?: string | null
          cover_image?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          donor_count?: number
          goal_amount?: number
          id?: string
          location?: string | null
          organizer_avatar?: string | null
          organizer_id?: string | null
          organizer_name: string
          organizer_relation?: string | null
          raised_amount?: number
          slug: string
          status?: Database["public"]["Enums"]["campaign_status"]
          story?: string | null
          title: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          beneficiary?: string | null
          category?: string | null
          certified?: boolean
          certified_at?: string | null
          certified_by?: string | null
          charity_group_id?: string | null
          cover_image?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          donor_count?: number
          goal_amount?: number
          id?: string
          location?: string | null
          organizer_avatar?: string | null
          organizer_id?: string | null
          organizer_name?: string
          organizer_relation?: string | null
          raised_amount?: number
          slug?: string
          status?: Database["public"]["Enums"]["campaign_status"]
          story?: string | null
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      },
```

Replace the `donations:` block (add `charity_group_id` to all three Row/Insert/Update variants):

```typescript
      donations: {
        Row: {
          amount: number
          anonymous: boolean
          campaign_id: string
          charity_group_id: string | null
          created_at: string
          currency: string
          donor_email: string | null
          donor_name: string | null
          id: string
          message: string | null
          paid_at: string | null
          payment_provider: string | null
          reference: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          anonymous?: boolean
          campaign_id: string
          charity_group_id?: string | null
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          message?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          reference: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          anonymous?: boolean
          campaign_id?: string
          charity_group_id?: string | null
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          message?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      },
```

After the `invoices:` block, add the 8 new tables:

```typescript
      user_roles: {
        Row: { granted_at: string; granted_by: string | null; role: Database["public"]["Enums"]["user_role"]; user_id: string }
        Insert: { granted_at?: string; granted_by?: string | null; role: Database["public"]["Enums"]["user_role"]; user_id: string }
        Update: { granted_at?: string; granted_by?: string | null; role?: Database["public"]["Enums"]["user_role"]; user_id?: string }
        Relationships: []
      },
      charity_groups: {
        Row: {
          address: string | null; category: string | null; commune: string | null; created_at: string;
          description: string | null; email: string | null; id: string; logo_url: string | null;
          name: string; phone: string | null; registration_date: string | null;
          registration_number: string | null; representative_email: string | null;
          representative_name: string | null; representative_phone: string | null;
          slug: string; status: Database["public"]["Enums"]["charity_status"]; updated_at: string;
          user_id: string; verified: boolean; verified_at: string | null; website: string | null; wilaya: string | null
        }
        Insert: {
          address?: string | null; category?: string | null; commune?: string | null; created_at?: string;
          description?: string | null; email?: string | null; id?: string; logo_url?: string | null;
          name: string; phone?: string | null; registration_date?: string | null;
          registration_number?: string | null; representative_email?: string | null;
          representative_name?: string | null; representative_phone?: string | null;
          slug: string; status?: Database["public"]["Enums"]["charity_status"]; updated_at?: string;
          user_id: string; verified?: boolean; verified_at?: string | null; website?: string | null; wilaya?: string | null
        }
        Update: {
          address?: string | null; category?: string | null; commune?: string | null; created_at?: string;
          description?: string | null; email?: string | null; id?: string; logo_url?: string | null;
          name?: string; phone?: string | null; registration_date?: string | null;
          registration_number?: string | null; representative_email?: string | null;
          representative_name?: string | null; representative_phone?: string | null;
          slug?: string; status?: Database["public"]["Enums"]["charity_status"]; updated_at?: string;
          user_id?: string; verified?: boolean; verified_at?: string | null; website?: string | null; wilaya?: string | null
        }
        Relationships: []
      },
      charity_applications: {
        Row: {
          admin_notes: string | null; charity_group_id: string | null; id: string;
          org_address: string; org_category: string; org_commune: string; org_description: string | null;
          org_email: string; org_name: string; org_name_ar: string; org_phone: string; org_website: string | null;
          org_wilaya: string; registration_date: string | null; registration_number: string | null; rep_email: string;
          rep_name: string; rep_phone: string; reviewed_at: string | null; reviewed_by: string | null;
          status: Database["public"]["Enums"]["app_status"]; submitted_at: string; user_id: string
        }
        Insert: {
          admin_notes?: string | null; charity_group_id?: string | null; id?: string;
          org_address: string; org_category: string; org_commune: string; org_description?: string | null;
          org_email: string; org_name: string; org_name_ar: string; org_phone: string; org_website?: string | null;
          org_wilaya: string; registration_date?: string | null; registration_number?: string | null; rep_email: string;
          rep_name: string; rep_phone: string; reviewed_at?: string | null; reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["app_status"]; submitted_at?: string; user_id: string
        }
        Update: {
          admin_notes?: string | null; charity_group_id?: string | null; id?: string;
          org_address?: string; org_category?: string; org_commune?: string; org_description?: string | null;
          org_email?: string; org_name?: string; org_name_ar?: string; org_phone?: string; org_website?: string | null;
          org_wilaya?: string; registration_date?: string | null; registration_number?: string | null; rep_email?: string;
          rep_name?: string; rep_phone?: string; reviewed_at?: string | null; reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["app_status"]; submitted_at?: string; user_id?: string
        }
        Relationships: []
      },
      charity_documents: {
        Row: {
          charity_application_id: string; id: string; mime_type: string; original_filename: string | null;
          size_bytes: number; storage_path: string; type: string; uploaded_at: string
        }
        Insert: {
          charity_application_id: string; id?: string; mime_type: string; original_filename?: string | null;
          size_bytes: number; storage_path: string; type: string; uploaded_at?: string
        }
        Update: {
          charity_application_id?: string; id?: string; mime_type?: string; original_filename?: string | null;
          size_bytes?: number; storage_path?: string; type?: string; uploaded_at?: string
        }
        Relationships: []
      },
      payouts: {
        Row: {
          amount: number; approved_at: string | null; approved_by: string | null;
          campaign_id: string | null; charity_group_id: string; created_at: string; currency: string;
          destination: Json; external_reference: string | null; id: string; notes: string | null;
          paid_at: string | null; paid_by: string | null; rejection_reason: string | null;
          requested_at: string; status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          amount: number; approved_at?: string | null; approved_by?: string | null;
          campaign_id?: string | null; charity_group_id: string; created_at?: string; currency?: string;
          destination: Json; external_reference?: string | null; id?: string; notes?: string | null;
          paid_at?: string | null; paid_by?: string | null; rejection_reason?: string | null;
          requested_at?: string; status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          amount?: number; approved_at?: string | null; approved_by?: string | null;
          campaign_id?: string | null; charity_group_id?: string; created_at?: string; currency?: string;
          destination?: Json; external_reference?: string | null; id?: string; notes?: string | null;
          paid_at?: string | null; paid_by?: string | null; rejection_reason?: string | null;
          requested_at?: string; status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: []
      },
      ledger_entries: {
        Row: {
          amount: number; campaign_id: string | null; charity_group_id: string | null;
          created_at: string; created_by: string | null; currency: string; donation_id: string | null;
          id: string; payout_id: string | null; reference: string | null; status: string;
          type: Database["public"]["Enums"]["ledger_type"]
        }
        Insert: {
          amount: number; campaign_id?: string | null; charity_group_id?: string | null;
          created_at?: string; created_by?: string | null; currency?: string; donation_id?: string | null;
          id?: string; payout_id?: string | null; reference?: string | null; status?: string;
          type: Database["public"]["Enums"]["ledger_type"]
        }
        Update: {
          amount?: number; campaign_id?: string | null; charity_group_id?: string | null;
          created_at?: string; created_by?: string | null; currency?: string; donation_id?: string | null;
          id?: string; payout_id?: string | null; reference?: string | null; status?: string;
          type?: Database["public"]["Enums"]["ledger_type"]
        }
        Relationships: []
      },
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]; admin_id: string; created_at: string;
          id: string; metadata: Json; target_id: string; target_type: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]; admin_id: string; created_at?: string;
          id?: string; metadata?: Json; target_id: string; target_type: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]; admin_id?: string; created_at?: string;
          id?: string; metadata?: Json; target_id?: string; target_type?: string
        }
        Relationships: []
      },
      notifications: {
        Row: {
          created_at: string; id: string; message: string; read: boolean; read_at: string | null;
          title: string; type: string; user_id: string
        }
        Insert: {
          created_at?: string; id?: string; message: string; read?: boolean; read_at?: string | null;
          title: string; type: string; user_id: string
        }
        Update: {
          created_at?: string; id?: string; message?: string; read?: boolean; read_at?: string | null;
          title?: string; type?: string; user_id?: string
        }
        Relationships: []
      },
```

**Step 2: Update the Functions block**

In the `Functions:` section, add the new functions after `finalize_donation`:

```typescript
      has_role: { Args: { _role: Database["public"]["Enums"]["user_role"]; _user_id: string }; Returns: boolean }
      get_my_role: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["user_role"] }
      approve_charity_application: { Args: { _application_id: string; _notes?: string | null; _reviewer_id: string }; Returns: string }
      reject_charity_application: { Args: { _application_id: string; _reason: string; _reviewer_id: string }; Returns: undefined }
      request_more_info: { Args: { _application_id: string; _notes: string; _reviewer_id: string }; Returns: undefined }
      certify_campaign: { Args: { _admin_id: string; _campaign_id: string }; Returns: undefined }
      remove_campaign_certification: { Args: { _admin_id: string; _campaign_id: string; _reason: string }; Returns: undefined }
      publish_campaign: { Args: { _admin_id: string; _campaign_id: string }; Returns: undefined }
      reject_campaign: { Args: { _admin_id: string; _campaign_id: string; _reason: string }; Returns: undefined }
      suspend_campaign: { Args: { _admin_id: string; _campaign_id: string; _reason: string }; Returns: undefined }
      reactivate_campaign: { Args: { _admin_id: string; _campaign_id: string }; Returns: undefined }
      request_payout: { Args: { _amount: number; _charity_group_id: string; _currency: string; _destination: Json }; Returns: string }
      approve_payout: { Args: { _admin_id: string; _payout_id: string }; Returns: undefined }
      reject_payout: { Args: { _admin_id: string; _payout_id: string; _reason: string }; Returns: undefined }
      mark_payout_paid: { Args: { _admin_id: string; _external_reference: string; _payout_id: string }; Returns: undefined }
      get_charity_balances: { Args: { _charity_group_id: string }; Returns: Json }
```

**Step 3: Update the Enums block**

Replace `Enums: { [_ in never]: never; }` with:

```typescript
    Enums: {
      user_role: "user" | "charity_group" | "admin"
      charity_status: "pending" | "under_review" | "approved" | "rejected" | "more_info_required" | "suspended"
      app_status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "more_info_required" | "suspended"
      campaign_status: "draft" | "submitted" | "published" | "paused" | "completed" | "rejected" | "suspended" | "archived"
      payout_status: "pending" | "under_review" | "approved" | "processing" | "paid" | "rejected" | "failed"
      ledger_type: "donation" | "payment_fee" | "platform_fee" | "refund" | "payout" | "payout_fee" | "adjustment"
      audit_action: "approve_charity" | "reject_charity" | "suspend_charity" | "approve_campaign" | "reject_campaign" | "certify_campaign" | "remove_certification" | "suspend_campaign" | "approve_payout" | "reject_payout" | "mark_payout_paid" | "suspend_user" | "reactivate_user" | "view_charity_document"
    },
```

**Step 4: Update the Constants block**

Replace `public: { Enums: {} },` with:

```typescript
  public: {
    Enums: {
      user_role: ["user", "charity_group", "admin"],
      charity_status: ["pending", "under_review", "approved", "rejected", "more_info_required", "suspended"],
      app_status: ["draft", "submitted", "under_review", "approved", "rejected", "more_info_required", "suspended"],
      campaign_status: ["draft", "submitted", "published", "paused", "completed", "rejected", "suspended", "archived"],
      payout_status: ["pending", "under_review", "approved", "processing", "paid", "rejected", "failed"],
      ledger_type: ["donation", "payment_fee", "platform_fee", "refund", "payout", "payout_fee", "adjustment"],
      audit_action: ["approve_charity", "reject_charity", "suspend_charity", "approve_campaign", "reject_campaign", "certify_campaign", "remove_certification", "suspend_campaign", "approve_payout", "reject_payout", "mark_payout_paid", "suspend_user", "reactivate_user", "view_charity_document"],
    },
  },
```

**Step 5: Run TypeScript compile**

```bash
npx tsc --noEmit
```

Expected: errors specific to existing code that referenced the old `status: string` type on `campaigns` (it is now the `campaign_status` enum). These are valid errors that downstream code will surface. **For Part 1, the expected outcome is no errors point at `types.ts` itself.** Confirm by checking that no errors mention `src/integrations/supabase/types.ts`.

**Step 6: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "feat(types): add 8 new tables, enums, and RPC signatures"
```

---

## Task 1.12: Manual admin grant + Part 1 smoke test

**Files:** none. Run the manual grant and the Part 1 checklist.

**Step 1: Grant yourself the admin role**

In the Supabase dashboard → SQL Editor, run:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<your-auth-uid>', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

Replace `<your-auth-uid>` with your actual user ID from Authentication → Users.

**Step 2: Run the full Part 1 verification**

Confirm each of these by running the SQL and checking the output:

```sql
-- 1. All 8 new tables exist
SELECT count(*) FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN
    ('user_roles', 'charity_groups', 'charity_applications', 'charity_documents',
     'payouts', 'ledger_entries', 'audit_logs', 'notifications');
-- Expected: 8

-- 2. All enums exist
SELECT count(*) FROM pg_type WHERE typname IN
  ('user_role', 'charity_status', 'app_status', 'campaign_status',
   'payout_status', 'ledger_type', 'audit_action');
-- Expected: 7

-- 3. has_role works
SELECT public.has_role('<your-uid>', 'admin');
-- Expected: true

SELECT public.has_role('00000000-0000-0000-0000-000000000000', 'admin');
-- Expected: false

-- 4. get_charity_balances returns a jsonb
SELECT public.get_charity_balances('00000000-0000-0000-0000-000000000000');
-- Expected: a jsonb with zeros

-- 5. The append-only trigger blocks DELETE
INSERT INTO public.audit_logs (admin_id, action, target_type, target_id)
  VALUES ('<your-uid>', 'approve_charity', 'smoke', 'smoke');
DELETE FROM public.audit_logs WHERE target_type = 'smoke';
-- Expected: DELETE fails with "audit_logs is append-only"

-- 6. Storage buckets exist
SELECT id, public FROM storage.buckets
  WHERE id IN ('charity-documents', 'campaign-images');
-- Expected: 2 rows, both public=false
```

Clean up the smoke-test audit row:

```sql
TRUNCATE public.audit_logs;
```

**Step 3: Confirm Part 1 done**

Reply "Part 1 done, proceed to Part 2" to continue. The plan will pause for your confirmation per the spec's six-stop-points rule.

---

# Part 2 — Auth & application

Files added: 6 (4 new TS/TSX, 1 modified header, 0 SQL). Touches `site-header.tsx` to add the role-aware nav link. Verification is `npx tsc --noEmit` + a smoke test in the dev server.

---

## Task 2.1: Wilaya select component + storage path helpers

**Files:**
- Create: `src/components/hamla/wilaya-select.tsx`
- Create: `src/lib/storage-paths.ts`

**Step 1: Write the wilaya list**

`src/components/hamla/wilaya-select.tsx`:

```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WILAYAS: ReadonlyArray<{ code: string; name: string }> = [
  { code: "01", name: "أدرار" }, { code: "02", name: "الشلف" }, { code: "03", name: "الأغواط" },
  { code: "04", name: "أم البواقي" }, { code: "05", name: "باتنة" }, { code: "06", name: "بجاية" },
  { code: "07", name: "بسكرة" }, { code: "08", name: "بشار" }, { code: "09", name: "البليدة" },
  { code: "10", name: "البويرة" }, { code: "11", name: "تمنراست" }, { code: "12", name: "تبسة" },
  { code: "13", name: "تلمسان" }, { code: "14", name: "تيارت" }, { code: "15", name: "تيزي وزو" },
  { code: "16", name: "الجزائر" }, { code: "17", name: "الجلفة" }, { code: "18", name: "جيجل" },
  { code: "19", name: "سطيف" }, { code: "20", name: "سعيدة" }, { code: "21", name: "سكيكدة" },
  { code: "22", name: "سيدي بلعباس" }, { code: "23", name: "عنابة" }, { code: "24", name: "قالمة" },
  { code: "25", name: "قسنطينة" }, { code: "26", name: "المدية" }, { code: "27", name: "مستغانم" },
  { code: "28", name: "المسيلة" }, { code: "29", name: "معسكر" }, { code: "30", name: "ورقلة" },
  { code: "31", name: "وهران" }, { code: "32", name: "البيض" }, { code: "33", name: "إليزي" },
  { code: "34", name: "برج بوعريريج" }, { code: "35", name: "بومرداس" }, { code: "36", name: "الطارف" },
  { code: "37", name: "تندوف" }, { code: "38", name: "تيسمسيلت" }, { code: "39", name: "الوادي" },
  { code: "40", name: "خنشلة" }, { code: "41", name: "سوق أهراس" }, { code: "42", name: "تيبازة" },
  { code: "43", name: "ميلة" }, { code: "44", name: "عين الدفلى" }, { code: "45", name: "النعامة" },
  { code: "46", name: "عين تموشنت" }, { code: "47", name: "غرداية" }, { code: "48", name: "غليزان" },
  { code: "49", name: "تيميمون" }, { code: "50", name: "برج باجي مختار" }, { code: "51", name: "أولاد جلال" },
  { code: "52", name: "بني عباس" }, { code: "53", name: "عين صالح" }, { code: "54", name: "عين قزام" },
  { code: "55", name: "تقرت" }, { code: "56", name: "جانت" }, { code: "57", name: "المغير" },
  { code: "58", name: "المنيعة" }
];

export function WilayaSelect({
  value,
  onChange,
  name,
  required,
  id,
}: {
  value?: string;
  onChange: (v: string) => void;
  name?: string;
  required?: boolean;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} name={name} required={required}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="اختر الولاية" />
      </SelectTrigger>
      <SelectContent>
        {WILAYAS.map((w) => (
          <SelectItem key={w.code} value={w.name}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function getWilayaName(code: string): string | undefined {
  return WILAYAS.find((w) => w.code === code)?.name;
}
```

**Step 2: Write the storage path helpers**

`src/lib/storage-paths.ts`:

```typescript
/**
 * Storage path conventions for HAMLA's private buckets.
 *
 * charity-documents bucket:
 *   applications/{user_id}/{application_id}/{uuid}.{ext}
 *
 * campaign-images bucket:
 *   campaigns/{charity_group_id}/{uuid}.{ext}
 *
 * These helpers produce and parse these paths. They are used by both the
 * client (for the upload) and the server (for re-validation). Keep them in
 * sync with the RLS policies in supabase/migrations/20260829000001_storage_buckets.sql.
 */

import { randomUUID } from "node:crypto";

export const CHARITY_DOCUMENTS_BUCKET = "charity-documents";
export const CAMPAIGN_IMAGES_BUCKET = "campaign-images";

export function buildCharityDocumentPath(
  userId: string,
  applicationId: string,
  originalFilename: string,
): string {
  const ext = extensionFromFilename(originalFilename);
  return `applications/${userId}/${applicationId}/${randomUUID()}${ext}`;
}

export function buildCampaignImagePath(
  charityGroupId: string,
  originalFilename: string,
): string {
  const ext = extensionFromFilename(originalFilename);
  return `campaigns/${charityGroupId}/${randomUUID()}${ext}`;
}

export function extensionFromFilename(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot < 0 || lastDot === filename.length - 1) return "";
  return filename.slice(lastDot).toLowerCase();
}

export const ALLOWED_DOCUMENT_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
```

**Step 3: Commit**

```bash
git add src/components/hamla/wilaya-select.tsx src/lib/storage-paths.ts
git commit -m "feat(part2): wilaya select component and storage path helpers"
```

---

## Task 2.2: File uploader component

**Files:**
- Create: `src/components/hamla/file-uploader.tsx`

**Step 1: Write the file uploader**

`src/components/hamla/file-uploader.tsx`:

```typescript
import { useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UploadedFile {
  file: File;
  previewUrl: string | null;
}

export function FileUploader({
  accept,
  maxBytes,
  maxFiles,
  onChange,
  value,
  allowedMimeLabel = "PDF أو صور (JPG, PNG)",
}: {
  accept: string;
  maxBytes: number;
  maxFiles: number;
  onChange: (files: UploadedFile[]) => void;
  value: UploadedFile[];
  allowedMimeLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...value];
    for (const f of Array.from(list)) {
      if (next.length >= maxFiles) {
        setError(`الحد الأقصى ${maxFiles} ملفات.`);
        break;
      }
      if (f.size > maxBytes) {
        setError(`الملف "${f.name}" يتجاوز الحد المسموح (${Math.round(maxBytes / 1024 / 1024)} ميغابايت).`);
        continue;
      }
      if (!accept.split(",").some((t) => f.type === t.trim())) {
        setError(`نوع الملف "${f.name}" غير مسموح. الأنواع المسموحة: ${allowedMimeLabel}.`);
        continue;
      }
      next.push({ file: f, previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null });
    }
    onChange(next);
  }

  function remove(idx: number) {
    const next = value.slice();
    const removed = next.splice(idx, 1)[0];
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    onChange(next);
    setError(null);
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl border-2 border-dashed border-border bg-secondary/40 p-6 text-center"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="mx-auto size-6 text-subtle-foreground" />
        <p className="mt-2 text-sm text-foreground">اسحب الملفات هنا أو</p>
        <p className="text-xs text-subtle-foreground">
          {allowedMimeLabel} — حد أقصى {Math.round(maxBytes / 1024 / 1024)} ميغابايت لكل ملف
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => inputRef.current?.click()}
        >
          اختر ملفاً
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {value.length > 0 ? (
        <ul className="space-y-2">
          {value.map((uf, idx) => (
            <li
              key={`${uf.file.name}-${idx}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                {uf.file.type.startsWith("image/") ? (
                  <ImageIcon className="size-4 shrink-0 text-subtle-foreground" />
                ) : (
                  <FileText className="size-4 shrink-0 text-subtle-foreground" />
                )}
                <span className="truncate">{uf.file.name}</span>
                <span className="shrink-0 text-xs text-subtle-foreground">
                  {Math.round(uf.file.size / 1024)} KB
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => remove(idx)}
                aria-label="إزالة"
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/hamla/file-uploader.tsx
git commit -m "feat(part2): drag-and-drop file uploader with size and MIME validation"
```

---

## Task 2.3: useRole hook + getMyRole server-fn

**Files:**
- Create: `src/lib/auth.functions.ts`
- Create: `src/hooks/use-role.ts`

**Step 1: Write the server function**

`src/lib/auth.functions.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "user" | "charity_group" | "admin";

/**
 * Returns the role of the currently authenticated user.
 *
 * This is the ONLY role-exposing RPC for authenticated users. UI components
 * read this via the useRole() hook to render role-aware navigation. The
 * security-definer admin functions in the database use has_role() server-side.
 */
export const getMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data, error } = await supabase.rpc("get_my_role");
    if (error) {
      // get_my_role returns the first row for auth.uid(). If no row exists,
      // the user has no role yet — treat as 'user' (the default).
      return { role: "user" as AppRole };
    }
    const role = (data ?? "user") as AppRole;
    return { role };
  });
```

**Step 2: Write the hook**

`src/hooks/use-role.ts`:

```typescript
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole, type AppRole } from "@/lib/auth.functions";

export type RoleState =
  | { status: "loading"; role: null }
  | { status: "ready"; role: AppRole }
  | { status: "anonymous"; role: null };

export function useRole(): RoleState {
  const fetchRole = useServerFn(getMyRole);
  const [state, setState] = useState<RoleState>({ status: "loading", role: null });

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setState({ status: "anonymous", role: null });
        return;
      }
      fetchRole({ data: undefined })
        .then((res) => {
          if (!active) return;
          setState({ status: "ready", role: res.role });
        })
        .catch(() => {
          if (!active) return;
          setState({ status: "ready", role: "user" });
        });
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        setState({ status: "anonymous", role: null });
        return;
      }
      fetchRole({ data: undefined })
        .then((res) => {
          if (!active) return;
          setState({ status: "ready", role: res.role });
        })
        .catch(() => {
          if (!active) return;
          setState({ status: "ready", role: "user" });
        });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchRole]);

  return state;
}
```

**Step 3: Commit**

```bash
git add src/lib/auth.functions.ts src/hooks/use-role.ts
git commit -m "feat(part2): useRole hook and getMyRole server function"
```

---

## Task 2.4: Charity application server-fn

**Files:**
- Create: `src/lib/charity-applications.server.ts`

**Step 1: Write the server function**

`src/lib/charity-applications.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  ALLOWED_DOCUMENT_MIME,
  CHARITY_DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  buildCharityDocumentPath,
} from "@/lib/storage-paths";

const ALGERIAN_PHONE = /^(0)(5|6|7)[0-9]{8}$/;

const WILAYA_VALUES = [
  "أدرار","الشلف","الأغواط","أم البواقي","باتنة","بجاية","بسكرة","بشار","البليدة","البويرة",
  "تمنراست","تبسة","تلمسان","تيارت","تيزي وزو","الجزائر","الجلفة","جيجل","سطيف","سعيدة",
  "سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة","المدية","مستغانم","المسيلة","معسكر","ورقلة",
  "وهران","البيض","إليزي","برج بوعريريج","بومرداس","الطارف","تندوف","تيسمسيلت","الوادي","خنشلة",
  "سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة","عين تموشنت","غرداية","غليزان","تيميمون",
  "برج باجي مختار","أولاد جلال","بني عباس","عين صالح","عين قزام","تقرت","جانت","المغير","المنيعة",
] as const;

const categoryValues = ["education", "health", "family", "emergency", "orphan", "mosque", "other"] as const;

const documentInput = z.object({
  storagePath: z.string().min(8).max(500),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  originalFilename: z.string().min(1).max(200),
  type: z.string().min(1).max(50),
});

const applicationInput = z.object({
  orgName: z.string().min(3).max(120),
  orgNameAr: z.string().min(3).max(120),
  orgDescription: z.string().min(50).max(1000),
  orgCategory: z.enum(categoryValues),
  orgWilaya: z.enum(WILAYA_VALUES),
  orgCommune: z.string().min(2).max(80),
  orgAddress: z.string().min(5).max(200),
  orgPhone: z.string().regex(ALGERIAN_PHONE, "رقم الهاتف غير صالح"),
  orgEmail: z.string().email(),
  orgWebsite: z.string().url().max(200).optional().nullable(),
  repName: z.string().min(2).max(80),
  repPhone: z.string().regex(ALGERIAN_PHONE, "رقم الهاتف غير صالح"),
  repEmail: z.string().email(),
  registrationNumber: z.string().min(3).max(40),
  registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  documents: z.array(documentInput).min(1).max(10),
});

/**
 * Server-side re-validation of a charity application.
 *
 * The flow:
 *  1. The client uploads each file to the private `charity-documents` bucket
 *     at path `applications/{user_id}/draft/{uuid}.{ext}`.
 *  2. The client posts the form + the list of uploaded paths here.
 *  3. We re-validate the file: re-read the storage object's metadata, check
 *     size, MIME, that the path actually exists. We NEVER trust the client.
 *  4. We insert the charity_applications row with status='submitted'.
 *  5. We insert the charity_documents rows.
 *  6. We rename the storage objects from `draft/` to `{application_id}/`.
 *  7. We notify all admins.
 */
export const submitCharityApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => applicationInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const db = supabaseAdmin;

    // Reject if the user already has an approved application.
    const { data: existingApproved } = await db
      .from("charity_applications")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "approved")
      .maybeSingle();
    if (existingApproved) {
      throw new Error("لديك بالفعل طلب جمعية مقبول.");
    }

    // Re-validate every uploaded file by reading its storage metadata.
    for (const doc of data.documents) {
      // Ensure the path is under the user's draft folder.
      const expectedPrefix = `applications/${userId}/draft/`;
      if (!doc.storagePath.startsWith(expectedPrefix)) {
        throw new Error("مسار ملف غير صالح.");
      }
      if (!ALLOWED_DOCUMENT_MIME.has(doc.mimeType)) {
        throw new Error("نوع ملف غير مسموح.");
      }
      if (doc.sizeBytes > MAX_DOCUMENT_BYTES) {
        throw new Error("حجم الملف يتجاوز الحد المسموح.");
      }
      // Probe the object by attempting to copy it to a temp name; if it
      // doesn't exist, supabase will return an error.
      const { error: probeError } = await db.storage
        .from(CHARITY_DOCUMENTS_BUCKET)
        .copy(doc.storagePath, `applications/${userId}/_probe/${Date.now()}`);
      if (probeError) {
        throw new Error("تعذر التحقق من أحد الملفات المرفوعة.");
      }
      // Move the probe to avoid leaving it behind; also acts as a write test.
      await db.storage
        .from(CHARITY_DOCUMENTS_BUCKET)
        .remove([`applications/${userId}/_probe/${Date.now()}`]);
    }

    // Insert the application.
    const { data: application, error: appError } = await db
      .from("charity_applications")
      .insert({
        user_id: userId,
        status: "submitted",
        org_name: data.orgName,
        org_name_ar: data.orgNameAr,
        org_description: data.orgDescription,
        org_category: data.orgCategory,
        org_wilaya: data.orgWilaya,
        org_commune: data.orgCommune,
        org_address: data.orgAddress,
        org_phone: data.orgPhone,
        org_email: data.orgEmail,
        org_website: data.orgWebsite ?? null,
        rep_name: data.repName,
        rep_phone: data.repPhone,
        rep_email: data.repEmail,
        registration_number: data.registrationNumber,
        registration_date: data.registrationDate,
      })
      .select("id")
      .single();
    if (appError || !application) {
      throw new Error("تعذر إنشاء طلب الجمعية. حاول مرة أخرى.");
    }

    // Insert document rows + move storage objects out of /draft/ into /{application_id}/.
    const docRows = data.documents.map((d) => ({
      charity_application_id: application.id,
      type: d.type,
      storage_path: d.storagePath,
      mime_type: d.mimeType,
      size_bytes: d.sizeBytes,
      original_filename: d.originalFilename,
    }));
    const { error: docsError } = await db.from("charity_documents").insert(docRows);
    if (docsError) {
      throw new Error("تعذر تسجيل الوثائق. حاول مرة أخرى.");
    }

    for (const d of data.documents) {
      const ext = d.storagePath.slice(d.storagePath.lastIndexOf("."));
      const newPath = `applications/${userId}/${application.id}/${crypto.randomUUID()}${ext}`;
      const { error: moveError } = await db.storage
        .from(CHARITY_DOCUMENTS_BUCKET)
        .move(d.storagePath, newPath);
      if (moveError) {
        // Non-fatal: the document row still references the old path. The
        // admin can still resolve it by ID. Log and continue.
        console.error("storage move failed", moveError);
        continue;
      }
      await db
        .from("charity_documents")
        .update({ storage_path: newPath })
        .eq("charity_application_id", application.id)
        .eq("storage_path", d.storagePath);
    }

    // Notify all admins.
    const { data: admins } = await db.from("user_roles").select("user_id").eq("role", "admin");
    if (admins && admins.length > 0) {
      await db.from("notifications").insert(
        admins.map((a) => ({
          user_id: a.user_id,
          type: "charity_application_submitted",
          title: "طلب جمعية جديد",
          message: `قدم "${data.orgNameAr}" طلبًا للحصول على صفة جمعية خيرية.`,
        })),
      );
    }

    return { applicationId: application.id };
  });
```

**Step 2: Commit**

```bash
git add src/lib/charity-applications.server.ts
git commit -m "feat(part2): submitCharityApplication server-fn with file re-validation"
```

---

## Task 2.5: Public application form route /become-a-charity

**Files:**
- Create: `src/routes/become-a-charity.tsx`

**Step 1: Write the form route**

`src/routes/become-a-charity.tsx`:

```typescript
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { FileUploader, type UploadedFile } from "@/components/hamla/file-uploader";
import { WilayaSelect } from "@/components/hamla/wilaya-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  ALLOWED_DOCUMENT_MIME,
  CHARITY_DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  buildCharityDocumentPath,
} from "@/lib/storage-paths";
import { supabase } from "@/integrations/supabase/client";
import { submitCharityApplication } from "@/lib/charity-applications.server";

export const Route = createFileRoute("/become-a-charity")({
  head: () => ({
    meta: [
      { title: "طلب صفة جمعية خيرية | حملة" },
      { name: "description", content: "قدّم طلبك للحصول على صفة جمعية خيرية على منصة حملة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BecomeACharityPage,
});

const formSchema = z.object({
  orgName: z.string().min(3, "الاسم قصير جداً"),
  orgNameAr: z.string().min(3, "الاسم بالعربية قصير جداً"),
  orgDescription: z.string().min(50, "الوصف يجب أن يكون 50 حرفاً على الأقل").max(1000),
  orgCategory: z.enum(["education", "health", "family", "emergency", "orphan", "mosque", "other"]),
  orgWilaya: z.string().min(1, "اختر الولاية"),
  orgCommune: z.string().min(2, "أدخل البلدية"),
  orgAddress: z.string().min(5, "أدخل العنوان"),
  orgPhone: z.string().regex(/^(0)(5|6|7)[0-9]{8}$/, "رقم الهاتف غير صالح"),
  orgEmail: z.string().email("بريد إلكتروني غير صالح"),
  orgWebsite: z.string().url("رابط غير صالح").or(z.literal("")).optional(),
  repName: z.string().min(2, "أدخل اسم الممثل"),
  repPhone: z.string().regex(/^(0)(5|6|7)[0-9]{8}$/, "رقم الهاتف غير صالح"),
  repEmail: z.string().email("بريد إلكتروني غير صالح"),
  registrationNumber: z.string().min(3, "أدخل رقم التسجيل"),
  registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
});

type FormValues = z.infer<typeof formSchema>;

const categoryLabels: Record<FormValues["orgCategory"], string> = {
  education: "تعليم",
  health: "صحة",
  family: "أسر وعائلات",
  emergency: "طوارئ",
  orphan: "أيتام",
  mosque: "مساجد ودور عبادة",
  other: "أخرى",
};

function BecomeACharityPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const submit = useServerFn(submitCharityApplication);
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const { register, handleSubmit, formState, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orgName: "",
      orgNameAr: "",
      orgDescription: "",
      orgCategory: "other",
      orgWilaya: "",
      orgCommune: "",
      orgAddress: "",
      orgPhone: "",
      orgEmail: "",
      orgWebsite: "",
      repName: "",
      repPhone: "",
      repEmail: "",
      registrationNumber: "",
      registrationDate: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user) throw new Error("يجب تسجيل الدخول.");
      if (files.length === 0) throw new Error("يرجى رفع وثيقة واحدة على الأقل.");

      // Upload each file to the private bucket at the draft path.
      const uploadedPaths: { storagePath: string; mimeType: string; sizeBytes: number; originalFilename: string; type: string }[] = [];
      for (const uf of files) {
        const path = `applications/${user.id}/draft/${crypto.randomUUID()}`;
        const { error: uploadError } = await supabase.storage
          .from(CHARITY_DOCUMENTS_BUCKET)
          .upload(path, uf.file, {
            contentType: uf.file.type,
            upsert: false,
          });
        if (uploadError) {
          throw new Error(`تعذر رفع الملف "${uf.file.name}": ${uploadError.message}`);
        }
        uploadedPaths.push({
          storagePath: path,
          mimeType: uf.file.type,
          sizeBytes: uf.file.size,
          originalFilename: uf.file.name,
          type: "registration_certificate",
        });
      }

      // Submit the application with the uploaded paths.
      return submit({
        data: {
          orgName: values.orgName,
          orgNameAr: values.orgNameAr,
          orgDescription: values.orgDescription,
          orgCategory: values.orgCategory,
          orgWilaya: values.orgWilaya,
          orgCommune: values.orgCommune,
          orgAddress: values.orgAddress,
          orgPhone: values.orgPhone,
          orgEmail: values.orgEmail,
          orgWebsite: values.orgWebsite || null,
          repName: values.repName,
          repPhone: values.repPhone,
          repEmail: values.repEmail,
          registrationNumber: values.registrationNumber,
          registrationDate: values.registrationDate,
          documents: uploadedPaths,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم استلام طلبك. سيتم مراجعته من قبل فريق حملة.");
      queryClient.invalidateQueries({ queryKey: ["my-charity-application"] });
      void navigate({ to: "/my-charity-application" });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <Loader2 className="mx-auto size-8 animate-spin text-primary" />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">سجّل الدخول للمتابعة</h1>
          <p className="mt-2 text-sm text-subtle-foreground">
            يجب أن يكون لديك حساب على حملة لتقديم طلب الحصول على صفة جمعية.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">العودة إلى الرئيسية</Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (submitMutation.isSuccess) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-16">
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <CheckCircle2 className="mx-auto size-12 text-primary-strong" />
            <h1 className="mt-4 text-xl font-bold">تم استلام طلبك</h1>
            <p className="mt-2 text-sm text-subtle-foreground">
              طلبك قيد المراجعة. سنخطرك فور اتخاذ القرار.
            </p>
            <Button asChild className="mt-6">
              <Link to="/my-charity-application">عرض حالة الطلب</Link>
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-subtle-foreground hover:text-foreground">
          <ChevronLeft className="size-4" />
          العودة
        </Link>

        <h1 className="mt-4 text-2xl font-bold">طلب صفة جمعية خيرية</h1>
        <p className="mt-2 text-sm text-subtle-foreground">
          املأ المعلومات التالية وأرفق الوثائق الرسمية لجمعيتك. سيتم مراجعة طلبك من قبل فريق حملة.
        </p>

        <form onSubmit={handleSubmit((v) => submitMutation.mutate(v))} className="mt-8 space-y-8">
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">معلومات الجمعية</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="orgName">اسم الجمعية (بالفرنسية أو الإنجليزية)</Label>
                <Input id="orgName" {...register("orgName")} />
                {formState.errors.orgName ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgName.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="orgNameAr">اسم الجمعية (بالعربية)</Label>
                <Input id="orgNameAr" {...register("orgNameAr")} />
                {formState.errors.orgNameAr ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgNameAr.message}</p> : null}
              </div>
            </div>
            <div>
              <Label htmlFor="orgDescription">وصف الجمعية</Label>
              <Textarea id="orgDescription" rows={4} {...register("orgDescription")} />
              {formState.errors.orgDescription ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgDescription.message}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="orgCategory">الفئة</Label>
                <select
                  id="orgCategory"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("orgCategory")}
                >
                  {Object.entries(categoryLabels).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="orgWilaya">الولاية</Label>
                <WilayaSelect
                  id="orgWilaya"
                  value={watch("orgWilaya")}
                  onChange={(v) => setValue("orgWilaya", v, { shouldValidate: true })}
                />
                {formState.errors.orgWilaya ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgWilaya.message}</p> : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="orgCommune">البلدية</Label>
                <Input id="orgCommune" {...register("orgCommune")} />
                {formState.errors.orgCommune ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgCommune.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="orgAddress">العنوان</Label>
                <Input id="orgAddress" {...register("orgAddress")} />
                {formState.errors.orgAddress ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgAddress.message}</p> : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="orgPhone">هاتف الجمعية</Label>
                <Input id="orgPhone" inputMode="tel" {...register("orgPhone")} />
                {formState.errors.orgPhone ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgPhone.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="orgEmail">البريد الإلكتروني الرسمي</Label>
                <Input id="orgEmail" type="email" {...register("orgEmail")} />
                {formState.errors.orgEmail ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgEmail.message}</p> : null}
              </div>
            </div>
            <div>
              <Label htmlFor="orgWebsite">الموقع الإلكتروني أو صفحات التواصل (اختياري)</Label>
              <Input id="orgWebsite" type="url" {...register("orgWebsite")} />
              {formState.errors.orgWebsite ? <p className="mt-1 text-xs text-destructive">{formState.errors.orgWebsite.message}</p> : null}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">ممثل الجمعية</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="repName">الاسم الكامل</Label>
                <Input id="repName" {...register("repName")} />
                {formState.errors.repName ? <p className="mt-1 text-xs text-destructive">{formState.errors.repName.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="repPhone">الهاتف</Label>
                <Input id="repPhone" inputMode="tel" {...register("repPhone")} />
                {formState.errors.repPhone ? <p className="mt-1 text-xs text-destructive">{formState.errors.repPhone.message}</p> : null}
              </div>
            </div>
            <div>
              <Label htmlFor="repEmail">البريد الإلكتروني</Label>
              <Input id="repEmail" type="email" {...register("repEmail")} />
              {formState.errors.repEmail ? <p className="mt-1 text-xs text-destructive">{formState.errors.repEmail.message}</p> : null}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">المعلومات القانونية</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="registrationNumber">رقم التسجيل الرسمي</Label>
                <Input id="registrationNumber" {...register("registrationNumber")} />
                {formState.errors.registrationNumber ? <p className="mt-1 text-xs text-destructive">{formState.errors.registrationNumber.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="registrationDate">تاريخ التسجيل</Label>
                <Input id="registrationDate" type="date" {...register("registrationDate")} />
                {formState.errors.registrationDate ? <p className="mt-1 text-xs text-destructive">{formState.errors.registrationDate.message}</p> : null}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">الوثائق الرسمية</legend>
            <p className="text-sm text-subtle-foreground">
              شهادة التسجيل، الاعتماد الرسمي، أو أي وثائق أخرى تثبت هوية الجمعية. PDF أو صور (JPG, PNG) حتى 10 ميغابايت لكل ملف.
            </p>
            <FileUploader
              accept={Array.from(ALLOWED_DOCUMENT_MIME).join(",")}
              maxBytes={MAX_DOCUMENT_BYTES}
              maxFiles={10}
              value={files}
              onChange={setFiles}
            />
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/">إلغاء</Link>
            </Button>
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              إرسال الطلب
            </Button>
          </div>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/routes/become-a-charity.tsx
git commit -m "feat(part2): public application form at /become-a-charity"
```

---

## Task 2.6: My application status route /my-charity-application

**Files:**
- Create: `src/routes/my-charity-application.tsx`

**Step 1: Add a status-page server function to charity-applications.server.ts**

Open `src/lib/charity-applications.server.ts` and append at the bottom:

```typescript
const statusInput = z.object({});

/**
 * Returns the latest charity application submitted by the current user, with
 * admin notes and a localized status label.
 */
export const getMyCharityApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => statusInput.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { data: app } = await supabaseAdmin
      .from("charity_applications")
      .select(
        "id, status, admin_notes, submitted_at, reviewed_at, org_name_ar",
      )
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return app ?? null;
  });
```

**Step 2: Write the route**

`src/routes/my-charity-application.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useQuery as useRQ } from "@tanstack/react-query";
import { CheckCircle2, Clock, FileText, Loader2, XCircle } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getMyCharityApplication } from "@/lib/charity-applications.server";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/my-charity-application")({
  head: () => ({
    meta: [
      { title: "حالة طلب الجمعية | حملة" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyCharityApplicationPage,
});

const statusLabels: Record<string, { label: string; tone: "info" | "ok" | "warn" | "err" }> = {
  submitted: { label: "تم الاستلام — قيد المراجعة", tone: "info" },
  under_review: { label: "قيد المراجعة", tone: "info" },
  approved: { label: "تمت الموافقة", tone: "ok" },
  rejected: { label: "مرفوض", tone: "err" },
  more_info_required: { label: "مطلوب معلومات إضافية", tone: "warn" },
  suspended: { label: "موقوف", tone: "err" },
};

function MyCharityApplicationPage() {
  const { user, loading } = useAuth();
  const fetchApp = useServerFn(getMyCharityApplication);

  const query = useRQ({
    queryKey: ["my-charity-application"],
    queryFn: () => fetchApp({ data: {} }),
    enabled: Boolean(user),
  });

  const data = query.data;
  const meta = data ? statusLabels[data.status] ?? { label: data.status, tone: "info" } : null;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold">حالة طلب الجمعية</h1>

        {loading || (query.isPending && Boolean(user)) ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : !user ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold">سجّل الدخول لعرض حالة طلبك</h2>
            <Button asChild className="mt-4">
              <Link to="/">العودة إلى الرئيسية</Link>
            </Button>
          </div>
        ) : !data ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
            <FileText className="mx-auto size-10 text-subtle-foreground" />
            <h2 className="mt-4 text-lg font-semibold">لم تقدم طلباً بعد</h2>
            <p className="mt-2 text-sm text-subtle-foreground">
              قدّم طلبك للحصول على صفة جمعية خيرية لتبدأ حملاتك على منصة حملة.
            </p>
            <Button asChild className="mt-6">
              <Link to="/become-a-charity">قدّم طلباً</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-subtle-foreground">اسم الجمعية</p>
                  <p className="font-semibold">{data.org_name_ar}</p>
                </div>
                <div className="flex items-center gap-2">
                  {meta?.tone === "ok" ? (
                    <CheckCircle2 className="size-5 text-primary-strong" />
                  ) : meta?.tone === "err" ? (
                    <XCircle className="size-5 text-destructive" />
                  ) : (
                    <Clock className="size-5 text-highlight" />
                  )}
                  <span className="text-sm font-medium">{meta?.label}</span>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-subtle-foreground">تاريخ التقديم</dt>
                  <dd>{formatDate(data.submitted_at)}</dd>
                </div>
                {data.reviewed_at ? (
                  <div className="flex justify-between">
                    <dt className="text-subtle-foreground">تاريخ آخر مراجعة</dt>
                    <dd>{formatDate(data.reviewed_at)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {data.admin_notes ? (
              <div className="rounded-2xl border border-border bg-secondary p-6">
                <h3 className="text-sm font-semibold">ملاحظات فريق حملة</h3>
                <p className="mt-2 text-sm leading-relaxed">{data.admin_notes}</p>
              </div>
            ) : null}

            {data.status === "approved" ? (
              <div className="rounded-2xl border border-primary bg-primary-soft p-6 text-center">
                <p className="text-sm">تمت الموافقة على طلبك. يمكنك الآن استخدام لوحة تحكم الجمعية.</p>
                <Button asChild className="mt-4">
                  <Link to="/charity">الذهاب إلى لوحة التحكم</Link>
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/lib/charity-applications.server.ts src/routes/my-charity-application.tsx
git commit -m "feat(part2): my charity application status page"
```

---

## Task 2.7: Site header role-aware nav links

**Files:**
- Modify: `src/components/hamla/site-header.tsx`

**Step 1: Read the current header**

```bash
cat src/components/hamla/site-header.tsx
```

(do this in your terminal to see the current structure)

**Step 2: Add role-aware links to the header**

Open `src/components/hamla/site-header.tsx` and find the user-menu section (the part that renders when a user is signed in). Add this block above the existing user dropdown menu:

```typescript
import { useRole } from "@/hooks/use-role";
import { Link } from "@tanstack/react-router";

// inside the component, after useAuth():
const role = useRole();

// inside the JSX, in the visible nav area for signed-in users:
{role.status === "ready" ? (
  role.role === "user" ? (
    <Button asChild variant="ghost" size="sm">
      <Link to="/become-a-charity">طلب صفة جمعية خيرية</Link>
    </Button>
  ) : role.role === "charity_group" ? (
    <Button asChild variant="ghost" size="sm">
      <Link to="/charity">لوحة تحكم الجمعية</Link>
    </Button>
  ) : role.role === "admin" ? (
    <Button asChild variant="ghost" size="sm">
      <Link to="/admin">لوحة الإدارة</Link>
    </Button>
  ) : null
) : null}
```

(Adapt to the exact JSX structure of your header. The key idea: read `useRole()`, render the appropriate link.)

**Step 3: Commit**

```bash
git add src/components/hamla/site-header.tsx
git commit -m "feat(part2): role-aware nav links in site header"
```

---

## Task 2.8: Part 2 smoke test

**Files:** none. You run this.

**Step 1: `npx tsc --noEmit`**

Run from the repo root. Expected errors: any downstream code that uses `campaigns.status` as a string (e.g. `donations.functions.ts`, `campaign.functions.ts`, `routes/index.tsx`) — these are fixed in later parts. If `types.ts` itself has errors, paste them and I fix.

**Step 2: dev server smoke test**

```bash
bun run dev
```

In the browser:

1. Sign in with Google as a fresh user (use a new Google account, or log out first).
2. Confirm a row appears in `public.user_roles` with `role = 'user'`.
3. Navigate to `/become-a-charity`. Fill the form, upload 1 PDF document, submit.
4. Confirm:
   - A new row in `public.charity_applications` with `status = 'submitted'`.
   - A new row in `public.charity_documents` with the correct `storage_path` under `applications/{user_id}/{app_id}/`.
   - The storage object actually exists at that path (check Supabase dashboard → Storage → charity-documents).
   - A new row in `public.notifications` for each admin (you, since you self-granted the admin role).
5. Navigate to `/my-charity-application`. Confirm the submitted status renders in Arabic with the submission date.

When all checks pass, reply **"Part 2 done, proceed to Part 3"** and I will continue with the admin dashboard.

---

**Plan self-review (Part 2):**

- **Spec coverage for Part 2:** every Section 3 commitment is covered by Tasks 2.1–2.8. ✓
- **Placeholder scan:** no "TBD" or "implement later" in Part 2. ✓
- **Type consistency:** `submitCharityApplication` input matches the Zod schema; the documents array shape matches `charity_documents` table columns. ✓
- **Gaps:** none for Part 2.

**Files added/modified in Part 2:**

| Path | New/Modified |
|------|--------------|
| `src/components/hamla/wilaya-select.tsx` | NEW |
| `src/lib/storage-paths.ts` | NEW |
| `src/components/hamla/file-uploader.tsx` | NEW |
| `src/lib/auth.functions.ts` | NEW |
| `src/hooks/use-role.ts` | NEW |
| `src/lib/charity-applications.server.ts` | NEW |
| `src/routes/become-a-charity.tsx` | NEW |
| `src/routes/my-charity-application.tsx` | NEW |
| `src/components/hamla/site-header.tsx` | MODIFIED |

---

# Part 3 — Admin dashboard

Files added: ~22 (mix of route files, server modules, shared components). Touches `__root.tsx` only if the admin layout needs to slot in next to the existing one (it does not — admin lives under `/admin/*` with its own layout route). Verification: `npx tsc --noEmit` + dev-server click-through.

**Critical design points carried over from the spec:**
- Every admin server-fn calls `requireAdmin(userId)` as its **first line**. UI hiding is a courtesy; this is the gate.
- Every state-changing admin action calls `logAdminAction(...)` from `src/lib/server/audit.server.ts`.
- Non-admins hitting any `/admin/*` route get **404**, not 403. We don't confirm the existence of admin routes to non-admins.
- Document download is via a **server redirect** to a 5-minute signed URL; the raw storage path is never returned to the client.
- The audit log is visible to all admins; it is not a secret.

---

## Task 3.1: requireAdmin guard

**Files:**
- Create: `src/lib/server/admin/guard.server.ts`

**Step 1: Write the guard**

`src/lib/server/admin/guard.server.ts`:

```typescript
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server-side admin guard. Call as the FIRST line of every admin server-fn.
 * Throws if the caller is not an admin. Returns the admin user id on success.
 *
 * Non-admin callers see a generic "not found" error so the existence of
 * admin endpoints is not disclosed.
 */
export async function requireAdmin(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) {
    const e: Error & { status?: number } = new Error("Not found");
    e.status = 404;
    throw e;
  }
  return userId;
}
```

**Step 2: Commit**

```bash
git add src/lib/server/admin/guard.server.ts
git commit -m "feat(admin): requireAdmin server guard"
```

---

## Task 3.2: audit log helper

**Files:**
- Create: `src/lib/server/audit.server.ts`

**Step 1: Write the helper**

`src/lib/server/audit.server.ts`:

```typescript
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Writes a single row to public.audit_logs.
 *
 * The audit_logs table is append-only — there is a trigger that raises an
 * exception on UPDATE/DELETE. This helper is the only place application code
 * writes to audit_logs.
 *
 * The action string MUST be one of the audit_action enum values defined in
 * the database migration. The TypeScript type below mirrors the enum.
 */
export type AuditAction =
  | "approve_charity" | "reject_charity" | "suspend_charity"
  | "approve_campaign" | "reject_campaign" | "certify_campaign"
  | "remove_certification" | "suspend_campaign"
  | "approve_payout" | "reject_payout" | "mark_payout_paid"
  | "suspend_user" | "reactivate_user"
  | "view_charity_document";

export async function logAdminAction(params: {
  adminId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    admin_id: params.adminId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    metadata: params.metadata ?? {},
  });
  if (error) {
    // Audit log writes are best-effort. The append-only trigger guarantees
    // the row cannot be modified once written. If the insert itself fails,
    // log to the server console — the calling admin fn should still succeed.
    console.error("[audit] insert failed", error.message, params);
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/server/audit.server.ts
git commit -m "feat(audit): logAdminAction helper"
```

---

## Task 3.3: admin dashboard server-fn (totals)

**Files:**
- Create: `src/lib/server/admin/dashboard.server.ts`

**Step 1: Write the dashboard server-fn**

`src/lib/server/admin/dashboard.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/server/admin/guard.server";

const input = z.object({});

export const getAdminDashboardTotals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const db = supabaseAdmin;

    const [
      { count: totalUsers },
      { count: totalDonors },
      { count: totalCharityGroups },
      { count: totalAdmins },
      { count: pendingApplications },
      { count: approvedCharityGroups },
      { count: totalCampaigns },
      { count: publishedCampaigns },
      { count: certifiedCampaigns },
      { count: submittedCampaigns },
      { count: suspendedCampaigns },
    ] = await Promise.all([
      db.from("user_roles").select("*", { count: "exact", head: true }),
      db.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "user"),
      db.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "charity_group"),
      db.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin"),
      db.from("charity_applications").select("*", { count: "exact", head: true }).eq("status", "submitted"),
      db.from("charity_groups").select("*", { count: "exact", head: true }).eq("verified", true),
      db.from("campaigns").select("*", { count: "exact", head: true }),
      db.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "published"),
      db.from("campaigns").select("*", { count: "exact", head: true }).eq("certified", true),
      db.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "submitted"),
      db.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "suspended"),
    ]);

    const { count: totalDonations, data: paidSum } = await db
      .from("donations")
      .select("amount", { count: "exact" })
      .eq("status", "PAID");
    const totalRaisedDzd = (paidSum ?? []).reduce(
      (acc, r) => acc + Number(r.amount ?? 0),
      0,
    );

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: last24hCount, data: last24hSum } = await db
      .from("donations")
      .select("amount", { count: "exact" })
      .eq("status", "PAID")
      .gte("paid_at", since24h);
    const last24hAmountDzd = (last24hSum ?? []).reduce(
      (acc, r) => acc + Number(r.amount ?? 0),
      0,
    );

    const { count: pendingPayouts } = await db
      .from("payouts")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    const { count: approvedPayouts } = await db
      .from("payouts")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const { count: paidThisMonth, data: paidMonth } = await db
      .from("payouts")
      .select("amount", { count: "exact" })
      .eq("status", "paid")
      .gte("paid_at", startOfMonth.toISOString());
    const totalPaidDzd = (paidMonth ?? []).reduce(
      (acc, r) => acc + Number(r.amount ?? 0),
      0,
    );

    const { data: recentActivity } = await db
      .from("audit_logs")
      .select("id, action, target_type, target_id, metadata, created_at, admin_id")
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      users: {
        total: totalUsers ?? 0,
        donors: totalDonors ?? 0,
        charityGroups: totalCharityGroups ?? 0,
        admins: totalAdmins ?? 0,
      },
      charities: {
        pendingApplications: pendingApplications ?? 0,
        approved: approvedCharityGroups ?? 0,
      },
      campaigns: {
        total: totalCampaigns ?? 0,
        published: publishedCampaigns ?? 0,
        certified: certifiedCampaigns ?? 0,
        submitted: submittedCampaigns ?? 0,
        suspended: suspendedCampaigns ?? 0,
      },
      donations: {
        totalCount: totalDonations ?? 0,
        totalRaisedDzd,
        last24hCount: last24hCount ?? 0,
        last24hAmountDzd,
      },
      payouts: {
        pending: pendingPayouts ?? 0,
        approved: approvedPayouts ?? 0,
        paidThisMonth: paidThisMonth ?? 0,
        totalPaidDzd,
      },
      recentActivity: recentActivity ?? [],
    };
  });
```

**Step 2: Commit**

```bash
git add src/lib/server/admin/dashboard.server.ts
git commit -m "feat(admin): dashboard totals server-fn"
```

---

## Task 3.4: admin layout, sidebar, topbar

**Files:**
- Create: `src/components/hamla/admin-sidebar.tsx`
- Create: `src/components/hamla/admin-topbar.tsx`
- Create: `src/routes/admin.tsx`

**Step 1: Sidebar component**

`src/components/hamla/admin-sidebar.tsx`:

```typescript
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  FileCheck2,
  FileText,
  HandHeart,
  Home,
  ListChecks,
  ScrollText,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HamlaMark } from "@/components/hamla/logo";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ITEMS: NavItem[] = [
  { to: "/admin", label: "الرئيسية", icon: Home },
  { to: "/admin/charities", label: "طلبات الجمعيات", icon: Building2 },
  { to: "/admin/campaigns", label: "الحملات", icon: HandHeart },
  { to: "/admin/payouts", label: "السحوبات", icon: Wallet },
  { to: "/admin/donations", label: "التبرعات", icon: ListChecks },
  { to: "/admin/audit-log", label: "سجل النشاط", icon: ScrollText },
  { to: "/admin/settings", label: "الإعدادات", icon: Settings },
];

export function AdminSidebar() {
  const { location } = useRouterState();
  const pathname = location.pathname;

  return (
    <aside className="hidden w-60 shrink-0 border-l border-border bg-card md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <HamlaMark className="h-7" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">لوحة الإدارة</p>
          <p className="text-[10px] text-subtle-foreground">حملة</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-2 text-sm">
        {ITEMS.map((item) => {
          const active =
            item.to === "/admin"
              ? pathname === "/admin" || pathname === "/admin/"
              : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-foreground/80 transition-colors",
                active ? "bg-primary-soft text-primary-strong" : "hover:bg-accent",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 text-[10px] text-subtle-foreground">
        <p className="flex items-center gap-1">
          <ShieldCheck className="size-3" /> الإصدار 1.0
        </p>
      </div>
    </aside>
  );
}
```

**Step 2: Topbar component**

`src/components/hamla/admin-topbar.tsx`:

```typescript
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth, displayNameOf } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function AdminTopbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  };
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur">
      <div className="text-sm">
        <p className="font-semibold">لوحة إدارة حملة</p>
      </div>
      <div className="flex items-center gap-2">
        {user ? (
          <span className="hidden text-sm text-subtle-foreground sm:inline">
            {displayNameOf(user)}
          </span>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          <LogOut className="size-4" />
          خروج
        </Button>
      </div>
    </header>
  );
}
```

**Step 3: Admin layout route**

`src/routes/admin.tsx`:

```typescript
import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { AdminSidebar } from "@/components/hamla/admin-sidebar";
import { AdminTopbar } from "@/components/hamla/admin-topbar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getAdminDashboardTotals } from "@/lib/server/admin/dashboard.server";
import { getMyRole } from "@/lib/auth.functions";

/**
 * /admin layout. Server-side gate via getMyRole: non-admins get 404.
 */
export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayoutShell,
  notFoundComponent: () => {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">404</h1>
          <p className="mt-1 text-sm text-subtle-foreground">الصفحة غير موجودة</p>
        </div>
      </div>
    );
  },
});

function AdminLayoutShell() {
  const { user, loading: authLoading } = useAuth();
  const fetchRole = useServerFn(getMyRole);
  const fetchTotals = useServerFn(getAdminDashboardTotals);
  const { location } = useRouterState();

  const roleQuery = useQuery({
    queryKey: ["my-role-admin-check"],
    queryFn: () => fetchRole({ data: undefined }),
    enabled: Boolean(user),
  });

  const totalsQuery = useQuery({
    queryKey: ["admin-dashboard-totals"],
    queryFn: () => fetchTotals({ data: {} }),
    enabled: Boolean(user) && roleQuery.data?.role === "admin",
  });

  // Render the layout shell for all /admin/* routes. Children are responsible
  // for their own data loading.
  if (authLoading || (user && roleQuery.isPending)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">404</h1>
          <p className="mt-1 text-sm text-subtle-foreground">الصفحة غير موجودة</p>
        </div>
      </div>
    );
  }

  if (roleQuery.data && roleQuery.data.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">404</h1>
          <p className="mt-1 text-sm text-subtle-foreground">الصفحة غير موجودة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-secondary">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 overflow-x-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/hamla/admin-sidebar.tsx src/components/hamla/admin-topbar.tsx src/routes/admin.tsx
git commit -m "feat(admin): layout shell with sidebar, topbar, and role-gated outlet"
```

---

## Task 3.5: /admin totals page

**Files:**
- Create: `src/routes/admin.index.tsx`

**Step 1: Write the page**

`src/routes/admin.index.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  CheckCircle2,
  HandHeart,
  ScrollText,
  Users,
  Wallet,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminDashboardTotals } from "@/lib/server/admin/dashboard.server";
import { formatDZD, formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "لوحة الإدارة | حملة" }] }),
  component: AdminHomePage,
});

const actionLabels: Record<string, string> = {
  approve_charity: "موافقة على جمعية",
  reject_charity: "رفض جمعية",
  suspend_charity: "تعليق جمعية",
  approve_campaign: "نشر/إعادة تفعيل حملة",
  reject_campaign: "رفض حملة",
  certify_campaign: "توثيق حملة",
  remove_certification: "إلغاء توثيق حملة",
  suspend_campaign: "تعليق حملة",
  approve_payout: "موافقة على سحب",
  reject_payout: "رفض سحب",
  mark_payout_paid: "تأكيد دفع سحب",
  suspend_user: "تعليق مستخدم",
  reactivate_user: "إعادة تفعيل مستخدم",
  view_charity_document: "عرض وثيقة جمعية",
};

function AdminHomePage() {
  const fetch = useServerFn(getAdminDashboardTotals);
  const q = useQuery({
    queryKey: ["admin-dashboard-totals"],
    queryFn: () => fetch({ data: {} }),
  });

  if (q.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">
        تعذر تحميل لوحة الإدارة.
      </div>
    );
  }

  const d = q.data;
  const tiles: { title: string; value: string; icon: React.ReactNode; href?: string }[] = [
    { title: "إجمالي المستخدمين", value: d.users.total.toString(), icon: <Users className="size-5" /> },
    { title: "الجمعيات الموثقة", value: d.charities.approved.toString(), icon: <Building2 className="size-5" /> },
    { title: "طلبات جمعيات قيد المراجعة", value: d.charities.pendingApplications.toString(), icon: <ScrollText className="size-5" />, href: "/admin/charities" },
    { title: "إجمالي الحملات", value: d.campaigns.total.toString(), icon: <HandHeart className="size-5" /> },
    { title: "حملات قيد المراجعة", value: d.campaigns.submitted.toString(), icon: <HandHeart className="size-5" />, href: "/admin/campaigns" },
    { title: "حملات موثقة", value: d.campaigns.certified.toString(), icon: <CheckCircle2 className="size-5" /> },
    { title: "إجمالي التبرعات", value: formatDZD(d.donations.totalRaisedDzd), icon: <HandHeart className="size-5" /> },
    { title: "تبرعات آخر 24 ساعة", value: formatDZD(d.donations.last24hAmountDzd), icon: <HandHeart className="size-5" /> },
    { title: "طلبات سحب معلقة", value: d.payouts.pending.toString(), icon: <Wallet className="size-5" />, href: "/admin/payouts" },
    { title: "سحوبات هذا الشهر", value: formatDZD(d.payouts.totalPaidDzd), icon: <Wallet className="size-5" /> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">الرئيسية</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => {
          const inner = (
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-subtle-foreground">{t.title}</CardTitle>
                <span className="text-primary-strong">{t.icon}</span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{t.value}</p>
              </CardContent>
            </Card>
          );
          return t.href ? (
            <Link key={t.title} to={t.href} className="block">{inner}</Link>
          ) : (
            <div key={t.title}>{inner}</div>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">النشاط الأخير</h2>
        <Card>
          <CardContent className="p-0">
            {d.recentActivity.length === 0 ? (
              <p className="p-6 text-sm text-subtle-foreground">لا يوجد نشاط بعد.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{actionLabels[a.action] ?? a.action}</p>
                      <p className="text-xs text-subtle-foreground">
                        {a.target_type} · {a.target_id.slice(0, 8)}…
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-subtle-foreground">
                      {formatDate(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/routes/admin.index.tsx
git commit -m "feat(admin): /admin totals dashboard"
```

---

## Task 3.6: shared status badge + confirm dialog + charities list

**Files:**
- Create: `src/components/hamla/status-badge.tsx`
- Create: `src/components/hamla/confirm-dialog.tsx`
- Create: `src/routes/admin.charities.tsx`

**Step 1: Status badge component**

`src/components/hamla/status-badge.tsx`:

```typescript
import { cn } from "@/lib/utils";

export type StatusKind = "info" | "ok" | "warn" | "err" | "muted";

const TONE: Record<StatusKind, string> = {
  info: "bg-secondary text-foreground/80",
  ok: "bg-primary-soft text-primary-strong",
  warn: "bg-highlight-soft text-highlight",
  err: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function StatusBadge({ label, kind = "info" }: { label: string; kind?: StatusKind }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE[kind],
      )}
    >
      {label}
    </span>
  );
}

export const APP_STATUS_BADGE: Record<string, { label: string; kind: StatusKind }> = {
  draft: { label: "مسودة", kind: "muted" },
  submitted: { label: "قيد المراجعة", kind: "info" },
  under_review: { label: "قيد المراجعة", kind: "info" },
  approved: { label: "مقبول", kind: "ok" },
  rejected: { label: "مرفوض", kind: "err" },
  more_info_required: { label: "مطلوب معلومات", kind: "warn" },
  suspended: { label: "موقوف", kind: "err" },
};

export const CAMPAIGN_STATUS_BADGE: Record<string, { label: string; kind: StatusKind }> = {
  draft: { label: "مسودة", kind: "muted" },
  submitted: { label: "قيد المراجعة", kind: "info" },
  published: { label: "منشور", kind: "ok" },
  paused: { label: "متوقف", kind: "warn" },
  completed: { label: "مكتمل", kind: "ok" },
  rejected: { label: "مرفوض", kind: "err" },
  suspended: { label: "موقوف", kind: "err" },
  archived: { label: "مؤرشف", kind: "muted" },
};

export const PAYOUT_STATUS_BADGE: Record<string, { label: string; kind: StatusKind }> = {
  pending: { label: "قيد الانتظار", kind: "info" },
  under_review: { label: "قيد المراجعة", kind: "info" },
  approved: { label: "موافق عليه", kind: "ok" },
  processing: { label: "قيد المعالجة", kind: "info" },
  paid: { label: "مدفوع", kind: "ok" },
  rejected: { label: "مرفوض", kind: "err" },
  failed: { label: "فشل", kind: "err" },
};
```

**Step 2: Confirm dialog component**

`src/components/hamla/confirm-dialog.tsx`:

```typescript
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  requireReason = false,
  reasonLabel = "السبب",
  reasonMinLength = 10,
  reasonMaxLength = 500,
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonMinLength?: number;
  reasonMaxLength?: number;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: (reason: string | null) => void;
}) {
  const [reason, setReason] = useState("");
  const reasonValid = !requireReason || (reason.trim().length >= reasonMinLength && reason.trim().length <= reasonMaxLength);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {requireReason ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Textarea
              id="confirm-reason"
              rows={3}
              value={reason}
              maxLength={reasonMaxLength}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-subtle-foreground">
              {reason.trim().length}/{reasonMaxLength} حرف
            </p>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!reasonValid || loading}
            onClick={() => onConfirm(requireReason ? reason.trim() : null)}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Charity applications list page**

`src/routes/admin.charities.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { APP_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDate } from "@/lib/format";
import { listCharityApplications } from "@/lib/server/admin/charities.server";

export const Route = createFileRoute("/admin/charities")({
  head: () => ({ meta: [{ title: "طلبات الجمعيات | حملة" }] }),
  component: AdminCharitiesPage,
});

const FILTERS = [
  { value: "submitted", label: "قيد المراجعة" },
  { value: "under_review", label: "قيد المراجعة" },
  { value: "approved", label: "مقبول" },
  { value: "rejected", label: "مرفوض" },
  { value: "more_info_required", label: "مطلوب معلومات" },
  { value: "suspended", label: "موقوف" },
];

function AdminCharitiesPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const fetch = useServerFn(listCharityApplications);
  const q = useQuery({
    queryKey: ["admin-charity-applications", status ?? "all"],
    queryFn: () => fetch({ data: { status: status ?? null } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">طلبات الجمعيات</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <Button
            size="sm"
            variant={status === undefined ? "default" : "outline"}
            onClick={() => setStatus(undefined)}
          >
            الكل
          </Button>
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={status === f.value ? "default" : "outline"}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs text-subtle-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">اسم الجمعية</th>
              <th className="px-3 py-2 text-start font-medium">الولاية</th>
              <th className="px-3 py-2 text-start font-medium">تاريخ التقديم</th>
              <th className="px-3 py-2 text-start font-medium">الحالة</th>
              <th className="px-3 py-2 text-end font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {q.isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-3" colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : q.isError || !q.data ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-destructive">
                  تعذر تحميل الطلبات.
                </td>
              </tr>
            ) : q.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-subtle-foreground">
                  لا توجد طلبات.
                </td>
              </tr>
            ) : (
              q.data.map((row) => {
                const badge = APP_STATUS_BADGE[row.status] ?? { label: row.status, kind: "info" as const };
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">{row.org_name_ar}</td>
                    <td className="px-3 py-3">{row.org_wilaya}</td>
                    <td className="px-3 py-3">{formatDate(row.submitted_at)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge label={badge.label} kind={badge.kind} />
                    </td>
                    <td className="px-3 py-3 text-end">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/charities/$id" params={{ id: row.id }}>
                          عرض
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 4: Commit (Task 3.8 charity server-fn is needed by this page — write it now in Task 3.7/3.8 first or commit anyway; the type import will fail TypeScript until then)**

Write Task 3.8's `listCharityApplications` first. **Order correction:** Task 3.8 logically comes before Task 3.6's charities list. Re-ordering in execution.

---

## Task 3.7: admin charity server-fns (list, get, signed-URL, approve, reject, more-info)

**Files:**
- Create: `src/lib/server/admin/charities.server.ts`

**Step 1: Write the server module**

`src/lib/server/admin/charities.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/server/admin/guard.server";
import { logAdminAction } from "@/lib/server/audit.server";
import { CHARITY_DOCUMENTS_BUCKET } from "@/lib/storage-paths";

const listInput = z.object({ status: z.string().nullable().optional() });

export const listCharityApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    let q = supabaseAdmin
      .from("charity_applications")
      .select("id, org_name_ar, org_wilaya, submitted_at, status")
      .order("submitted_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("تعذر تحميل الطلبات.");
    return rows ?? [];
  });

const idInput = z.object({ id: z.string().uuid() });

export const getCharityApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const db = supabaseAdmin;
    const { data: app, error } = await db
      .from("charity_applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !app) throw new Error("الطلب غير موجود.");
    const { data: docs } = await db
      .from("charity_documents")
      .select("id, type, mime_type, size_bytes, original_filename, storage_path")
      .eq("charity_application_id", data.id)
      .order("uploaded_at", { ascending: true });
    return { application: app, documents: docs ?? [] };
  });

const docInput = z.object({ documentId: z.string().uuid() });

/**
 * Returns a server-redirect URL to a 5-minute signed URL of the document.
 * The raw storage path is NEVER returned to the client.
 */
export const getCharityDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => docInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const db = supabaseAdmin;
    const { data: doc, error } = await db
      .from("charity_documents")
      .select("storage_path, original_filename")
      .eq("id", data.documentId)
      .maybeSingle();
    if (error || !doc) throw new Error("الوثيقة غير موجودة.");
    const { data: signed, error: signErr } = await db.storage
      .from(CHARITY_DOCUMENTS_BUCKET)
      .createSignedUrl(doc.storage_path, 300);
    if (signErr || !signed?.signedUrl) {
      throw new Error("تعذر إنشاء رابط التحميل.");
    }
    await logAdminAction({
      adminId: userId,
      action: "view_charity_document",
      targetType: "charity_document",
      targetId: data.documentId,
      metadata: { storage_path_prefix: doc.storage_path.split("/").slice(0, 3).join("/") },
    });
    return { url: signed.signedUrl, filename: doc.original_filename };
  });

const approveInput = z.object({ id: z.string().uuid(), notes: z.string().nullable().optional() });

export const approveCharityApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => approveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("approve_charity_application", {
      _application_id: data.id,
      _reviewer_id: userId,
      _notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message || "تعذر قبول الطلب.");
    // The RPC writes its own audit log; this is for symmetry if you want
    // a separate view action.
    return { ok: true };
  });

const rejectInput = z.object({ id: z.string().uuid(), reason: z.string().min(10).max(500) });

export const rejectCharityApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rejectInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("reject_charity_application", {
      _application_id: data.id,
      _reviewer_id: userId,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message || "تعذر رفض الطلب.");
    return { ok: true };
  });

const moreInfoInput = z.object({ id: z.string().uuid(), notes: z.string().min(10).max(500) });

export const requestMoreInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => moreInfoInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("request_more_info", {
      _application_id: data.id,
      _reviewer_id: userId,
      _notes: data.notes,
    });
    if (error) throw new Error(error.message || "تعذر إرسال الطلب.");
    return { ok: true };
  });
```

**Step 2: Commit**

```bash
git add src/lib/server/admin/charities.server.ts
git commit -m "feat(admin): charity applications server-fns"
```

---

## Task 3.6 (continued): now commit the page, status-badge, confirm-dialog

These were written in Task 3.6 above; commit them now:

```bash
git add src/components/hamla/status-badge.tsx src/components/hamla/confirm-dialog.tsx src/routes/admin.charities.tsx
git commit -m "feat(admin): status badge, confirm dialog, charity applications list"
```

---

## Task 3.7b: /admin/charities/$id detail with document download

**Files:**
- Create: `src/routes/admin.charities.$id.tsx`

**Step 1: Write the page**

`src/routes/admin.charities.$id.tsx`:

```typescript
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/hamla/confirm-dialog";
import { APP_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDate, formatDZD } from "@/lib/format";
import {
  approveCharityApplication,
  getCharityApplication,
  getCharityDocumentSignedUrl,
  rejectCharityApplication,
  requestMoreInfo,
} from "@/lib/server/admin/charities.server";

export const Route = createFileRoute("/admin/charities/$id")({
  head: () => ({ meta: [{ title: "تفاصيل طلب جمعية | حملة" }] }),
  component: AdminCharityDetailPage,
});

type ActionKind = "approve" | "reject" | "more_info" | null;

function AdminCharityDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const fetchDetail = useServerFn(getCharityApplication);
  const approve = useServerFn(approveCharityApplication);
  const reject = useServerFn(rejectCharityApplication);
  const moreInfo = useServerFn(requestMoreInfo);
  const getDocUrl = useServerFn(getCharityDocumentSignedUrl);

  const q = useQuery({
    queryKey: ["admin-charity-application", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  const [dialog, setDialog] = useState<ActionKind>(null);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["admin-charity-application", id] });
    void qc.invalidateQueries({ queryKey: ["admin-charity-applications"] });
    void qc.invalidateQueries({ queryKey: ["admin-dashboard-totals"] });
  };

  const approveMut = useMutation({
    mutationFn: () => approve({ data: { id, notes: null } }),
    onSuccess: () => {
      toast.success("تمت الموافقة على الطلب.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: (reason: string) => reject({ data: { id, reason } }),
    onSuccess: () => {
      toast.success("تم رفض الطلب.");
      invalidateAll();
      setDialog(null);
      void router.navigate({ to: "/admin/charities" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moreInfoMut = useMutation({
    mutationFn: (notes: string) => moreInfo({ data: { id, notes } }),
    onSuccess: () => {
      toast.success("تم إرسال طلب المعلومات الإضافية.");
      invalidateAll();
      setDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadMut = useMutation({
    mutationFn: (documentId: string) => getDocUrl({ data: { documentId } }),
    onSuccess: (res) => {
      window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">
        تعذر تحميل الطلب.
      </div>
    );
  }

  const a = q.data.application;
  const docs = q.data.documents;
  const badge = APP_STATUS_BADGE[a.status] ?? { label: a.status, kind: "info" as const };
  const acting = approveMut.isPending || rejectMut.isPending || moreInfoMut.isPending;
  const finalStates = ["approved", "rejected", "suspended"].includes(a.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/charities" className="text-xs text-subtle-foreground hover:underline">
            ← العودة إلى قائمة الطلبات
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{a.org_name_ar}</h1>
          <p className="text-sm text-subtle-foreground">{a.org_name}</p>
        </div>
        <StatusBadge label={badge.label} kind={badge.kind} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>معلومات الجمعية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="الفئة" value={a.org_category} />
            <Row label="الولاية" value={a.org_wilaya} />
            <Row label="البلدية" value={a.org_commune} />
            <Row label="العنوان" value={a.org_address} />
            <Row label="هاتف" value={a.org_phone} />
            <Row label="البريد الإلكتروني" value={a.org_email} />
            {a.org_website ? <Row label="الموقع" value={a.org_website} /> : null}
            <Row label="رقم التسجيل" value={a.registration_number} />
            <Row label="تاريخ التسجيل" value={formatDate(a.registration_date)} />
            <div className="pt-2">
              <p className="text-xs text-subtle-foreground">الوصف</p>
              <p className="mt-1 leading-relaxed">{a.org_description}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الممثل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="الاسم" value={a.rep_name} />
            <Row label="الهاتف" value={a.rep_phone} />
            <Row label="البريد" value={a.rep_email} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الوثائق المرفقة</CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-subtle-foreground">لا توجد وثائق.</p>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{d.original_filename ?? d.type}</p>
                    <p className="text-xs text-subtle-foreground">
                      {d.mime_type} · {Math.round(d.size_bytes / 1024)} KB
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadMut.mutate(d.id)}
                    disabled={downloadMut.isPending}
                  >
                    <Download className="size-4" />
                    تحميل
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!finalStates ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => approveMut.mutate()} disabled={acting}>
            {approveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            قبول
          </Button>
          <Button variant="destructive" onClick={() => setDialog("reject")} disabled={acting}>
            <XCircle className="size-4" />
            رفض
          </Button>
          <Button variant="outline" onClick={() => setDialog("more_info")} disabled={acting}>
            طلب معلومات إضافية
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={(v) => setDialog(v ? "reject" : null)}
        title="رفض طلب الجمعية"
        description="سيتم إبلاغ المتقدم بالرفض والسبب. لا يمكن التراجع."
        requireReason
        reasonLabel="سبب الرفض"
        destructive
        confirmLabel="تأكيد الرفض"
        loading={rejectMut.isPending}
        onConfirm={(reason) => reason ? rejectMut.mutate(reason) : null}
      />

      <ConfirmDialog
        open={dialog === "more_info"}
        onOpenChange={(v) => setDialog(v ? "more_info" : null)}
        title="طلب معلومات إضافية"
        description="سيتم إرسال ملاحظاتك للمتقدم ليقوم بتحديث طلبه."
        requireReason
        reasonLabel="المعلومات المطلوبة"
        confirmLabel="إرسال الطلب"
        loading={moreInfoMut.isPending}
        onConfirm={(notes) => notes ? moreInfoMut.mutate(notes) : null}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="shrink-0 text-subtle-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/routes/admin.charities.$id.tsx
git commit -m "feat(admin): charity application detail with actions and document download"
```

---

## Task 3.8: /admin/campaigns list + detail + server-fns

**Files:**
- Create: `src/lib/server/admin/campaigns.server.ts`
- Create: `src/routes/admin.campaigns.tsx`
- Create: `src/routes/admin.campaigns.$id.tsx`

**Step 1: Server-fns**

`src/lib/server/admin/campaigns.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/server/admin/guard.server";

const listInput = z.object({ status: z.string().nullable().optional() });

export const listAdminCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    let q = supabaseAdmin
      .from("campaigns")
      .select("id, title, slug, goal_amount, raised_amount, status, certified, created_at, charity_groups(name)")
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("تعذر تحميل الحملات.");
    return rows ?? [];
  });

const idInput = z.object({ id: z.string().uuid() });

export const getAdminCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { data: c, error } = await supabaseAdmin
      .from("campaigns")
      .select("*, charity_groups(name, slug, verified)")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !c) throw new Error("الحملة غير موجودة.");
    const { data: donations } = await supabaseAdmin
      .from("donations")
      .select("id, reference, amount, donor_name, anonymous, status, created_at, paid_at")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return { campaign: c, donations: donations ?? [] };
  });

const actionInput = z.object({ id: z.string().uuid() });

export const publishCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actionInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("publish_campaign", {
      _campaign_id: data.id, _admin_id: userId,
    });
    if (error) throw new Error(error.message || "تعذر نشر الحملة.");
    return { ok: true };
  });

const rejectInput = z.object({ id: z.string().uuid(), reason: z.string().min(10).max(500) });

export const rejectCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rejectInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("reject_campaign", {
      _campaign_id: data.id, _admin_id: userId, _reason: data.reason,
    });
    if (error) throw new Error(error.message || "تعذر رفض الحملة.");
    return { ok: true };
  });

const suspendInput = z.object({ id: z.string().uuid(), reason: z.string().min(10).max(500) });

export const suspendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => suspendInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("suspend_campaign", {
      _campaign_id: data.id, _admin_id: userId, _reason: data.reason,
    });
    if (error) throw new Error(error.message || "تعذر تعليق الحملة.");
    return { ok: true };
  });

export const reactivateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actionInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("reactivate_campaign", {
      _campaign_id: data.id, _admin_id: userId,
    });
    if (error) throw new Error(error.message || "تعذر إعادة التفعيل.");
    return { ok: true };
  });

export const certifyCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actionInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("certify_campaign", {
      _campaign_id: data.id, _admin_id: userId,
    });
    if (error) throw new Error(error.message || "تعذر توثيق الحملة.");
    return { ok: true };
  });

const removeCertInput = z.object({ id: z.string().uuid(), reason: z.string().min(10).max(500) });

export const removeCampaignCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => removeCertInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("remove_campaign_certification", {
      _campaign_id: data.id, _admin_id: userId, _reason: data.reason,
    });
    if (error) throw new Error(error.message || "تعذر إلغاء التوثيق.");
    return { ok: true };
  });
```

**Step 2: Campaigns list page**

`src/routes/admin.campaigns.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CAMPAIGN_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { listAdminCampaigns } from "@/lib/server/admin/campaigns.server";

export const Route = createFileRoute("/admin/campaigns")({
  head: () => ({ meta: [{ title: "الحملات | حملة" }] }),
  component: AdminCampaignsPage,
});

const FILTERS = [
  { value: undefined, label: "الكل" },
  { value: "submitted", label: "قيد المراجعة" },
  { value: "published", label: "منشورة" },
  { value: "certified", label: "موثقة" },
  { value: "suspended", label: "موقوفة" },
  { value: "rejected", label: "مرفوضة" },
];

function AdminCampaignsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const fetch = useServerFn(listAdminCampaigns);
  const q = useQuery({
    queryKey: ["admin-campaigns", status ?? "all"],
    queryFn: () => fetch({ data: { status: status ?? null } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">الحملات</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          {FILTERS.map((f) => (
            <Button
              key={f.label}
              size="sm"
              variant={status === f.value ? "default" : "outline"}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs text-subtle-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">عنوان الحملة</th>
              <th className="px-3 py-2 text-start font-medium">الجمعية</th>
              <th className="px-3 py-2 text-start font-medium">الهدف</th>
              <th className="px-3 py-2 text-start font-medium">المُجمَّع</th>
              <th className="px-3 py-2 text-start font-medium">الحالة</th>
              <th className="px-3 py-2 text-start font-medium">التوثيق</th>
              <th className="px-3 py-2 text-end font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {q.isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-3" colSpan={7}><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : q.isError || !q.data ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-destructive">تعذر التحميل.</td></tr>
            ) : q.data.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-subtle-foreground">لا توجد حملات.</td></tr>
            ) : (
              q.data.map((c: any) => {
                const sb = CAMPAIGN_STATUS_BADGE[c.status] ?? { label: c.status, kind: "info" as const };
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">{c.title}</td>
                    <td className="px-3 py-3">{c.charity_groups?.name ?? "—"}</td>
                    <td className="px-3 py-3">{formatDZD(Number(c.goal_amount))}</td>
                    <td className="px-3 py-3">{formatDZD(Number(c.raised_amount))}</td>
                    <td className="px-3 py-3"><StatusBadge label={sb.label} kind={sb.kind} /></td>
                    <td className="px-3 py-3">
                      {c.certified ? <StatusBadge label="موثقة" kind="ok" /> : <StatusBadge label="غير موثقة" kind="muted" />}
                    </td>
                    <td className="px-3 py-3 text-end">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/campaigns/$id" params={{ id: c.id }}>عرض</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 3: Campaign detail page**

`src/routes/admin.campaigns.$id.tsx`:

```typescript
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, ShieldOff, XCircle, Play, Pause, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/hamla/confirm-dialog";
import { CAMPAIGN_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import {
  certifyCampaign,
  getAdminCampaign,
  publishCampaign,
  reactivateCampaign,
  rejectCampaign,
  removeCampaignCertification,
  suspendCampaign,
} from "@/lib/server/admin/campaigns.server";

export const Route = createFileRoute("/admin/campaigns/$id")({
  head: () => ({ meta: [{ title: "تفاصيل حملة | حملة" }] }),
  component: AdminCampaignDetailPage,
});

type ActionKind = "reject" | "suspend" | "remove_cert" | null;

function AdminCampaignDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const fetchDetail = useServerFn(getAdminCampaign);
  const publish = useServerFn(publishCampaign);
  const reject = useServerFn(rejectCampaign);
  const suspend = useServerFn(suspendCampaign);
  const reactivate = useServerFn(reactivateCampaign);
  const certify = useServerFn(certifyCampaign);
  const removeCert = useServerFn(removeCampaignCertification);

  const q = useQuery({
    queryKey: ["admin-campaign", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  const [dialog, setDialog] = useState<ActionKind>(null);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["admin-campaign", id] });
    void qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    void qc.invalidateQueries({ queryKey: ["admin-dashboard-totals"] });
  };

  const anyPending = false; // simplified: track in mutations individually

  const publishMut = useMutation({
    mutationFn: () => publish({ data: { id } }),
    onSuccess: () => { toast.success("تم نشر الحملة."); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: (reason: string) => reject({ data: { id, reason } }),
    onSuccess: () => {
      toast.success("تم رفض الحملة.");
      invalidateAll(); setDialog(null);
      void router.navigate({ to: "/admin/campaigns" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const suspendMut = useMutation({
    mutationFn: (reason: string) => suspend({ data: { id, reason } }),
    onSuccess: () => { toast.success("تم تعليق الحملة."); invalidateAll(); setDialog(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reactivateMut = useMutation({
    mutationFn: () => reactivate({ data: { id } }),
    onSuccess: () => { toast.success("تمت إعادة التفعيل."); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const certifyMut = useMutation({
    mutationFn: () => certify({ data: { id } }),
    onSuccess: () => { toast.success("تم توثيق الحملة."); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeCertMut = useMutation({
    mutationFn: (reason: string) => removeCert({ data: { id, reason } }),
    onSuccess: () => { toast.success("تم إلغاء التوثيق."); invalidateAll(); setDialog(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (q.isError || !q.data) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>;
  }
  const c: any = q.data.campaign;
  const donations = q.data.donations;
  const sb = CAMPAIGN_STATUS_BADGE[c.status] ?? { label: c.status, kind: "info" as const };
  const isPublished = c.status === "published";
  const isSuspended = c.status === "suspended";
  const isSubmitted = c.status === "submitted";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/campaigns" className="text-xs text-subtle-foreground hover:underline">← العودة</Link>
          <h1 className="mt-1 text-2xl font-bold">{c.title}</h1>
          <p className="text-sm text-subtle-foreground">{c.charity_groups?.name ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge label={sb.label} kind={sb.kind} />
          {c.certified ? <StatusBadge label="موثقة" kind="ok" /> : <StatusBadge label="غير موثقة" kind="muted" />}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>المعلومات</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="الهدف" value={formatDZD(Number(c.goal_amount))} />
          <Row label="المُجمَّع" value={formatDZD(Number(c.raised_amount))} />
          <Row label="المتبرعون" value={String(c.donor_count)} />
          <Row label="الفئة" value={c.category ?? "—"} />
          <Row label="الولاية" value={c.location ?? "—"} />
          <Row label="تاريخ الإنشاء" value={formatDate(c.created_at)} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {isSubmitted || c.status === "draft" ? (
          <Button onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>
            {publishMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} نشر
          </Button>
        ) : null}
        {isSubmitted ? (
          <Button variant="destructive" onClick={() => setDialog("reject")}><XCircle className="size-4" /> رفض</Button>
        ) : null}
        {(isPublished || c.status === "paused") ? (
          <Button variant="outline" onClick={() => setDialog("suspend")}><Pause className="size-4" /> تعليق</Button>
        ) : null}
        {isSuspended ? (
          <Button variant="outline" onClick={() => reactivateMut.mutate()} disabled={reactivateMut.isPending}>
            {reactivateMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} إعادة التفعيل
          </Button>
        ) : null}
        {c.certified ? (
          <Button variant="outline" onClick={() => setDialog("remove_cert")}>
            <ShieldOff className="size-4" /> إلغاء التوثيق
          </Button>
        ) : (
          <Button onClick={() => certifyMut.mutate()} disabled={certifyMut.isPending}>
            {certifyMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} توثيق
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={(v) => setDialog(v ? "reject" : null)}
        title="رفض الحملة"
        description="سيتم إبلاغ الجمعية بالرفض. لا يمكن التراجع."
        requireReason
        reasonLabel="سبب الرفض"
        destructive
        confirmLabel="تأكيد الرفض"
        loading={rejectMut.isPending}
        onConfirm={(r) => r ? rejectMut.mutate(r) : null}
      />
      <ConfirmDialog
        open={dialog === "suspend"}
        onOpenChange={(v) => setDialog(v ? "suspend" : null)}
        title="تعليق الحملة"
        description="سيتم إيقاف الحملة مؤقتاً وإخفاءها عن المتبرعين."
        requireReason
        reasonLabel="سبب التعليق"
        destructive
        confirmLabel="تأكيد التعليق"
        loading={suspendMut.isPending}
        onConfirm={(r) => r ? suspendMut.mutate(r) : null}
      />
      <ConfirmDialog
        open={dialog === "remove_cert"}
        onOpenChange={(v) => setDialog(v ? "remove_cert" : null)}
        title="إلغاء توثيق الحملة"
        description="سيتم إزالة شارة التوثيق من الحملة."
        requireReason
        reasonLabel="سبب الإلغاء"
        confirmLabel="تأكيد الإلغاء"
        loading={removeCertMut.isPending}
        onConfirm={(r) => r ? removeCertMut.mutate(r) : null}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="shrink-0 text-subtle-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/server/admin/campaigns.server.ts src/routes/admin.campaigns.tsx src/routes/admin.campaigns.$id.tsx
git commit -m "feat(admin): campaigns list, detail, and moderation actions"
```

---

## Task 3.9: /admin/payouts list + detail + server-fns

**Files:**
- Create: `src/lib/server/admin/payouts.server.ts`
- Create: `src/routes/admin.payouts.tsx`
- Create: `src/routes/admin.payouts.$id.tsx`

**Step 1: Server-fns**

`src/lib/server/admin/payouts.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/server/admin/guard.server";

const listInput = z.object({ status: z.string().nullable().optional() });

export const listAdminPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    let q = supabaseAdmin
      .from("payouts")
      .select("id, amount, currency, status, requested_at, charity_groups(name)")
      .order("requested_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("تعذر تحميل السحوبات.");
    return rows ?? [];
  });

const idInput = z.object({ id: z.string().uuid() });

export const getAdminPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { data: p, error } = await supabaseAdmin
      .from("payouts")
      .select("*, charity_groups(name, slug, user_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !p) throw new Error("السحب غير موجود.");
    return p;
  });

const approveInput = z.object({ id: z.string().uuid() });

export const approvePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => approveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("approve_payout", {
      _payout_id: data.id, _admin_id: userId,
    });
    if (error) throw new Error(error.message || "تعذر الموافقة على السحب.");
    return { ok: true };
  });

const rejectInput = z.object({ id: z.string().uuid(), reason: z.string().min(10).max(500) });

export const rejectPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rejectInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("reject_payout", {
      _payout_id: data.id, _admin_id: userId, _reason: data.reason,
    });
    if (error) throw new Error(error.message || "تعذر رفض السحب.");
    return { ok: true };
  });

const markPaidInput = z.object({
  id: z.string().uuid(),
  external_reference: z.string().min(3).max(80),
});

export const markPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => markPaidInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const { error } = await supabaseAdmin.rpc("mark_payout_paid", {
      _payout_id: data.id, _admin_id: userId, _external_reference: data.external_reference,
    });
    if (error) throw new Error(error.message || "تعذر تأكيد الدفع.");
    return { ok: true };
  });
```

**Step 2: Payouts list**

`src/routes/admin.payouts.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYOUT_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { listAdminPayouts } from "@/lib/server/admin/payouts.server";

export const Route = createFileRoute("/admin/payouts")({
  head: () => ({ meta: [{ title: "السحوبات | حملة" }] }),
  component: AdminPayoutsPage,
});

const FILTERS = [
  { value: undefined, label: "الكل" },
  { value: "pending", label: "قيد الانتظار" },
  { value: "under_review", label: "قيد المراجعة" },
  { value: "approved", label: "موافق عليها" },
  { value: "processing", label: "قيد المعالجة" },
  { value: "paid", label: "مدفوعة" },
  { value: "rejected", label: "مرفوضة" },
  { value: "failed", label: "فشلت" },
];

function AdminPayoutsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const fetch = useServerFn(listAdminPayouts);
  const q = useQuery({
    queryKey: ["admin-payouts", status ?? "all"],
    queryFn: () => fetch({ data: { status: status ?? null } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">السحوبات</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          {FILTERS.map((f) => (
            <Button
              key={f.label}
              size="sm"
              variant={status === f.value ? "default" : "outline"}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs text-subtle-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">الجمعية</th>
              <th className="px-3 py-2 text-start font-medium">المبلغ</th>
              <th className="px-3 py-2 text-start font-medium">تاريخ الطلب</th>
              <th className="px-3 py-2 text-start font-medium">الحالة</th>
              <th className="px-3 py-2 text-end font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {q.isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-3" colSpan={5}><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : q.isError || !q.data ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-destructive">تعذر التحميل.</td></tr>
            ) : q.data.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-subtle-foreground">لا توجد سحوبات.</td></tr>
            ) : (
              q.data.map((p: any) => {
                const sb = PAYOUT_STATUS_BADGE[p.status] ?? { label: p.status, kind: "info" as const };
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">{p.charity_groups?.name ?? "—"}</td>
                    <td className="px-3 py-3">{formatDZD(Number(p.amount))}</td>
                    <td className="px-3 py-3">{formatDate(p.requested_at)}</td>
                    <td className="px-3 py-3"><StatusBadge label={sb.label} kind={sb.kind} /></td>
                    <td className="px-3 py-3 text-end">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/payouts/$id" params={{ id: p.id }}>عرض</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 3: Payout detail**

`src/routes/admin.payouts.$id.tsx`:

```typescript
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/hamla/confirm-dialog";
import { PAYOUT_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import {
  approvePayout,
  getAdminPayout,
  markPayoutPaid,
  rejectPayout,
} from "@/lib/server/admin/payouts.server";

export const Route = createFileRoute("/admin/payouts/$id")({
  head: () => ({ meta: [{ title: "تفاصيل سحب | حملة" }] }),
  component: AdminPayoutDetailPage,
});

type ActionKind = "reject" | "mark_paid" | null;

function AdminPayoutDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const fetchDetail = useServerFn(getAdminPayout);
  const approve = useServerFn(approvePayout);
  const reject = useServerFn(rejectPayout);
  const markPaid = useServerFn(markPayoutPaid);

  const q = useQuery({
    queryKey: ["admin-payout", id],
    queryFn: () => fetchDetail({ data: { id } }),
  });

  const [dialog, setDialog] = useState<ActionKind>(null);
  const [externalRef, setExternalRef] = useState("");

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["admin-payout", id] });
    void qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    void qc.invalidateQueries({ queryKey: ["admin-dashboard-totals"] });
  };

  const approveMut = useMutation({
    mutationFn: () => approve({ data: { id } }),
    onSuccess: () => { toast.success("تمت الموافقة."); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rejectMut = useMutation({
    mutationFn: (reason: string) => reject({ data: { id, reason } }),
    onSuccess: () => { toast.success("تم الرفض."); invalidateAll(); setDialog(null); void router.navigate({ to: "/admin/payouts" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const markPaidMut = useMutation({
    mutationFn: (ref: string) => markPaid({ data: { id, external_reference: ref } }),
    onSuccess: () => { toast.success("تم تأكيد الدفع."); invalidateAll(); setDialog(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) return <Skeleton className="h-64 w-full" />;
  if (q.isError || !q.data) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>;

  const p: any = q.data;
  const sb = PAYOUT_STATUS_BADGE[p.status] ?? { label: p.status, kind: "info" as const };
  const dest = (p.destination ?? {}) as Record<string, string>;
  const isApprovable = ["pending", "under_review"].includes(p.status);
  const isPayable = ["approved", "processing"].includes(p.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/payouts" className="text-xs text-subtle-foreground hover:underline">← العودة</Link>
          <h1 className="mt-1 text-2xl font-bold">طلب سحب</h1>
          <p className="text-sm text-subtle-foreground">{p.charity_groups?.name ?? "—"}</p>
        </div>
        <StatusBadge label={sb.label} kind={sb.kind} />
      </div>

      <Card>
        <CardHeader><CardTitle>تفاصيل السحب</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="المبلغ" value={formatDZD(Number(p.amount))} />
          <Row label="العملة" value={p.currency} />
          <Row label="تاريخ الطلب" value={formatDate(p.requested_at)} />
          {p.approved_at ? <Row label="تاريخ الموافقة" value={formatDate(p.approved_at)} /> : null}
          {p.paid_at ? <Row label="تاريخ الدفع" value={formatDate(p.paid_at)} /> : null}
          {p.external_reference ? <Row label="مرجع الدفع" value={p.external_reference} /> : null}
          {p.rejection_reason ? <Row label="سبب الرفض" value={p.rejection_reason} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>وجهة السحب</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {Object.entries(dest).map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {isApprovable ? (
          <>
            <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
              {approveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} موافقة
            </Button>
            <Button variant="destructive" onClick={() => setDialog("reject")}>
              <XCircle className="size-4" /> رفض
            </Button>
          </>
        ) : null}
        {isPayable ? (
          <Button onClick={() => setDialog("mark_paid")}>تأكيد الدفع</Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={(v) => setDialog(v ? "reject" : null)}
        title="رفض السحب"
        requireReason
        reasonLabel="سبب الرفض"
        destructive
        confirmLabel="تأكيد الرفض"
        loading={rejectMut.isPending}
        onConfirm={(r) => r ? rejectMut.mutate(r) : null}
      />

      <Dialog open={dialog === "mark_paid"} onOpenChange={(v) => setDialog(v ? "mark_paid" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الدفع</DialogTitle>
            <DialogDescription>أدخل مرجع الدفع الخارجي (رقم العملية البنكية، CCP، إلخ).</DialogDescription>
          </DialogHeader>
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="مثال: TX-2026-001234"
            value={externalRef}
            onChange={(e) => setExternalRef(e.target.value)}
            minLength={3}
            maxLength={80}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button>
            <Button
              disabled={externalRef.trim().length < 3 || markPaidMut.isPending}
              onClick={() => markPaidMut.mutate(externalRef.trim())}
            >
              {markPaidMut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="shrink-0 text-subtle-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}

// Inline-imported dialog primitives for the mark-paid modal
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
```

**Step 4: Commit**

```bash
git add src/lib/server/admin/payouts.server.ts src/routes/admin.payouts.tsx src/routes/admin.payouts.$id.tsx
git commit -m "feat(admin): payouts list, detail, and approve/reject/mark-paid actions"
```

---

## Task 3.10: /admin/donations list + detail (read-only)

**Files:**
- Create: `src/lib/server/admin/donations.server.ts`
- Create: `src/routes/admin.donations.tsx`
- Create: `src/routes/admin.donations.$id.tsx`

**Step 1: Server-fns**

`src/lib/server/admin/donations.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/server/admin/guard.server";

const listInput = z.object({ status: z.string().nullable().optional() });

export const listAdminDonations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    let q = supabaseAdmin
      .from("donations")
      .select("id, reference, amount, currency, donor_name, donor_email, anonymous, status, created_at, paid_at, campaigns(title, slug)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("تعذر تحميل التبرعات.");
    return rows ?? [];
  });

const idInput = z.object({ id: z.string().uuid() });

export const getAdminDonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const db = supabaseAdmin;
    const { data: d, error } = await db
      .from("donations")
      .select("*, campaigns(title, slug), invoices(invoice_number, issued_at)")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !d) throw new Error("التبرع غير موجود.");
    const { data: payment } = await db
      .from("payments")
      .select("provider, provider_transaction_id, status, raw")
      .eq("donation_id", data.id)
      .maybeSingle();
    const { data: ledger } = await db
      .from("ledger_entries")
      .select("id, type, amount, currency, status, reference, created_at")
      .eq("donation_id", data.id)
      .maybeSingle();
    return { donation: d, payment, ledger };
  });
```

**Step 2: List page**

`src/routes/admin.donations.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { listAdminDonations } from "@/lib/server/admin/donations.server";

export const Route = createFileRoute("/admin/donations")({
  head: () => ({ meta: [{ title: "التبرعات | حملة" }] }),
  component: AdminDonationsPage,
});

const FILTERS = [
  { value: undefined, label: "الكل" },
  { value: "PENDING", label: "قيد الانتظار" },
  { value: "PROCESSING", label: "قيد المعالجة" },
  { value: "PAID", label: "مدفوع" },
  { value: "FAILED", label: "فشل" },
  { value: "CANCELLED", label: "ملغى" },
  { value: "REFUNDED", label: "مسترد" },
];

function AdminDonationsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const fetch = useServerFn(listAdminDonations);
  const q = useQuery({
    queryKey: ["admin-donations", status ?? "all"],
    queryFn: () => fetch({ data: { status: status ?? null } }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">التبرعات</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          {FILTERS.map((f) => (
            <Button
              key={f.label}
              size="sm"
              variant={status === f.value ? "default" : "outline"}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs text-subtle-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">المرجع</th>
              <th className="px-3 py-2 text-start font-medium">المتبرع</th>
              <th className="px-3 py-2 text-start font-medium">الحملة</th>
              <th className="px-3 py-2 text-start font-medium">المبلغ</th>
              <th className="px-3 py-2 text-start font-medium">الحالة</th>
              <th className="px-3 py-2 text-start font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {q.isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-3" colSpan={6}><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
            ) : q.isError || !q.data ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-destructive">تعذر التحميل.</td></tr>
            ) : q.data.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-subtle-foreground">لا توجد تبرعات.</td></tr>
            ) : (
              q.data.map((d: any) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-3 font-mono text-xs">
                    <Link to="/admin/donations/$id" params={{ id: d.id }} className="hover:underline">
                      {d.reference}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{d.anonymous ? "مجهول" : (d.donor_name ?? "—")}</td>
                  <td className="px-3 py-3">{d.campaigns?.title ?? "—"}</td>
                  <td className="px-3 py-3">{formatDZD(Number(d.amount))}</td>
                  <td className="px-3 py-3"><StatusBadge label={d.status} kind={d.status === "PAID" ? "ok" : d.status === "FAILED" ? "err" : "info"} /></td>
                  <td className="px-3 py-3">{formatDate(d.paid_at ?? d.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 3: Donation detail**

`src/routes/admin.donations.$id.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { getAdminDonation } from "@/lib/server/admin/donations.server";

export const Route = createFileRoute("/admin/donations/$id")({
  head: () => ({ meta: [{ title: "تفاصيل تبرع | حملة" }] }),
  component: AdminDonationDetailPage,
});

function AdminDonationDetailPage() {
  const { id } = Route.useParams();
  const fetch = useServerFn(getAdminDonation);
  const q = useQuery({
    queryKey: ["admin-donation", id],
    queryFn: () => fetch({ data: { id } }),
  });

  if (q.isPending) return <Skeleton className="h-64 w-full" />;
  if (q.isError || !q.data) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>;

  const d: any = q.data.donation;
  const p: any = q.data.payment;
  const l: any = q.data.ledger;
  const inv: any = d.invoices;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/donations" className="text-xs text-subtle-foreground hover:underline">← العودة</Link>
        <h1 className="mt-1 text-2xl font-bold">تفاصيل تبرع</h1>
        <p className="font-mono text-sm text-subtle-foreground">{d.reference}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>المعلومات</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="الحملة" value={d.campaigns?.title ?? "—"} />
            <Row label="المبلغ" value={formatDZD(Number(d.amount))} />
            <Row label="الحالة" value={d.status} />
            <Row label="المتبرع" value={d.anonymous ? "مجهول" : (d.donor_name ?? "—")} />
            {d.donor_email ? <Row label="البريد" value={d.donor_email} /> : null}
            <Row label="تاريخ الإنشاء" value={formatDate(d.created_at)} />
            {d.paid_at ? <Row label="تاريخ الدفع" value={formatDate(d.paid_at)} /> : null}
            {d.message ? <Row label="رسالة" value={d.message} /> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>الدفع</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {p ? (
              <>
                <Row label="البوابة" value={p.provider} />
                <Row label="مرجع البوابة" value={p.provider_transaction_id ?? "—"} />
                <Row label="حالة الدفع" value={p.status} />
              </>
            ) : <p className="text-subtle-foreground">لا توجد معلومات دفع.</p>}
            {inv ? (
              <>
                <Row label="رقم الإيصال" value={inv.invoice_number} />
                <Row label="تاريخ الإصدار" value={formatDate(inv.issued_at)} />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {l ? (
        <Card>
          <CardHeader><CardTitle>القيد المحاسبي</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="النوع" value={l.type} />
            <Row label="المبلغ" value={`${Number(l.amount)} ${l.currency}`} />
            <Row label="الحالة" value={l.status} />
            <Row label="المرجع" value={l.reference ?? "—"} />
            <Row label="تاريخ القيد" value={formatDate(l.created_at)} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="shrink-0 text-subtle-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/server/admin/donations.server.ts src/routes/admin.donations.tsx src/routes/admin.donations.$id.tsx
git commit -m "feat(admin): read-only donations list and detail"
```

---

## Task 3.11: /admin/audit-log + /admin/settings

**Files:**
- Create: `src/routes/admin.audit-log.tsx`
- Create: `src/routes/admin.settings.tsx`

**Step 1: Audit log viewer**

`src/routes/admin.audit-log.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/admin/audit-log")({
  head: () => ({ meta: [{ title: "سجل النشاط | حملة" }] }),
  component: AdminAuditLogPage,
});

// The audit log is admin-readable via RLS. We use supabaseAdmin to bypass RLS
// and read all rows; the route's role gate ensures only admins can reach here.
const listAudit = async (offset: number) => {
  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("id, action, target_type, target_id, metadata, created_at, admin_id")
    .order("created_at", { ascending: false })
    .range(offset, offset + 49);
  if (error) throw new Error(error.message);
  return data ?? [];
};

function AdminAuditLogPage() {
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["admin-audit-log", page],
    queryFn: () => listAudit(page * 50),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">سجل النشاط</h1>
      <Card>
        <CardHeader><CardTitle>آخر الإجراءات ({q.data?.length ?? 0} إدخال)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {q.isPending ? (
            <div className="p-4"><Skeleton className="h-40 w-full" /></div>
          ) : q.isError || !q.data ? (
            <p className="p-6 text-sm text-destructive">تعذر التحميل.</p>
          ) : q.data.length === 0 ? (
            <p className="p-6 text-sm text-subtle-foreground">لا يوجد نشاط.</p>
          ) : (
            <ul className="divide-y divide-border">
              {q.data.map((row) => (
                <li key={row.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{row.action}</span>
                    <span className="text-xs text-subtle-foreground">{formatDate(row.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-subtle-foreground">
                    {row.target_type} · {row.target_id}
                  </p>
                  {row.metadata && Object.keys(row.metadata as object).length > 0 ? (
                    <pre className="mt-1 overflow-x-auto rounded bg-secondary p-2 text-[10px] leading-snug">
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          السابق
        </button>
        <span className="px-2 py-1.5 text-sm">صفحة {page + 1}</span>
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={!q.data || q.data.length < 50}
          onClick={() => setPage((p) => p + 1)}
        >
          التالي
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Settings page (SlickPay stub status)**

`src/routes/admin.settings.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "الإعدادات | حملة" }] }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const provider = (import.meta as any).env?.VITE_PAYMENT_PROVIDER ?? process.env["PAYMENT_PROVIDER"] ?? "algerian-gateway";
  const isSlickPay = (provider ?? "").toLowerCase() === "slickpay";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">الإعدادات</h1>

      <Card>
        <CardHeader><CardTitle>بوابة الدفع</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>المزوّد النشط: <span className="font-mono">{provider}</span></p>
          {isSlickPay ? (
            <div className="rounded-lg border border-highlight bg-highlight-soft p-4 text-highlight-foreground">
              <p className="font-semibold">SlickPay غير مهيأ بعد</p>
              <p className="mt-1 text-xs leading-relaxed">
                تم اختيار SlickPay كبوابة دفع، لكن التوثيق الرسمي للـ API لم يصل بعد. المنصة تستخدم حالياً البوابة الافتراضية أو وضع الاختبار. أرسل وثائق API إلى فريق حملة لتفعيل SlickPay.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-primary bg-primary-soft p-4 text-primary-strong">
              <p>البوابة النشطة هي البوابة الجزائرية الافتراضية (وضع الإنتاج أو الاختبار حسب الإعدادات).</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الإعدادات العامة</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-subtle-foreground">
          <p>ستضاف هنا إعدادات إضافية (الحد الأدنى والأقصى للتبرع، رسوم المنصة، إعدادات البريد) في إصدارات لاحقة.</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/routes/admin.audit-log.tsx src/routes/admin.settings.tsx
git commit -m "feat(admin): audit log viewer and settings page"
```

---

## Task 3.12: Part 3 smoke test

**Files:** none. You run this.

**Step 1: `npx tsc --noEmit`**

Run from the repo root. Expected errors: any downstream code in `donations.functions.ts`, `campaign.functions.ts`, `routes/index.tsx` that references the old `status: string` on `campaigns` — these are fixed in Parts 4–5. Errors in any new Part 3 file are bugs I introduced; paste them and I fix.

**Step 2: dev server smoke test**

```bash
bun run dev
```

In the browser, signed in as the account with the admin role:

1. Navigate to `/admin`. You should see the sidebar on the left, the topbar at the top, and the totals dashboard in the main area. Confirm the cards render with numbers.
2. Navigate to `/admin/charities`. Confirm the application you submitted in Part 2 is listed with status "قيد المراجعة". Click "عرض".
3. On the detail page, confirm the org info, rep info, and the document list render. Click "تحميل" on the document — a new tab should open with the file (signed URL works).
4. Click "قبول". Confirm the toast "تمت الموافقة على الطلب" appears and the user is moved to "approved" state.
5. **DB check 1:** in the SQL editor, confirm `public.user_roles` has a new row for the applicant with `role = 'charity_group'`, and `public.charity_groups` has a new row with `verified = true`.
6. **DB check 2:** `public.audit_logs` has a new row with `action = 'approve_charity'`, `target_type = 'charity_application'`, `target_id = <the app id>`.
7. Navigate to `/admin/audit-log`. Confirm the approve_charity entry appears.
8. Sign in as the new charity_group user (the one you just approved) in another browser/incognito window. Confirm the header now shows "لوحة تحكم الجمعية" (which will 404 until Part 4 — that's expected; the link itself is what matters now).
9. Back as admin. Navigate to `/admin/campaigns`. The list is empty (no campaigns created yet — that's Part 4's work).
10. Navigate to `/admin/payouts`. Empty (Part 4's work).
11. Navigate to `/admin/donations`. If you did a test donation in the existing app, it should appear. Otherwise empty.
12. Navigate to `/admin/settings`. Confirm the SlickPay status section renders.
13. **Non-admin test:** in a third incognito window, sign in as a different user (a normal `user`). Try to navigate to `/admin`. You should see a "404 / الصفحة غير موجودة" page, not the admin shell.

When all checks pass, reply **"Part 3 done, proceed to Part 4"** and I will build the charity dashboard.

---

**Plan self-review (Part 3):**

- **Spec coverage:** every admin route and server-fn from Section 4 is covered. ✓
- **Placeholder scan:** none. ✓
- **Type consistency:** all admin server-fns cast `context as { userId: string }` matching the auth-middleware contract. The `getCharityDocumentSignedUrl` returns `{ url, filename }` not a raw storage path. ✓
- **Gaps:** none for Part 3.

**Files added/modified in Part 3:**

| Path | New/Modified |
|------|--------------|
| `src/lib/server/admin/guard.server.ts` | NEW |
| `src/lib/server/audit.server.ts` | NEW |
| `src/lib/server/admin/dashboard.server.ts` | NEW |
| `src/components/hamla/admin-sidebar.tsx` | NEW |
| `src/components/hamla/admin-topbar.tsx` | NEW |
| `src/routes/admin.tsx` | NEW (layout) |
| `src/routes/admin.index.tsx` | NEW |
| `src/components/hamla/status-badge.tsx` | NEW |
| `src/components/hamla/confirm-dialog.tsx` | NEW |
| `src/lib/server/admin/charities.server.ts` | NEW |
| `src/routes/admin.charities.tsx` | NEW |
| `src/routes/admin.charities.$id.tsx` | NEW |
| `src/lib/server/admin/campaigns.server.ts` | NEW |
| `src/routes/admin.campaigns.tsx` | NEW |
| `src/routes/admin.campaigns.$id.tsx` | NEW |
| `src/lib/server/admin/payouts.server.ts` | NEW |
| `src/routes/admin.payouts.tsx` | NEW |
| `src/routes/admin.payouts.$id.tsx` | NEW |
| `src/lib/server/admin/donations.server.ts` | NEW |
| `src/routes/admin.donations.tsx` | NEW |
| `src/routes/admin.donations.$id.tsx` | NEW |
| `src/routes/admin.audit-log.tsx` | NEW |
| `src/routes/admin.settings.tsx` | NEW |

---

# Part 4 — Charity group dashboard

Files added: ~13 (1 layout, ~6 route files, 5 server modules, 1 component). Modifies `routes/index.tsx` and `donations.functions.ts` to use the new `campaign_status` enum (the existing code uses `status: string`).

**Critical design points:**
- New campaigns are created with `status = 'submitted'` (per the revised moderation-queue decision). Admins publish via the Part 3 admin UI.
- Charity groups can NEVER see or touch other charities' data. Every server-fn verifies ownership via `charity_groups.user_id = auth.uid()`.
- Balances are always derived from `ledger_entries` via the `get_charity_balances` SQL function from Part 1. No client-side math.
- The charity's role check happens in route loaders, not just hidden in the UI.

---

## Task 4.1: Authed context server-fn

**Files:**
- Create: `src/lib/server/authed-context.server.ts`

**Step 1: Write the helper**

`src/lib/server/authed-context.server.ts`:

```typescript
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface AuthedContext {
  userId: string;
  displayName: string;
  role: "user" | "charity_group" | "admin";
  charityGroupId: string | null;
}

/**
 * Resolves the full authed context for the current request: userId, role,
 * and (if the user is a charity_group) the charity_groups.id they own.
 *
 * Used by every route under /charity/* and /dashboard/* in their loader.
 */
export async function resolveAuthedContext(userId: string): Promise<AuthedContext> {
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const role = (roleRow?.role ?? "user") as AuthedContext["role"];

  let displayName = "مستخدم";
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name, email")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.name) displayName = profile.name;
  else if (profile?.email) displayName = profile.email;

  let charityGroupId: string | null = null;
  if (role === "charity_group") {
    const { data: cg } = await supabaseAdmin
      .from("charity_groups")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    charityGroupId = cg?.id ?? null;
  }

  return { userId, displayName, role, charityGroupId };
}
```

**Step 2: Commit**

```bash
git add src/lib/server/authed-context.server.ts
git commit -m "feat(charity): authed context resolver"
```

---

## Task 4.2: Charity guard + dashboard server-fn

**Files:**
- Create: `src/lib/server/charity/guard.server.ts`
- Create: `src/lib/server/charity/dashboard.server.ts`

**Step 1: Write the charity guard**

`src/lib/server/charity/guard.server.ts`:

```typescript
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveAuthedContext } from "@/lib/server/authed-context.server";

/**
 * Ensures the caller is a charity_group and returns their charity_groups.id.
 * Throws if not.
 */
export async function requireCharityGroup(userId: string): Promise<string> {
  const ctx = await resolveAuthedContext(userId);
  if (ctx.role !== "charity_group" || !ctx.charityGroupId) {
    const e: Error & { status?: number } = new Error("Not found");
    e.status = 404;
    throw e;
  }
  // Verify the charity is still verified and approved
  const { data: cg } = await supabaseAdmin
    .from("charity_groups")
    .select("status, verified")
    .eq("id", ctx.charityGroupId)
    .maybeSingle();
  if (!cg || !cg.verified || cg.status !== "approved") {
    const e: Error & { status?: number } = new Error("Not found");
    e.status = 404;
    throw e;
  }
  return ctx.charityGroupId;
}
```

**Step 2: Write the dashboard server-fn**

`src/lib/server/charity/dashboard.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCharityGroup } from "@/lib/server/charity/guard.server";
import { resolveAuthedContext } from "@/lib/server/authed-context.server";

const input = z.object({});

export const getCharityDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const db = supabaseAdmin;

    const { data: balances } = await db.rpc("get_charity_balances", {
      _charity_group_id: charityGroupId,
    });

    const { data: recentCampaigns } = await db
      .from("campaigns")
      .select("id, title, slug, status, goal_amount, raised_amount, donor_count, cover_image, created_at")
      .eq("charity_group_id", charityGroupId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentLedger } = await db
      .from("ledger_entries")
      .select("id, type, amount, currency, reference, created_at, campaigns(title)")
      .eq("charity_group_id", charityGroupId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: cg } = await db
      .from("charity_groups")
      .select("id, name, slug, description, logo_url, category, wilaya, verified, verified_at")
      .eq("id", charityGroupId)
      .maybeSingle();

    return {
      charity: cg,
      balances: (balances as any) ?? {
        totalRaisedDzd: 0,
        totalPaidDzd: 0,
        availableBalanceDzd: 0,
        pendingBalanceDzd: 0,
        campaignCount: 0,
        donorCount: 0,
        donationCount: 0,
      },
      recentCampaigns: recentCampaigns ?? [],
      recentLedger: recentLedger ?? [],
    };
  });

export const getMyCharityGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const ctx = await resolveAuthedContext(userId);
    if (!ctx.charityGroupId) return null;
    const { data: cg } = await supabaseAdmin
      .from("charity_groups")
      .select("id, name, slug, description, logo_url, category, wilaya, verified, verified_at, status")
      .eq("id", ctx.charityGroupId)
      .maybeSingle();
    return cg;
  });
```

**Step 3: Commit**

```bash
git add src/lib/server/charity/guard.server.ts src/lib/server/charity/dashboard.server.ts
git commit -m "feat(charity): guard, dashboard server-fn, getMyCharityGroup"
```

---

## Task 4.3: Balance card component

**Files:**
- Create: `src/components/hamla/balance-card.tsx`

**Step 1: Write the component**

`src/components/hamla/balance-card.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDZD } from "@/lib/format";
import { Wallet, TrendingUp, Hourglass, Users, Heart, ListChecks } from "lucide-react";

export interface CharityBalances {
  totalRaisedDzd: number;
  totalPaidDzd: number;
  availableBalanceDzd: number;
  pendingBalanceDzd: number;
  campaignCount: number;
  donorCount: number;
  donationCount: number;
}

export function BalanceGrid({ balances }: { balances: CharityBalances }) {
  const cards: { title: string; value: string; icon: React.ReactNode; tone: string }[] = [
    {
      title: "إجمالي التبرعات",
      value: formatDZD(balances.totalRaisedDzd),
      icon: <TrendingUp className="size-5" />,
      tone: "text-primary-strong",
    },
    {
      title: "الرصيد المتاح للسحب",
      value: formatDZD(balances.availableBalanceDzd),
      icon: <Wallet className="size-5" />,
      tone: "text-primary-strong",
    },
    {
      title: "السحوبات المعلقة",
      value: formatDZD(balances.pendingBalanceDzd),
      icon: <Hourglass className="size-5" />,
      tone: "text-highlight",
    },
    {
      title: "الحملات",
      value: balances.campaignCount.toString(),
      icon: <ListChecks className="size-5" />,
      tone: "text-foreground",
    },
    {
      title: "المتبرعون",
      value: balances.donorCount.toString(),
      icon: <Users className="size-5" />,
      tone: "text-foreground",
    },
    {
      title: "عدد التبرعات",
      value: balances.donationCount.toString(),
      icon: <Heart className="size-5" />,
      tone: "text-foreground",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-subtle-foreground">{c.title}</CardTitle>
            <span className={c.tone}>{c.icon}</span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/hamla/balance-card.tsx
git commit -m "feat(charity): balance card grid component"
```

---

## Task 4.4: Charity layout /charity

**Files:**
- Create: `src/routes/charity.tsx`

**Step 1: Write the layout**

`src/routes/charity.tsx`:

```typescript
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wallet, ListChecks, BarChart3, User2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getMyCharityGroup } from "@/lib/server/charity/dashboard.server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/charity")({
  beforeLoad: async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw redirect({ to: "/" });
  },
  component: CharityLayoutShell,
});

function CharityLayoutShell() {
  const { user, loading: authLoading } = useAuth();
  const fetch = useServerFn(getMyCharityGroup);
  const { location } = (() => ({ location: window.location.pathname }))();

  const q = useQuery({
    queryKey: ["my-charity-group"],
    queryFn: () => fetch({ data: {} }),
    enabled: Boolean(user),
  });

  if (authLoading || (user && q.isPending)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <NotFound />;
  if (!q.data || !q.data.verified) return <NotFound />;

  const links = [
    { to: "/charity", label: "لوحة التحكم", icon: ListChecks },
    { to: "/charity/campaigns", label: "حملاتي", icon: ListChecks },
    { to: "/charity/payouts", label: "السحوبات", icon: Wallet },
    { to: "/charity/profile", label: "الملف الشخصي", icon: User2 },
  ];

  return (
    <div className="flex min-h-screen bg-secondary">
      <aside className="hidden w-60 shrink-0 border-l border-border bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <span className="grid size-9 place-items-center rounded-md bg-primary-soft text-primary-strong">
            <BarChart3 className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold truncate">{q.data.name}</p>
            <p className="text-[10px] text-subtle-foreground">لوحة الجمعية</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2 text-sm">
          {links.map((l) => {
            const active = location === l.to;
            const Icon = l.icon;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 transition-colors",
                  active ? "bg-primary-soft text-primary-strong" : "text-foreground/80 hover:bg-accent",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {l.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur">
          <p className="text-sm font-semibold">لوحة تحكم الجمعية</p>
        </header>
        <main className="flex-1 overflow-x-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="mt-1 text-sm text-subtle-foreground">الصفحة غير موجودة</p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/routes/charity.tsx
git commit -m "feat(charity): /charity layout with role-gated sidebar"
```

---

## Task 4.5: /charity dashboard page

**Files:**
- Create: `src/routes/charity.index.tsx`

**Step 1: Write the dashboard page**

`src/routes/charity.index.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceGrid } from "@/components/hamla/balance-card";
import { CAMPAIGN_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { getCharityDashboard } from "@/lib/server/charity/dashboard.server";

export const Route = createFileRoute("/charity/")({
  head: () => ({ meta: [{ title: "لوحة تحكم الجمعية | حملة" }] }),
  component: CharityDashboardPage,
});

const ledgerTypeLabels: Record<string, string> = {
  donation: "تبرع",
  payment_fee: "رسوم دفع",
  platform_fee: "رسوم منصة",
  refund: "استرداد",
  payout: "سحب",
  payout_fee: "رسوم سحب",
  adjustment: "تعديل",
};

function CharityDashboardPage() {
  const fetch = useServerFn(getCharityDashboard);
  const q = useQuery({
    queryKey: ["charity-dashboard"],
    queryFn: () => fetch({ data: {} }),
  });

  if (q.isPending) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }
  if (q.isError || !q.data) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>;
  }
  const { charity, balances, recentCampaigns, recentLedger } = q.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">مرحباً، {charity?.name}</h1>
          <p className="text-sm text-subtle-foreground">إليك نظرة سريعة على حملاتك وأموالك.</p>
        </div>
        <Button asChild>
          <Link to="/charity/campaigns/new">
            <Plus className="size-4" /> إنشاء حملة
          </Link>
        </Button>
      </div>

      <BalanceGrid balances={balances} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>آخر الحملات</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/charity/campaigns">عرض الكل</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCampaigns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-subtle-foreground">
                لم تنشئ أي حملة بعد.
              </div>
            ) : (
              recentCampaigns.map((c) => {
                const sb = CAMPAIGN_STATUS_BADGE[c.status] ?? { label: c.status, kind: "info" as const };
                return (
                  <Link
                    key={c.id}
                    to="/charity/campaigns/$id"
                    params={{ id: c.id }}
                    className="block rounded-lg border border-border p-3 hover:bg-secondary"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{c.title}</p>
                      <StatusBadge label={sb.label} kind={sb.kind} />
                    </div>
                    <p className="mt-1 text-xs text-subtle-foreground">
                      {formatDZD(Number(c.raised_amount))} من {formatDZD(Number(c.goal_amount))} · {c.donor_count} متبرع
                    </p>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>النشاط المالي الأخير</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/charity/payouts">السحوبات</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLedger.length === 0 ? (
              <p className="text-sm text-subtle-foreground">لا يوجد نشاط بعد.</p>
            ) : (
              recentLedger.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{ledgerTypeLabels[l.type] ?? l.type}</p>
                    <p className="text-xs text-subtle-foreground">{formatDate(l.created_at)}</p>
                  </div>
                  <p className={`font-mono ${Number(l.amount) >= 0 ? "text-primary-strong" : "text-destructive"}`}>
                    {Number(l.amount) >= 0 ? "+" : ""}
                    {formatDZD(Number(l.amount))}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/routes/charity.index.tsx
git commit -m "feat(charity): dashboard with balance grid, recent campaigns, recent ledger"
```

---

## Task 4.6: /charity/campaigns list + detail + server-fns

**Files:**
- Create: `src/lib/server/charity/campaigns.server.ts`
- Create: `src/routes/charity.campaigns.tsx`
- Create: `src/routes/charity.campaigns.$id.tsx`

**Step 1: Server-fns**

`src/lib/server/charity/campaigns.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCharityGroup } from "@/lib/server/charity/guard.server";
import { CAMPAIGN_IMAGES_BUCKET } from "@/lib/storage-paths";

const listInput = z.object({});

export const listMyCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const { data: rows, error } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, slug, status, goal_amount, raised_amount, donor_count, cover_image, certified, created_at")
      .eq("charity_group_id", charityGroupId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل الحملات.");
    return rows ?? [];
  });

const idInput = z.object({ id: z.string().uuid() });

export const getMyCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const { data: c, error } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, slug, description, story, status, certified, goal_amount, raised_amount, donor_count, cover_image, category, location, beneficiary, created_at, updated_at")
      .eq("id", data.id)
      .eq("charity_group_id", charityGroupId)
      .maybeSingle();
    if (error || !c) throw new Error("الحملة غير موجودة.");
    const { data: donations } = await supabaseAdmin
      .from("donations")
      .select("id, reference, amount, donor_name, anonymous, status, created_at, paid_at")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return { campaign: c, donations: donations ?? [] };
  });

const createInput = z.object({
  title: z.string().min(5).max(120),
  slug: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().min(50).max(280),
  story: z.string().min(200).max(8000),
  beneficiary: z.string().min(2).max(120),
  category: z.enum(["education", "health", "family", "emergency", "orphan", "mosque", "other"]),
  wilaya: z.string().min(1),
  location: z.string().min(2).max(120),
  goalAmount: z.number().int().min(10000).max(50_000_000),
  coverImagePath: z.string().nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const createMyCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);

    const { data: existing } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (existing) throw new Error("هذا الـ slug مستخدم بالفعل. اختر slug آخر.");

    const { data: row, error } = await supabaseAdmin
      .from("campaigns")
      .insert({
        title: data.title,
        slug: data.slug,
        description: data.description,
        story: data.story,
        beneficiary: data.beneficiary,
        category: data.category,
        location: data.location,
        goal_amount: data.goalAmount,
        cover_image: data.coverImagePath ?? null,
        charity_group_id: charityGroupId,
        status: "submitted",
        currency: "DZD",
        organizer_name: "(from charity_group)",
      })
      .select("id, slug")
      .single();
    if (error || !row) throw new Error("تعذر إنشاء الحملة.");
    return { id: row.id, slug: row.slug };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(5).max(120).optional(),
  description: z.string().min(50).max(280).optional(),
  story: z.string().min(200).max(8000).optional(),
});

export const updateMyCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update(patch)
      .eq("id", id)
      .eq("charity_group_id", charityGroupId);
    if (error) throw new Error("تعذر تحديث الحملة.");
    return { ok: true };
  });

const statusInput = z.object({ id: z.string().uuid(), to: z.enum(["paused", "published"]) });

export const setMyCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => statusInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    // Only "paused" allowed for charity self-service. "published" requires admin
    // (campaigns enter as "submitted" and wait for admin approval).
    if (data.to === "published") {
      throw new Error("لا يمكن للجمعية نشر الحملة مباشرة. انتظر موافقة الإدارة.");
    }
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ status: data.to })
      .eq("id", data.id)
      .eq("charity_group_id", charityGroupId);
    if (error) throw new Error("تعذر تغيير حالة الحملة.");
    return { ok: true };
  });

const coverInput = z.object({
  campaignId: z.string().uuid(),
  storagePath: z.string().min(8).max(500),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
});

/**
 * Charity uploads a cover image to campaign-images bucket, then submits the
 * path to this server-fn which moves the file from draft/ to the campaign
 * folder and writes cover_image.
 */
export const attachCoverImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => coverInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    // Probe that the storage object exists by attempting copy
    const probe = `campaigns/${charityGroupId}/_probe/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { error: probeError } = await supabaseAdmin.storage
      .from(CAMPAIGN_IMAGES_BUCKET)
      .copy(data.storagePath, probe);
    if (probeError) throw new Error("تعذر التحقق من الصورة المرفوعة.");
    await supabaseAdmin.storage.from(CAMPAIGN_IMAGES_BUCKET).remove([probe]);
    // Move the file to the canonical location
    const ext = data.storagePath.slice(data.storagePath.lastIndexOf("."));
    const finalPath = `campaigns/${charityGroupId}/${data.campaignId}/cover${ext}`;
    const { error: moveError } = await supabaseAdmin.storage
      .from(CAMPAIGN_IMAGES_BUCKET)
      .move(data.storagePath, finalPath);
    if (moveError) throw new Error("تعذر نقل الصورة.");
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ cover_image: finalPath })
      .eq("id", data.campaignId)
      .eq("charity_group_id", charityGroupId);
    if (error) throw new Error("تعذر حفظ الصورة.");
    return { ok: true, coverImage: finalPath };
  });
```

**Step 2: Campaigns list page**

`src/routes/charity.campaigns.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CAMPAIGN_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { listMyCampaigns } from "@/lib/server/charity/campaigns.server";

export const Route = createFileRoute("/charity/campaigns")({
  head: () => ({ meta: [{ title: "حملاتي | حملة" }] }),
  component: MyCampaignsPage,
});

function MyCampaignsPage() {
  const fetch = useServerFn(listMyCampaigns);
  const q = useQuery({
    queryKey: ["my-campaigns"],
    queryFn: () => fetch({ data: {} }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">حملاتي</h1>
        <Button asChild>
          <Link to="/charity/campaigns/new">
            <Plus className="size-4" /> إنشاء حملة
          </Link>
        </Button>
      </div>

      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError || !q.data ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>
      ) : q.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-subtle-foreground">لم تنشئ أي حملة بعد.</p>
          <Button asChild className="mt-4">
            <Link to="/charity/campaigns/new">إنشاء أول حملة</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {q.data.map((c) => {
            const sb = CAMPAIGN_STATUS_BADGE[c.status] ?? { label: c.status, kind: "info" as const };
            return (
              <Link
                key={c.id}
                to="/charity/campaigns/$id"
                params={{ id: c.id }}
                className="block rounded-2xl border border-border bg-card p-4 transition hover:bg-secondary"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{c.title}</p>
                    <p className="mt-1 text-xs text-subtle-foreground">
                      {formatDZD(Number(c.raised_amount))} من {formatDZD(Number(c.goal_amount))} · {c.donor_count} متبرع · أُنشئت في {formatDate(c.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.certified ? <StatusBadge label="موثقة" kind="ok" /> : null}
                    <StatusBadge label={sb.label} kind={sb.kind} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Campaign management page**

`src/routes/charity.campaigns.$id.tsx`:

```typescript
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pause, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CAMPAIGN_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { getMyCampaign, setMyCampaignStatus } from "@/lib/server/charity/campaigns.server";

export const Route = createFileRoute("/charity/campaigns/$id")({
  head: () => ({ meta: [{ title: "إدارة حملة | حملة" }] }),
  component: MyCampaignPage,
});

function MyCampaignPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const fetch = useServerFn(getMyCampaign);
  const setStatus = useServerFn(setMyCampaignStatus);

  const q = useQuery({
    queryKey: ["my-campaign", id],
    queryFn: () => fetch({ data: { id } }),
  });
  const pauseMut = useMutation({
    mutationFn: () => setStatus({ data: { id, to: "paused" } }),
    onSuccess: () => { toast.success("تم إيقاف الحملة مؤقتاً."); void qc.invalidateQueries({ queryKey: ["my-campaign", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const resumeMut = useMutation({
    mutationFn: () => setStatus({ data: { id, to: "published" } }),
    onSuccess: () => { toast.success("تمت إعادة التفعيل."); void qc.invalidateQueries({ queryKey: ["my-campaign", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) return <Skeleton className="h-64 w-full" />;
  if (q.isError || !q.data) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>;
  const c: any = q.data.campaign;
  const donations = q.data.donations;
  const sb = CAMPAIGN_STATUS_BADGE[c.status] ?? { label: c.status, kind: "info" as const };
  const isPublished = c.status === "published";
  const isPaused = c.status === "paused";
  const isSubmitted = c.status === "submitted";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/charity/campaigns" className="text-xs text-subtle-foreground hover:underline">← العودة</Link>
          <h1 className="mt-1 text-2xl font-bold">{c.title}</h1>
          <p className="text-sm text-subtle-foreground">slug: <span className="font-mono">{c.slug}</span></p>
        </div>
        <div className="flex items-center gap-2">
          {c.certified ? <StatusBadge label="موثقة" kind="ok" /> : null}
          <StatusBadge label={sb.label} kind={sb.kind} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>المعلومات</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="الهدف" value={formatDZD(Number(c.goal_amount))} />
          <Row label="المُجمَّع" value={formatDZD(Number(c.raised_amount))} />
          <Row label="المتبرعون" value={String(c.donor_count)} />
          <Row label="الفئة" value={c.category ?? "—"} />
          <Row label="الولاية / الموقع" value={c.location ?? "—"} />
          <Row label="تاريخ الإنشاء" value={formatDate(c.created_at)} />
        </CardContent>
      </Card>

      {isSubmitted ? (
        <div className="rounded-2xl border border-highlight bg-highlight-soft p-4 text-sm text-highlight-foreground">
          حملتك قيد المراجعة من قبل إدارة حملة. سيتم إخطارك فور اتخاذ القرار.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isPublished || isPaused ? (
          isPublished ? (
            <Button variant="outline" onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending}>
              {pauseMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />} إيقاف مؤقت
            </Button>
          ) : (
            <Button onClick={() => resumeMut.mutate()} disabled={resumeMut.isPending}>
              {resumeMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} إعادة التفعيل
            </Button>
          )
        ) : null}
      </div>

      <Card>
        <CardHeader><CardTitle>آخر التبرعات</CardTitle></CardHeader>
        <CardContent>
          {donations.length === 0 ? (
            <p className="text-sm text-subtle-foreground">لا توجد تبرعات بعد.</p>
          ) : (
            <ul className="divide-y divide-border">
              {donations.map((d: any) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{d.anonymous ? "متبرع مجهول" : (d.donor_name ?? "—")}</p>
                    <p className="font-mono text-[10px] text-subtle-foreground">{d.reference}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-mono">{formatDZD(Number(d.amount))}</p>
                    <p className="text-[10px] text-subtle-foreground">{formatDate(d.paid_at ?? d.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="shrink-0 text-subtle-foreground">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/server/charity/campaigns.server.ts src/routes/charity.campaigns.tsx 'src/routes/charity.campaigns.$id.tsx'
git commit -m "feat(charity): campaigns list, management page, server-fns (create/update/pause/resume/cover)"
```

---

## Task 4.7: /charity/campaigns/new 4-step creation wizard

**Files:**
- Create: `src/components/hamla/campaign-preview.tsx`
- Create: `src/routes/charity.campaigns.new.tsx`

**Step 1: Campaign preview component**

`src/components/hamla/campaign-preview.tsx`:

```typescript
import { BadgeCheck, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDZD, progressPercent } from "@/lib/format";

export interface CampaignPreviewData {
  title: string;
  description: string;
  story: string;
  beneficiary: string;
  category: string;
  wilaya: string;
  location: string;
  goalAmount: number;
  coverImage: string | null;
}

export function CampaignPreview({ data }: { data: CampaignPreviewData }) {
  const percent = progressPercent(0, data.goalAmount);
  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {data.category ? <Badge variant="secondary">{data.category}</Badge> : null}
        {data.wilaya ? (
          <span className="inline-flex items-center gap-1 text-subtle-foreground">
            <MapPin className="size-3.5" /> {data.wilaya}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 text-subtle-foreground">
          <BadgeCheck className="size-3.5 text-primary-strong" /> معاينة فقط
        </span>
      </div>
      <h1 className="text-2xl font-bold">{data.title || "(بدون عنوان)"}</h1>
      <p className="text-sm leading-loose text-foreground/85">{data.description}</p>
      <div className="rounded-xl bg-secondary p-4 text-sm">
        <p>
          <span className="text-subtle-foreground">المستفيد: </span>
          <span className="font-medium">{data.beneficiary || "—"}</span>
        </p>
        <p className="mt-1">
          <span className="text-subtle-foreground">الموقع: </span>
          <span className="font-medium">{data.location || "—"}</span>
        </p>
      </div>
      <div>
        <p className="text-2xl font-bold">
          {formatDZD(0)}{" "}
          <span className="text-sm font-normal text-subtle-foreground">
            تم جمعها من أصل {formatDZD(data.goalAmount)}
          </span>
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary-strong" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="prose story-prose max-w-none whitespace-pre-wrap text-sm leading-loose">
        {data.story || "(لم تُكتب القصة بعد)"}
      </div>
    </article>
  );
}
```

**Step 2: Wizard page**

`src/routes/charity.campaigns.new.tsx`:

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, Upload } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { CampaignPreview } from "@/components/hamla/campaign-preview";
import { WilayaSelect } from "@/components/hamla/wilaya-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ALLOWED_IMAGE_MIME,
  CAMPAIGN_IMAGES_BUCKET,
  MAX_IMAGE_BYTES,
} from "@/lib/storage-paths";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createMyCampaign, attachCoverImage } from "@/lib/server/charity/campaigns.server";

export const Route = createFileRoute("/charity/campaigns/new")({
  head: () => ({ meta: [{ title: "إنشاء حملة | حملة" }] }),
  component: NewCampaignPage,
});

const formSchema = z.object({
  title: z.string().min(5, "العنوان قصير جداً").max(120),
  slug: z.string().min(3, "الـ slug قصير جداً").max(120).regex(/^[a-z0-9-]+$/, "الـ slug يجب أن يكون بالإنجليزية الصغيرة والأرقام والشرطات فقط"),
  description: z.string().min(50, "الوصف يجب أن يكون 50 حرفاً على الأقل").max(280),
  story: z.string().min(200, "القصة يجب أن تكون 200 حرف على الأقل").max(8000),
  beneficiary: z.string().min(2, "أدخل المستفيد").max(120),
  category: z.enum(["education", "health", "family", "emergency", "orphan", "mosque", "other"]),
  wilaya: z.string().min(1, "اختر الولاية"),
  location: z.string().min(2, "أدخل الموقع").max(120),
  goalAmount: z.coerce.number().int().min(10000, "الحد الأدنى 10,000 دج").max(50_000_000),
  coverImagePath: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const categoryLabels: Record<FormValues["category"], string> = {
  education: "تعليم",
  health: "صحة",
  family: "أسر وعائلات",
  emergency: "طوارئ",
  orphan: "أيتام",
  mosque: "مساجد ودور عبادة",
  other: "أخرى",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function NewCampaignPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const create = useServerFn(createMyCampaign);
  const attach = useServerFn(attachCoverImage);

  const [step, setStep] = useState(1);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const { register, handleSubmit, formState, setValue, watch, getValues } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      story: "",
      beneficiary: "",
      category: "other",
      wilaya: "",
      location: "",
      goalAmount: 100000,
      coverImagePath: null,
    },
  });
  const titleVal = watch("title");

  const submitMut = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user) throw new Error("يجب تسجيل الدخول.");
      const { id, slug } = await create({ data: values });
      if (values.coverImagePath) {
        await attach({
          data: {
            campaignId: id,
            storagePath: values.coverImagePath,
            mimeType: "image/jpeg",
            sizeBytes: 1,
          },
        });
      }
      return { id, slug };
    },
    onSuccess: (res) => {
      toast.success("تم إنشاء الحملة. ستدخل في المراجعة.");
      void navigate({ to: "/charity/campaigns/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onTitleBlur() {
    const v = getValues();
    if (!v.slug && v.title) setValue("slug", slugify(v.title));
  }

  async function onCoverChange(file: File) {
    setCoverFile(file);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(file));
    if (!user) return;
    const path = `campaigns/__draft__/${user.id}/${crypto.randomUUID()}`;
    const { error } = await supabase.storage
      .from(CAMPAIGN_IMAGES_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      toast.error(`تعذر رفع الصورة: ${error.message}`);
      return;
    }
    setValue("coverImagePath", path, { shouldValidate: true });
  }

  const canAdvance = (s: number): boolean => {
    const v = getValues();
    if (s === 1) return Boolean(v.title && v.slug && v.description && v.beneficiary && v.category && v.wilaya && v.location);
    if (s === 2) return v.story.length >= 200;
    if (s === 3) return v.goalAmount >= 10000;
    return true;
  };

  const data = watch();

  return (
    <div className="min-h-screen bg-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold">إنشاء حملة جديدة</h1>
        <p className="mt-1 text-sm text-subtle-foreground">
          أكمل الخطوات الأربع. حملتك ستدخل في المراجعة قبل النشر.
        </p>

        <ol className="mt-6 flex flex-wrap gap-2 text-xs">
          {[1, 2, 3, 4].map((n) => (
            <li
              key={n}
              className={`rounded-full px-3 py-1 ${step === n ? "bg-primary text-primary-foreground" : "bg-card text-subtle-foreground"}`}
            >
              {n}. {["معلومات الحملة", "القصة", "المعلومات المالية", "المراجعة"][n - 1]}
            </li>
          ))}
        </ol>

        <Card className="mt-6">
          <CardContent className="p-6">
            {step === 1 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">معلومات الحملة</h2>
                <div>
                  <Label htmlFor="title">العنوان</Label>
                  <Input id="title" {...register("title", { onBlur: onTitleBlur })} />
                  {formState.errors.title ? <p className="mt-1 text-xs text-destructive">{formState.errors.title.message}</p> : null}
                </div>
                <div>
                  <Label htmlFor="slug">الـ slug (يظهر في الرابط)</Label>
                  <Input id="slug" {...register("slug")} />
                  {formState.errors.slug ? <p className="mt-1 text-xs text-destructive">{formState.errors.slug.message}</p> : null}
                  {titleVal && !getValues("slug") ? (
                    <p className="mt-1 text-xs text-subtle-foreground">سيُولَّد تلقائياً من العنوان.</p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="description">الوصف المختصر (يظهر في بطاقة الحملة)</Label>
                  <Textarea id="description" rows={3} {...register("description")} />
                  {formState.errors.description ? <p className="mt-1 text-xs text-destructive">{formState.errors.description.message}</p> : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="category">الفئة</Label>
                    <select
                      id="category"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      {...register("category")}
                    >
                      {Object.entries(categoryLabels).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="wilaya">الولاية</Label>
                    <WilayaSelect
                      id="wilaya"
                      value={watch("wilaya")}
                      onChange={(v) => setValue("wilaya", v, { shouldValidate: true })}
                    />
                    {formState.errors.wilaya ? <p className="mt-1 text-xs text-destructive">{formState.errors.wilaya.message}</p> : null}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="location">الموقع (البلدية أو المدينة)</Label>
                    <Input id="location" {...register("location")} />
                    {formState.errors.location ? <p className="mt-1 text-xs text-destructive">{formState.errors.location.message}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="beneficiary">المستفيد</Label>
                    <Input id="beneficiary" {...register("beneficiary")} />
                    {formState.errors.beneficiary ? <p className="mt-1 text-xs text-destructive">{formState.errors.beneficiary.message}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">القصة الكاملة</h2>
                <p className="text-sm text-subtle-foreground">
                  اشرح بالتفصيل为什么要 هذه الحملة، من المستفيد، وكيف ستُستخدم التبرعات.
                </p>
                <Textarea rows={12} {...register("story")} />
                {formState.errors.story ? <p className="mt-1 text-xs text-destructive">{formState.errors.story.message}</p> : null}
                <p className="text-xs text-subtle-foreground">{watch("story").length} / 8000 حرف</p>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">المعلومات المالية والغلاف</h2>
                <div>
                  <Label htmlFor="goalAmount">مبلغ الهدف (دج)</Label>
                  <Input id="goalAmount" type="number" {...register("goalAmount")} />
                  {formState.errors.goalAmount ? <p className="mt-1 text-xs text-destructive">{formState.errors.goalAmount.message}</p> : null}
                </div>
                <div>
                  <Label>صورة الغلاف</Label>
                  {coverPreview ? (
                    <img src={coverPreview} alt="" className="aspect-video w-full max-w-md rounded-xl border border-border object-cover" />
                  ) : (
                    <div className="flex aspect-video w-full max-w-md items-center justify-center rounded-xl border border-dashed border-border bg-secondary text-subtle-foreground">
                      <ImageIcon className="size-10" />
                    </div>
                  )}
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                    <Upload className="size-4" />
                    {coverFile ? "تغيير الصورة" : "رفع صورة"}
                    <input
                      type="file"
                      accept={Array.from(ALLOWED_IMAGE_MIME).join(",")}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          if (f.size > MAX_IMAGE_BYTES) {
                            toast.error("الصورة كبيرة جداً.");
                            return;
                          }
                          void onCoverChange(f);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">المراجعة</h2>
                <p className="text-sm text-subtle-foreground">
                  هذا ما سيراه المتبرعون. ستدخل حملتك في المراجعة قبل النشر.
                </p>
                <CampaignPreview
                  data={{
                    title: watch("title"),
                    description: watch("description"),
                    story: watch("story"),
                    beneficiary: watch("beneficiary"),
                    category: categoryLabels[watch("category")],
                    wilaya: watch("wilaya"),
                    location: watch("location"),
                    goalAmount: Number(watch("goalAmount")),
                    coverImage: coverPreview,
                  }}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ChevronRight className="size-4" /> السابق
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance(step)}>
              التالي <ChevronLeft className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit((v) => submitMut.mutate(v))}
              disabled={submitMut.isPending}
            >
              {submitMut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              إرسال للمراجعة
            </Button>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/hamla/campaign-preview.tsx src/routes/charity.campaigns.new.tsx
git commit -m "feat(charity): 4-step campaign creation wizard with cover upload and live preview"
```

---

## Task 4.8: /charity/payouts list + new request form

**Files:**
- Create: `src/lib/server/charity/payouts.server.ts`
- Create: `src/routes/charity.payouts.tsx`
- Create: `src/routes/charity.payouts.new.tsx`

**Step 1: Server-fns**

`src/lib/server/charity/payouts.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCharityGroup } from "@/lib/server/charity/guard.server";

const listInput = z.object({});

export const listMyPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const { data: rows, error } = await supabaseAdmin
      .from("payouts")
      .select("id, amount, currency, status, destination, requested_at, paid_at, rejection_reason, external_reference")
      .eq("charity_group_id", charityGroupId)
      .order("requested_at", { ascending: false });
    if (error) throw new Error("تعذر تحميل السحوبات.");
    return rows ?? [];
  });

const destinationSchema = z.object({
  method: z.enum(["ccp", "bank", "baridimob"]),
  account_name: z.string().min(2).max(120),
  account_number: z.string().min(4).max(40),
  bank_name: z.string().optional(),
  rib: z.string().optional(),
  phone: z.string().optional(),
}).refine(
  (d) => d.method !== "ccp" || (d.account_number.length >= 4 && d.account_name.length >= 2),
  { message: "بيانات CCP ناقصة" },
).refine(
  (d) => d.method !== "bank" || (d.bank_name && d.rib && d.account_number.length >= 4),
  { message: "بيانات التحويل البنكي ناقصة" },
).refine(
  (d) => d.method !== "baridimob" || (d.phone && /^0(5|6|7)[0-9]{8}$/.test(d.phone)),
  { message: "رقم BaridimMob غير صالح" },
);

const requestInput = z.object({
  amount: z.number().int().min(1000),
  destination: destinationSchema,
});

export const requestMyPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => requestInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const charityGroupId = await requireCharityGroup(userId);
    const { data: payoutId, error } = await supabaseAdmin.rpc("request_payout", {
      _charity_group_id: charityGroupId,
      _amount: data.amount,
      _currency: "DZD",
      _destination: data.destination,
    });
    if (error) throw new Error(error.message || "تعذر إنشاء طلب السحب.");
    return { payoutId };
  });
```

**Step 2: Payouts list page**

`src/routes/charity.payouts.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PAYOUT_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { listMyPayouts } from "@/lib/server/charity/payouts.server";

export const Route = createFileRoute("/charity/payouts")({
  head: () => ({ meta: [{ title: "السحوبات | حملة" }] }),
  component: MyPayoutsPage,
});

function MyPayoutsPage() {
  const fetch = useServerFn(listMyPayouts);
  const q = useQuery({
    queryKey: ["my-payouts"],
    queryFn: () => fetch({ data: {} }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">السحوبات</h1>
        <Button asChild>
          <Link to="/charity/payouts/new"><Plus className="size-4" /> طلب سحب جديد</Link>
        </Button>
      </div>

      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError || !q.data ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>
      ) : q.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-subtle-foreground">لم تطلب أي سحب بعد.</p>
          <Button asChild className="mt-4">
            <Link to="/charity/payouts/new">اطلب سحباً</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs text-subtle-foreground">
              <tr>
                <th className="px-3 py-2 text-start font-medium">المبلغ</th>
                <th className="px-3 py-2 text-start font-medium">الطريقة</th>
                <th className="px-3 py-2 text-start font-medium">تاريخ الطلب</th>
                <th className="px-3 py-2 text-start font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((p) => {
                const sb = PAYOUT_STATUS_BADGE[p.status] ?? { label: p.status, kind: "info" as const };
                const dest = (p.destination as any) ?? {};
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-3 font-mono">{formatDZD(Number(p.amount))}</td>
                    <td className="px-3 py-3">
                      {dest.method === "ccp" ? "CCP" : dest.method === "bank" ? "بنك" : dest.method === "baridimob" ? "بريدي موب" : "—"}
                    </td>
                    <td className="px-3 py-3">{formatDate(p.requested_at)}</td>
                    <td className="px-3 py-3"><StatusBadge label={sb.label} kind={sb.kind} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Step 3: New payout request page**

`src/routes/charity.payouts.new.tsx`:

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDZD } from "@/lib/format";
import { getCharityDashboard } from "@/lib/server/charity/dashboard.server";
import { requestMyPayout } from "@/lib/server/charity/payouts.server";

export const Route = createFileRoute("/charity/payouts/new")({
  head: () => ({ meta: [{ title: "طلب سحب جديد | حملة" }] }),
  component: NewPayoutPage,
});

const formSchema = z.object({
  amount: z.coerce.number().int().min(1000, "الحد الأدنى 1,000 دج").max(50_000_000),
  method: z.enum(["ccp", "bank", "baridimob"]),
  account_name: z.string().min(2, "أدخل اسم صاحب الحساب").max(120),
  account_number: z.string().min(4, "أدخل رقم الحساب").max(40),
  bank_name: z.string().optional(),
  rib: z.string().optional(),
  phone: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.method === "ccp" && d.account_number.length < 4) {
    ctx.addIssue({ code: "custom", path: ["account_number"], message: "رقم CCP قصير" });
  }
  if (d.method === "bank") {
    if (!d.bank_name || d.bank_name.length < 2) {
      ctx.addIssue({ code: "custom", path: ["bank_name"], message: "أدخل اسم البنك" });
    }
    if (!d.rib || d.rib.length < 8) {
      ctx.addIssue({ code: "custom", path: ["rib"], message: "أدخل RIB صحيح" });
    }
  }
  if (d.method === "baridimob") {
    if (!d.phone || !/^0(5|6|7)[0-9]{8}$/.test(d.phone)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "رقم BaridimMob غير صالح" });
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

function NewPayoutPage() {
  const navigate = useNavigate();
  const fetchBalances = useServerFn(getCharityDashboard);
  const request = useServerFn(requestMyPayout);
  const balancesQ = useQuery({
    queryKey: ["charity-dashboard"],
    queryFn: () => fetchBalances({ data: {} }),
  });

  const { register, handleSubmit, formState, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      method: "ccp",
      account_name: "",
      account_number: "",
      bank_name: "",
      rib: "",
      phone: "",
    },
  });
  const method = watch("method");
  const amount = watch("amount");

  const submitMut = useMutation({
    mutationFn: (values: FormValues) => {
      const { amount, method, account_name, account_number, bank_name, rib, phone } = values;
      const destination: Record<string, string> = { method, account_name, account_number };
      if (method === "bank") {
        destination.bank_name = bank_name ?? "";
        destination.rib = rib ?? "";
      }
      if (method === "baridimob") destination.phone = phone ?? "";
      return request({ data: { amount, destination } });
    },
    onSuccess: () => {
      toast.success("تم إرسال طلب السحب. سيتم مراجعته من قبل الإدارة.");
      void navigate({ to: "/charity/payouts" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const available = balancesQ.data?.balances.availableBalanceDzd ?? 0;
  const overLimit = amount > available;

  return (
    <div className="min-h-screen bg-secondary">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold">طلب سحب جديد</h1>
        <p className="mt-1 text-sm text-subtle-foreground">سيتم مراجعة طلبك من قبل إدارة حملة.</p>

        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="rounded-xl bg-primary-soft p-4 text-sm">
              <p className="text-subtle-foreground">الرصيد المتاح للسحب</p>
              <p className="text-2xl font-bold text-primary-strong">{formatDZD(available)}</p>
            </div>

            <form onSubmit={handleSubmit((v) => submitMut.mutate(v))} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="amount">المبلغ (دج)</Label>
                <Input id="amount" type="number" {...register("amount")} />
                {overLimit ? <p className="mt-1 text-xs text-destructive">المبلغ يتجاوز الرصيد المتاح.</p> : null}
                {formState.errors.amount ? <p className="mt-1 text-xs text-destructive">{formState.errors.amount.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="method">طريقة السحب</Label>
                <select
                  id="method"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("method")}
                >
                  <option value="ccp">CCP</option>
                  <option value="bank">تحويل بنكي</option>
                  <option value="baridimob">بريدي موب</option>
                </select>
              </div>
              <div>
                <Label htmlFor="account_name">اسم صاحب الحساب</Label>
                <Input id="account_name" {...register("account_name")} />
                {formState.errors.account_name ? <p className="mt-1 text-xs text-destructive">{formState.errors.account_name.message}</p> : null}
              </div>
              {method === "ccp" ? (
                <div>
                  <Label htmlFor="account_number">رقم CCP</Label>
                  <Input id="account_number" {...register("account_number")} />
                  {formState.errors.account_number ? <p className="mt-1 text-xs text-destructive">{formState.errors.account_number.message}</p> : null}
                </div>
              ) : null}
              {method === "bank" ? (
                <>
                  <div>
                    <Label htmlFor="bank_name">اسم البنك</Label>
                    <Input id="bank_name" {...register("bank_name")} />
                    {formState.errors.bank_name ? <p className="mt-1 text-xs text-destructive">{formState.errors.bank_name.message}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="rib">RIB (24 رقم)</Label>
                    <Input id="rib" {...register("rib")} />
                    {formState.errors.rib ? <p className="mt-1 text-xs text-destructive">{formState.errors.rib.message}</p> : null}
                  </div>
                  <div>
                    <Label htmlFor="account_number">رقم الحساب</Label>
                    <Input id="account_number" {...register("account_number")} />
                  </div>
                </>
              ) : null}
              {method === "baridimob" ? (
                <div>
                  <Label htmlFor="phone">رقم الهاتف (BaridimMob)</Label>
                  <Input id="phone" inputMode="tel" {...register("phone")} />
                  {formState.errors.phone ? <p className="mt-1 text-xs text-destructive">{formState.errors.phone.message}</p> : null}
                </div>
              ) : null}
              <Button type="submit" disabled={submitMut.isPending || overLimit} className="w-full">
                {submitMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                إرسال الطلب
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/server/charity/payouts.server.ts src/routes/charity.payouts.tsx src/routes/charity.payouts.new.tsx
git commit -m "feat(charity): payouts list and new request form (CCP/Bank/Baridimob)"
```

---

## Task 4.9: /charity-profile/$slug public profile page

**Files:**
- Create: `src/lib/server/charity/public-profile.server.ts`
- Create: `src/routes/charity-profile.$slug.tsx`

**Step 1: Server-fn**

`src/lib/server/charity/public-profile.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { publicClient } from "@/lib/server/public-db.server";

const input = z.object({ slug: z.string().min(1).max(120) });

export const getPublicCharityBySlug = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }) => {
    const db = publicClient();
    const { data: cg, error } = await db
      .from("charity_groups")
      .select("id, name, slug, description, category, wilaya, logo_url, verified, verified_at")
      .eq("slug", data.slug)
      .eq("status", "approved")
      .eq("verified", true)
      .maybeSingle();
    if (error || !cg) throw new Error("الجمعية غير موجودة.");
    const { data: campaigns } = await db
      .from("campaigns")
      .select("id, title, slug, status, certified, goal_amount, raised_amount, donor_count, cover_image, created_at")
      .eq("charity_group_id", cg.id)
      .eq("status", "published")
      .order("created_at", { ascending: false });
    return { charity: cg, campaigns: campaigns ?? [] };
  });
```

**Step 2: Public profile page**

`src/routes/charity-profile.$slug.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, MapPin } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CAMPAIGN_STATUS_BADGE, StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { getPublicCharityBySlug } from "@/lib/server/charity/public-profile.server";

export const Route = createFileRoute("/charity-profile/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} | حملة` },
    ],
  }),
  component: PublicCharityProfilePage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="mt-1 text-sm text-subtle-foreground">الجمعية غير موجودة</p>
      </div>
    </div>
  ),
});

function PublicCharityProfilePage() {
  const { slug } = Route.useParams();
  const fetch = useServerFn(getPublicCharityBySlug);
  const q = useQuery({
    queryKey: ["public-charity", slug],
    queryFn: () => fetch({ data: { slug } }),
  });

  if (q.isPending) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="mt-4 h-24 w-full" />
        </main>
        <SiteFooter />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">الجمعية غير موجودة</h1>
        </main>
        <SiteFooter />
      </div>
    );
  }
  const { charity, campaigns } = q.data;
  const totalRaised = campaigns.reduce((acc, c) => acc + Number(c.raised_amount ?? 0), 0);
  const totalDonors = campaigns.reduce((acc, c) => acc + Number(c.donor_count ?? 0), 0);
  const active = campaigns.filter((c) => c.status === "published").length;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{charity.name}</h1>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-primary-strong">
                <BadgeCheck className="size-4" /> جهة موثقة من حملة
              </p>
              {charity.wilaya ? (
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-subtle-foreground">
                  <MapPin className="size-3.5" /> {charity.wilaya}
                </p>
              ) : null}
            </div>
          </div>
          {charity.description ? <p className="mt-4 leading-relaxed text-sm">{charity.description}</p> : null}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
          <Card><CardContent className="p-4"><p className="text-subtle-foreground">إجمالي مُجمَّع</p><p className="mt-1 text-xl font-bold">{formatDZD(totalRaised)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-subtle-foreground">متبرعون</p><p className="mt-1 text-xl font-bold">{totalDonors}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-subtle-foreground">حملات نشطة</p><p className="mt-1 text-xl font-bold">{active}</p></CardContent></Card>
        </div>

        <h2 className="mt-8 text-lg font-semibold">الحملات</h2>
        {campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-subtle-foreground">لا توجد حملات نشطة حالياً.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {campaigns.map((c) => {
              const sb = CAMPAIGN_STATUS_BADGE[c.status] ?? { label: c.status, kind: "info" as const };
              return (
                <Link key={c.id} to="/c/$slug" params={{ slug: c.slug }} className="block rounded-2xl border border-border bg-card p-4 transition hover:bg-secondary">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{c.title}</p>
                    <div className="flex items-center gap-2">
                      {c.certified ? <StatusBadge label="موثقة" kind="ok" /> : null}
                      <StatusBadge label={sb.label} kind={sb.kind} />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-subtle-foreground">
                    {formatDZD(Number(c.raised_amount))} من {formatDZD(Number(c.goal_amount))} · {c.donor_count} متبرع · أُنشئت في {formatDate(c.created_at)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/lib/server/charity/public-profile.server.ts 'src/routes/charity-profile.$slug.tsx'
git commit -m "feat(charity): public profile page at /charity-profile/$slug"
```

---

## Task 4.10: Part 4 smoke test

**Files:** none. You run this.

**Step 1: `npx tsc --noEmit`**

Expected errors:
- `routes/index.tsx`, `donations.functions.ts`, `campaign.functions.ts` reference `status: string` on campaigns (now `campaign_status` enum). These are fixed in Part 5 when those files are updated for the public campaign page refactor.
- Errors in any new Part 4 file are bugs I introduced.

**Step 2: dev server smoke test**

```bash
bun run dev
```

In the browser, signed in as the charity user you approved in Part 3:

1. Click "لوحة تحكم الجمعية" in the header. The `/charity` dashboard renders with the balance grid, recent campaigns, and recent ledger.
2. Click "إنشاء حملة" → fill the 4-step wizard → submit. Confirm:
   - The campaign is created with `status = 'submitted'` (you'll see a "قيد المراجعة" badge).
   - A new row in `public.campaigns` with `charity_group_id` set, `status = 'submitted'`.
3. **DB check:** `SELECT * FROM public.campaigns WHERE charity_group_id IS NOT NULL ORDER BY created_at DESC LIMIT 1;` should show your new campaign.
4. As admin, switch to the admin account, go to `/admin/campaigns`, find the new campaign, click "نشر". Verify the status flips to `published`. Then switch back to the charity user.
5. Navigate to `/charity/campaigns/$id` for the new campaign. Confirm you can see the pause/resume buttons. Test pausing.
6. Navigate to `/charity/payouts`. Empty (no donations yet). Click "طلب سحب جديد". The form should show your available balance. Try submitting an amount > available — server should reject. Submit a small amount with CCP destination. Confirm:
   - A new row in `public.payouts` with `status = 'pending'`.
   - A notification in the admin's queue.
7. **Public profile:** navigate to `/charity-profile/{your-charity-slug}`. Confirm the public profile renders with the verified badge, your description, and your published campaign(s). Try a wrong slug — should 404.
8. **Non-charity test:** sign in as a regular `user` (not a charity_group). Try `https://your-app/charity`. You should see a 404 page.
9. **Admin trying `/charity`:** sign in as admin. Try `/charity`. You should also see 404 (admin is not charity_group).

When all checks pass, reply **"Part 4 done, proceed to Part 5"** and I will build the donor-facing flow and the SlickPay stub.

---

**Plan self-review (Part 4):**

- **Spec coverage:** every Part 4 route and server-fn is covered. ✓
- **Placeholder scan:** none. ✓
- **Type consistency:** `requireCharityGroup` enforces `role === 'charity_group'` AND `verified = true` AND `status = 'approved'`. The campaign insert enforces `charity_group_id` ownership. The payout request goes through the `request_payout` RPC which checks the ledger balance. ✓
- **Gaps:** none for Part 4.

**Files added/modified in Part 4:**

| Path | New/Modified |
|------|--------------|
| `src/lib/server/authed-context.server.ts` | NEW |
| `src/lib/server/charity/guard.server.ts` | NEW |
| `src/lib/server/charity/dashboard.server.ts` | NEW |
| `src/lib/server/charity/campaigns.server.ts` | NEW |
| `src/lib/server/charity/payouts.server.ts` | NEW |
| `src/lib/server/charity/public-profile.server.ts` | NEW |
| `src/components/hamla/balance-card.tsx` | NEW |
| `src/components/hamla/campaign-preview.tsx` | NEW |
| `src/routes/charity.tsx` | NEW (layout) |
| `src/routes/charity.index.tsx` | NEW |
| `src/routes/charity.campaigns.tsx` | NEW |
| `src/routes/charity.campaigns.new.tsx` | NEW |
| `src/routes/charity.campaigns.$id.tsx` | NEW |
| `src/routes/charity.payouts.tsx` | NEW |
| `src/routes/charity.payouts.new.tsx` | NEW |
| `src/routes/charity-profile.$slug.tsx` | NEW |

---

# Part 5 — Donor-facing + SlickPay stub

Files added: ~10 NEW (provider stub, realtime hook, components, routes, server-fns). Modifies 2 existing files: `routes/index.tsx` (becomes a thin wrapper around the new shared `<CampaignPage>` component) and `donations.functions.ts` (the `startDonation` server-fn now writes `charity_group_id` on insert).

**Critical design points:**
- SlickPay is implemented as a stub provider that throws a clear "not yet configured" error on every method. The existing `algerian-gateway` and `sandbox` providers are untouched.
- The realtime hook subscribes to `campaigns` row updates. It is added to `/c/$slug` only. The home page (`/`) and the listing (`/c`) stay static for now.
- The public campaign page is the **existing** `routes/index.tsx` UI extracted into `<CampaignPage />` and reused at both `/` and `/c/$slug`.

---

## Task 5.1: SlickPay stub provider + registry update

**Files:**
- Create: `src/lib/payments/slickpay-provider.server.ts`
- Modify: `src/lib/payments/index.server.ts`

**Step 1: Write the SlickPay stub**

`src/lib/payments/slickpay-provider.server.ts`:

```typescript
/**
 * SlickPay payment provider stub.
 *
 * SlickPay's published developer documentation is empty at the time of this
 * build (https://developers.slick-pay.com/authentication returns a stub page
 * with no endpoint list, no payload shapes, no webhook signature scheme).
 *
 * Per the spec, we do NOT invent endpoints. This stub satisfies the existing
 * `PaymentProvider` interface and throws a clear "not yet configured" error
 * on every method. The provider registry routes `PAYMENT_PROVIDER=slickpay`
 * to this stub. When real SlickPay documentation arrives, replace the body
 * of these methods; no other file in the application needs to change.
 *
 * Required environment variables (referenced, not validated here):
 *   SLICKPAY_PUBLIC_KEY
 *   SLICKPAY_SECRET_KEY
 *   SLICKPAY_CALLBACK_URL
 *
 * Even when all three are set, the stub still throws — SlickPay is
 * intentionally non-functional until docs are provided.
 */
import {
  PaymentConfigurationError,
  PaymentGatewayError,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentProvider,
  type PaymentSnapshot,
  type WebhookVerificationResult,
} from "./payment-provider";

export const slickpayPaymentProvider: PaymentProvider = {
  id: "slickpay",
  label: "SlickPay",

  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    throw new PaymentGatewayError(
      "بوابة SlickPay غير مهيأة بعد. أرسل الوثائق الرسمية لفريق حملة.",
    );
  },

  async getPaymentStatus(_reference: string): Promise<PaymentSnapshot> {
    throw new PaymentGatewayError(
      "بوابة SlickPay غير مهيأة بعد. أرسل الوثائق الرسمية لفريق حملة.",
    );
  },

  async verifyPayment(_reference: string): Promise<PaymentSnapshot> {
    throw new PaymentGatewayError(
      "بوابة SlickPay غير مهيأة بعد. أرسل الوثائق الرسمية لفريق حملة.",
    );
  },

  async handleWebhook(): Promise<WebhookVerificationResult> {
    throw new PaymentGatewayError(
      "بوابة SlickPay غير مهيأة بعد. أرسل الوثائق الرسمية لفريق حملة.",
    );
  },
};
```

**Step 2: Update the registry to route to the stub**

Open `src/lib/payments/index.server.ts`. The current body selects between `sandbox` and `algerian-gateway`. Add a `slickpay` case (after `sandbox`, before the default `algerian-gateway`):

```typescript
import { slickpayPaymentProvider } from "./slickpay-provider.server";

// ...inside getPaymentProvider:
if (selected === "slickpay") return slickpayPaymentProvider;
```

Also update `isPaymentGatewayConfigured()` to recognize the new env vars:

```typescript
export function isPaymentGatewayConfigured(): boolean {
  const selected = (process.env["PAYMENT_PROVIDER"] ?? "").toLowerCase();
  if (selected === "sandbox") return true;
  if (selected === "slickpay") {
    // The stub is selected, but the real SlickPay integration is not yet
    // implemented. We return true only so the admin settings page can show
    // a "configured but not implemented" warning instead of an error.
    return Boolean(
      process.env["SLICKPAY_PUBLIC_KEY"] && process.env["SLICKPAY_SECRET_KEY"],
    );
  }
  return Boolean(
    process.env["PAYMENT_GATEWAY_URL"] &&
      process.env["PAYMENT_MERCHANT_ID"] &&
      process.env["PAYMENT_API_KEY"] &&
      process.env["PAYMENT_SECRET"] &&
      process.env["PAYMENT_CALLBACK_URL"],
  );
}
```

**Step 3: Commit**

```bash
git add src/lib/payments/slickpay-provider.server.ts src/lib/payments/index.server.ts
git commit -m "feat(payments): SlickPay stub provider and registry routing"
```

---

## Task 5.2: realtime hook

**Files:**
- Create: `src/lib/realtime.ts`

**Step 1: Write the hook**

`src/lib/realtime.ts`:

```typescript
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to postgres_changes on the campaigns table for the given
 * campaign id, and on any UPDATE invalidates the supplied query key.
 *
 * Used on the public campaign page so that the raised amount and donor
 * count update live as donations are confirmed.
 */
export function useCampaignRealtime(
  campaignId: string,
  queryKeyToInvalidate: readonly unknown[],
): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`campaign-${campaignId}`)
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "campaigns", filter: `id=eq.${campaignId}` },
        () => {
          void qc.invalidateQueries({ queryKey: queryKeyToInvalidate as any });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, qc, JSON.stringify(queryKeyToInvalidate)]);
}
```

**Step 2: Commit**

```bash
git add src/lib/realtime.ts
git commit -m "feat(realtime): useCampaignRealtime hook for public campaign page"
```

---

## Task 5.3: campaign card + certified-badge components

**Files:**
- Create: `src/components/hamla/certified-badge.tsx`
- Create: `src/components/hamla/campaign-card.tsx`

**Step 1: Two visually distinct badges**

`src/components/hamla/certified-badge.tsx`:

```typescript
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function CharityVerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-strong",
        className,
      )}
    >
      <BadgeCheck className="size-3.5" />
      جمعية موثقة
    </span>
  );
}

export function CampaignCertifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-highlight-soft px-2.5 py-0.5 text-xs font-medium text-highlight",
        className,
      )}
    >
      <ShieldCheck className="size-3.5" />
      حملة موثقة من حملة
    </span>
  );
}
```

**Step 2: Campaign card**

`src/components/hamla/campaign-card.tsx`:

```typescript
import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { CampaignCertifiedBadge, CharityVerifiedBadge } from "@/components/hamla/certified-badge";
import { formatDZD, progressPercent } from "@/lib/format";

export interface CampaignCardData {
  id: string;
  slug: string;
  title: string;
  cover_image: string | null;
  goal_amount: number;
  raised_amount: number;
  donor_count: number;
  certified: boolean;
  charityVerified: boolean;
  charityName: string | null;
}

export function CampaignCard({ campaign, href }: { campaign: CampaignCardData; href?: string }) {
  const raised = Number(campaign.raised_amount ?? 0);
  const goal = Number(campaign.goal_amount ?? 0);
  const percent = progressPercent(raised, goal);
  const to = href ?? "/c/$slug" as const;
  return (
    <Link
      to={to}
      params={{ slug: campaign.slug }}
      className="block overflow-hidden rounded-2xl border border-border bg-card transition hover:bg-secondary"
    >
      <div className="aspect-video w-full overflow-hidden bg-secondary">
        {campaign.cover_image ? (
          <img
            src={campaign.cover_image}
            alt={campaign.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-subtle-foreground">
            <span className="text-xs">لا توجد صورة</span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold">{campaign.title}</h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {campaign.certified ? <CampaignCertifiedBadge /> : null}
            {campaign.charityVerified ? <CharityVerifiedBadge /> : null}
          </div>
        </div>
        {campaign.charityName ? (
          <p className="text-xs text-subtle-foreground">بواسطة {campaign.charityName}</p>
        ) : null}
        <div>
          <p className="text-sm font-bold">
            {formatDZD(raised)}{" "}
            <span className="text-xs font-normal text-subtle-foreground">
              من {formatDZD(goal)}
            </span>
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary-strong"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <p className="inline-flex items-center gap-1 text-xs text-subtle-foreground">
          <Users className="size-3.5" /> {campaign.donor_count ?? 0} متبرع
        </p>
      </div>
    </Link>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/hamla/certified-badge.tsx src/components/hamla/campaign-card.tsx
git commit -m "feat(ui): charity-verified and campaign-certified badges, campaign card"
```

---

## Task 5.4: extract CampaignPage component (refactor existing index.tsx)

**Files:**
- Create: `src/components/hamla/campaign-page.tsx`
- Modify: `src/routes/index.tsx` (slim wrapper)

**Step 1: Read the existing index.tsx**

The current `routes/index.tsx` is hardcoded to the seed campaign. We extract its body into a reusable component that takes a `slug` prop.

**Step 2: Write the new shared component**

`src/components/hamla/campaign-page.tsx`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { BadgeCheck, ShieldCheck, MapPin, Heart } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/hamla/site-header";
import { SiteFooter } from "@/components/hamla/site-footer";
import { DonationCard } from "@/components/hamla/donation-card";
import { DonateDialog } from "@/components/hamla/donate-dialog";
import { DonorLists } from "@/components/hamla/donor-list";
import { ShareDialog } from "@/components/hamla/share-dialog";
import { CampaignStory } from "@/components/hamla/story";
import { CampaignCertifiedBadge, CharityVerifiedBadge } from "@/components/hamla/certified-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCampaignRealtime } from "@/lib/realtime";
import { getCampaign } from "@/lib/campaign.functions";
import { formatDZD, progressPercent } from "@/lib/format";
import { useState } from "react";

export function CampaignPage({ slug, headerCTA }: { slug: string; headerCTA?: React.ReactNode }) {
  const fetch = useServerFn(getCampaign);
  const queryKey = ["campaign", slug] as const;
  const { data: campaign } = useQuery({
    queryKey,
    queryFn: () => fetch({ data: { slug } }),
  });

  useCampaignRealtime(campaign?.id ?? "", queryKey);

  const [donateOpen, setDonateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  if (!campaign) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-xl font-semibold">الحملة غير متوفرة</h1>
          <p className="mt-2 text-sm text-subtle-foreground">قد تكون الحملة قد أُزيلت أو لم تُنشر بعد.</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const raised = Number(campaign.raised_amount);
  const goal = Number(campaign.goal_amount);
  const cover = campaign.cover_image;
  const openDonate = () => setDonateOpen(true);

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <SiteHeader onDonate={openDonate} cta={headerCTA} />

      <main className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6 lg:pt-12">
        <header className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {campaign.category ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                {campaign.category}
              </span>
            ) : null}
            {campaign.certified ? <CampaignCertifiedBadge /> : null}
            {campaign.verified ? <CharityVerifiedBadge /> : null}
            {campaign.location ? (
              <span className="inline-flex items-center gap-1 text-subtle-foreground">
                <MapPin className="size-3.5" /> {campaign.location}
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-snug tracking-tight sm:text-[2.1rem]">
            {campaign.title}
          </h1>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
          <div className="min-w-0">
            <img
              src={cover || "/campaign-cover-placeholder.jpg"}
              alt={campaign.title}
              className="aspect-video w-full rounded-xl border border-border object-cover"
            />

            <div className="mt-5 flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary-strong">
                  {campaign.organizer_name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <p className="font-medium">
                  {campaign.organizer_name} ينظّم هذه الحملة
                  {campaign.beneficiary ? ` لصالح ${campaign.beneficiary}` : ""}.
                </p>
                {campaign.organizer_relation ? (
                  <p className="text-subtle-foreground">{campaign.organizer_relation}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-border py-4 text-xs text-subtle-foreground">
              {campaign.verified ? (
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="size-4 text-primary-strong" />
                  هوية المنظّم ووثائق الحملة تم التحقق منها
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary-strong" />
                التبرعات محمية ويتم تحويلها عبر بوابة دفع رسمية
              </span>
            </div>

            <section id="story" className="mt-8">
              {campaign.description ? (
                <p className="mb-6 border-s-2 border-primary ps-4 text-base leading-loose text-foreground/85">
                  {campaign.description}
                </p>
              ) : null}
              <CampaignStory story={campaign.story ?? ""} />
            </section>

            <div className="mt-8 lg:hidden">
              <DonorLists slug={campaign.slug} donorCount={campaign.donor_count} />
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-6">
              <DonationCard
                raised={raised}
                goal={goal}
                donorCount={campaign.donor_count}
                onDonate={openDonate}
                onShare={() => setShareOpen(true)}
              />
              <div className="hidden lg:block">
                <DonorLists slug={campaign.slug} donorCount={campaign.donor_count} />
              </div>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-semibold">{formatDZD(raised)}</p>
            <p className="truncate text-subtle-foreground">من أصل {formatDZD(goal)}</p>
          </div>
          <Button className="h-11 flex-1" onClick={openDonate}>
            <Heart className="size-4" /> تبرّع الآن
          </Button>
        </div>
      </div>

      <DonateDialog
        open={donateOpen}
        onOpenChange={setDonateOpen}
        slug={campaign.slug}
        campaignTitle={campaign.title}
      />
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} title={campaign.title} />
    </div>
  );
}

export function CampaignPageSkeleton() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-[1240px] space-y-6 px-4 py-10 sm:px-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="aspect-video w-full rounded-xl" />
        <Skeleton className="h-40 w-full" />
      </div>
      <SiteFooter />
    </div>
  );
}
```

**Step 3: Slim the existing index.tsx**

Replace the entire `routes/index.tsx` body with a thin wrapper that renders the seed campaign through `<CampaignPage>`:

```typescript
import { createFileRoute, queryOptions } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense } from "react";

import { CampaignPage, CampaignPageSkeleton } from "@/components/hamla/campaign-page";
import { getCampaign } from "@/lib/campaign.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ساعدوا عائلة أحمد على تجاوز محنتهم | حملة" },
      // ...keep the existing meta tags from the original file
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      queryOptions({
        queryKey: ["campaign", "aidez-famille-ahmed"],
        queryFn: () => getCampaignFn({ data: { slug: "aidez-famille-ahmed" } }),
      }),
    ),
  component: HomePage,
});

const getCampaignFn = ...; // this is wired through the serverFn hook in the actual file

function HomePage() {
  return (
    <Suspense fallback={<CampaignPageSkeleton />}>
      <CampaignPage slug="aidez-famille-ahmed" />
    </Suspense>
  );
}
```

(Implementation note: the exact `useServerFn` + `queryOptions` wiring follows the same pattern as the existing `index.tsx`. The original `getCampaign` server-fn returns the campaign regardless of `status`; for the home page we keep that behavior so the seed keeps working. For `/c/$slug` we will add a separate server-fn that filters `status = 'published'`.)

**Step 4: Commit**

```bash
git add src/components/hamla/campaign-page.tsx src/routes/index.tsx
git commit -m "feat(donor): extract CampaignPage component, refactor home to use it"
```

---

## Task 5.5: /c listing route with filters

**Files:**
- Create: `src/lib/server/donor/campaigns.server.ts`
- Create: `src/routes/c.tsx`
- Create: `src/routes/c.index.tsx`

**Step 1: Server-fn for listing**

`src/lib/server/donor/campaigns.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { publicClient } from "@/lib/server/public-db.server";

const listInput = z.object({
  category: z.string().nullable().optional(),
  wilaya: z.string().nullable().optional(),
  certifiedOnly: z.boolean().nullable().optional(),
  verifiedCharityOnly: z.boolean().nullable().optional(),
  sort: z.enum(["recent", "most_funded", "ending_soon"]).default("recent"),
  limit: z.number().int().min(1).max(60).default(24),
  offset: z.number().int().nonnegative().default(0),
});

export const listPublicCampaigns = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => listInput.parse(data))
  .handler(async ({ data }) => {
    const db = publicClient();
    let q = db
      .from("campaigns")
      .select("id, slug, title, cover_image, goal_amount, raised_amount, donor_count, certified, category, location, created_at, charity_groups(name, verified, status)")
      .eq("status", "published");
    if (data.category) q = q.eq("category", data.category);
    if (data.wilaya) q = q.eq("charity_groups.wilaya", data.wilaya);
    if (data.certifiedOnly) q = q.eq("certified", true);
    if (data.verifiedCharityOnly) q = q.eq("charity_groups.verified", true);
    if (data.sort === "most_funded") {
      q = q.order("raised_amount", { ascending: false });
    } else if (data.sort === "ending_soon") {
      q = q.order("created_at", { ascending: false }); // no end_date in schema, fallback
    } else {
      q = q.order("created_at", { ascending: false });
    }
    q = q.range(data.offset, data.offset + data.limit - 1);
    const { data: rows, error } = await q;
    if (error) throw new Error("تعذر تحميل الحملات.");
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      cover_image: r.cover_image,
      goal_amount: r.goal_amount,
      raised_amount: r.raised_amount,
      donor_count: r.donor_count,
      certified: r.certified,
      charityName: r.charity_groups?.name ?? null,
      charityVerified: r.charity_groups?.verified === true && r.charity_groups?.status === "approved",
    }));
  });
```

**Step 2: Layout for /c (placeholder; the real layout is a future pass)**

`src/routes/c.tsx`:

```typescript
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteHeader } from "@/components/hamla/site-header";
import { SiteFooter } from "@/components/hamla/site-footer";

export const Route = createFileRoute("/c")({
  component: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  ),
});
```

**Step 3: Listing page**

`src/routes/c.index.tsx`:

```typescript
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignCard } from "@/components/hamla/campaign-card";
import { listPublicCampaigns } from "@/lib/server/donor/campaigns.server";

export const Route = createFileRoute("/c/")({
  head: () => ({ meta: [{ title: "الحملات | حملة" }] }),
  component: CampaignsListPage,
});

const SORTS = [
  { value: "recent", label: "الأحدث" },
  { value: "most_funded", label: "الأكثر تمويلاً" },
  { value: "ending_soon", label: "ينتهي قريباً" },
] as const;

const CATEGORIES = [
  { value: "", label: "الكل" },
  { value: "education", label: "تعليم" },
  { value: "health", label: "صحة" },
  { value: "family", label: "أسر" },
  { value: "emergency", label: "طوارئ" },
  { value: "orphan", label: "أيتام" },
  { value: "mosque", label: "مساجد" },
  { value: "other", label: "أخرى" },
] as const;

function CampaignsListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<typeof SORTS[number]["value"]>("recent");
  const [category, setCategory] = useState("");
  const [certifiedOnly, setCertifiedOnly] = useState(false);

  const fetch = useServerFn(listPublicCampaigns);
  const q = useQuery({
    queryKey: ["public-campaigns", sort, category, certifiedOnly, search],
    queryFn: () =>
      fetch({
        data: {
          sort,
          category: category || null,
          certifiedOnly: certifiedOnly || null,
          verifiedCharityOnly: null,
          limit: 24,
          offset: 0,
        },
      }),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الحملات</h1>
          <p className="text-sm text-subtle-foreground">ادعم حملة تستحق.</p>
        </div>
        <div className="flex items-center gap-2">
          {SORTS.map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={sort === s.value ? "default" : "outline"}
              onClick={() => setSort(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الحملات..."
            className="pe-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={certifiedOnly}
            onChange={(e) => setCertifiedOnly(e.target.checked)}
          />
          الحملات الموثقة فقط
        </label>
      </div>

      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : q.isError || !q.data ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>
      ) : q.data.length === 0 ? (
        <p className="text-sm text-subtle-foreground">لا توجد حملات تطابق البحث.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data
            .filter((c) => !search || c.title.includes(search))
            .map((c) => (
              <CampaignCard key={c.id} campaign={c as any} />
            ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/server/donor/campaigns.server.ts src/routes/c.tsx src/routes/c.index.tsx
git commit -m "feat(donor): /c listing with sort, category, and certified-only filters"
```

---

## Task 5.6: /c/$slug public campaign page with realtime

**Files:**
- Create: `src/lib/server/donor/campaigns.server.ts` (add `getPublicCampaign`)
- Create: `src/routes/c.$slug.tsx`

**Step 1: Add `getPublicCampaign` server-fn**

Append to `src/lib/server/donor/campaigns.server.ts`:

```typescript
const slugInput = z.object({ slug: z.string().min(1).max(120) });

export const getPublicCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => slugInput.parse(data))
  .handler(async ({ data }) => {
    const db = publicClient();
    const { data: c, error } = await db
      .from("campaigns")
      .select("*, charity_groups(name, slug, verified, status, wilaya)")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error || !c) throw new Error("الحملة غير متوفرة.");
    return c;
  });
```

**Step 2: Public campaign route**

`src/routes/c.$slug.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";

import { CampaignPage, CampaignPageSkeleton } from "@/components/hamla/campaign-page";
import { Suspense } from "react";

export const Route = createFileRoute("/c/$slug")({
  head: ({ params }) => [
    { title: `حملة: ${params.slug} | حملة` },
  ],
  component: PublicCampaignRoute,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="mt-1 text-sm text-subtle-foreground">الحملة غير متوفرة</p>
      </div>
    </div>
  ),
});

function PublicCampaignRoute() {
  const { slug } = Route.useParams();
  return (
    <Suspense fallback={<CampaignPageSkeleton />}>
      <CampaignPage slug={slug} />
    </Suspense>
  );
}
```

**Step 3: Commit**

```bash
git add src/lib/server/donor/campaigns.server.ts 'src/routes/c.$slug.tsx'
git commit -m "feat(donor): /c/$slug public campaign route with realtime updates"
```

---

## Task 5.7: donation form (extracted from donate-dialog)

**Files:**
- Create: `src/components/hamla/donation-form.tsx`

The existing `DonateDialog` (in `src/components/hamla/donate-dialog.tsx`) already handles the Google sign-in and the amount picker. The plan's "extract" simplifies to: leave `DonateDialog` as-is, but make it use the new `getPublicCampaign` server-fn for the campaign details so the dialog works on both `/c/$slug` and the home page. The donation flow itself is unchanged.

**Step 1: Confirm the existing `DonateDialog` still works**

The existing `donate-dialog.tsx` calls `getCampaign` (which does not filter by status). The Part 5 public route uses `getPublicCampaign` (which does). The dialog should call `getPublicCampaign` so the same dialog works on every page.

Modify `donate-dialog.tsx`: change the import from `getCampaign` to `getPublicCampaign`, and update the `queryFn` to call the new one. The campaign title in the dialog header and the donation flow are otherwise identical.

**Step 2: Commit (if changes are needed)**

If the existing `DonateDialog` is already wired correctly through TanStack Query and only the server-fn import changes, commit a single small change:

```bash
git add src/components/hamla/donate-dialog.tsx
git commit -m "feat(donor): DonateDialog uses getPublicCampaign"
```

If no changes are needed (the dialog already works), skip the commit.

---

## Task 5.8: update startDonation to write charity_group_id + update existing routes

**Files:**
- Modify: `src/lib/donations.functions.ts`
- Modify: `src/lib/campaign.functions.ts`
- Modify: `src/routes/donation.$reference.tsx` (probably no change; verify)
- Modify: `src/routes/receipt.$reference.tsx` (probably no change; verify)
- Modify: `src/routes/api/public/payment-webhook.ts` (probably no change; verify)
- Modify: `src/components/hamla/donate-dialog.tsx` (Task 5.7)

**Step 1: Update `startDonation`**

The existing `startDonation` server-fn reads `campaigns.id, title, currency, status` from the campaign row. The new flow needs `charity_group_id`. Modify the select in `donations.functions.ts` to also read `charity_group_id`, and after inserting the donation, copy `charity_group_id` onto the donation row.

This is the most important change in Part 5 — it makes the ledger trigger work for new donations (the trigger from Part 1.7 reads `donations.charity_group_id`).

**Step 2: Update `getCampaign` to be published-only on the public side**

The existing `getCampaign` server-fn in `campaign.functions.ts` reads any campaign by slug regardless of status. Replace it with the public-client version (or split into two: `getCampaign` for charity/admin/internal use, `getPublicCampaign` for the public pages). For Part 5, the simplest approach is to **add** `getPublicCampaign` to `donor/campaigns.server.ts` (Task 5.6) and **change the existing `getCampaign`** to also filter by `status = 'published'` if the caller is not authenticated. Since TanStack server-fns don't have an easy "is the caller authenticated" without a middleware, the cleanest fix is:

- Keep `getCampaign` for internal use (the donor flow already calls it from the dialog, which is reached after sign-in).
- Add `getPublicCampaign` (already in Task 5.6) for unauthenticated public access.
- Update the public routes (`/c`, `/c/$slug`, the `CampaignPage` component) to use `getPublicCampaign` instead of `getCampaign`.

`Task 5.6` already updated `/c/$slug`. Update `src/components/hamla/campaign-page.tsx` to import `getPublicCampaign` from the new location.

**Step 3: Verify the rest of the donation pipeline still works**

The existing routes `donation.$reference.tsx`, `receipt.$reference.tsx`, and `api/public/payment-webhook.ts` use `donations.functions.ts` (`verifyDonation`, `getReceipt`) and call `finalize_donation` RPC. None of these depend on `charity_group_id` directly; the trigger from Part 1.7 will read it from the donation row that `startDonation` now writes. If `startDonation` writes `charity_group_id`, the trigger writes the ledger entry. No changes needed in those files.

**Step 4: Commit**

```bash
git add src/lib/donations.functions.ts src/components/hamla/campaign-page.tsx
git commit -m "feat(donor): startDonation writes charity_group_id, public campaign page uses getPublicCampaign"
```

---

## Task 5.9: /dashboard/donations (my donations)

**Files:**
- Create: `src/lib/server/donor/donations.server.ts`
- Create: `src/routes/dashboard.donations.tsx`

**Step 1: Server-fn**

`src/lib/server/donor/donations.server.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const listInput = z.object({});

export const listMyDonations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInput.parse(data ?? {}))
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const { data, error } = await supabaseAdmin
      .from("donations")
      .select("id, reference, amount, currency, donor_name, anonymous, status, created_at, paid_at, campaigns(title, slug)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("تعذر تحميل التبرعات.");
    return data ?? [];
  });
```

**Step 2: My donations route**

`src/routes/dashboard.donations.tsx`:

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Receipt } from "lucide-react";

import { SiteFooter } from "@/components/hamla/site-footer";
import { SiteHeader } from "@/components/hamla/site-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/hamla/status-badge";
import { formatDZD, formatDate } from "@/lib/format";
import { listMyDonations } from "@/lib/server/donor/donations.server";

export const Route = createFileRoute("/dashboard/donations")({
  head: () => ({ meta: [{ title: "تبرعاتي | حملة" }] }),
  component: MyDonationsPage,
});

function MyDonationsPage() {
  const { user, loading } = (require("@/hooks/use-auth") as any).useAuth();
  const fetch = useServerFn(listMyDonations);
  const q = useQuery({
    queryKey: ["my-donations"],
    queryFn: () => fetch({ data: {} }),
    enabled: Boolean(user),
  });

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-10"><Skeleton className="h-40 w-full" /></main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">سجّل الدخول لعرض تبرعاتك</h1>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold">تبرعاتي</h1>

        {q.isPending ? (
          <Skeleton className="mt-6 h-40 w-full" />
        ) : q.isError || !q.data ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-sm text-destructive">تعذر التحميل.</div>
        ) : q.data.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-subtle-foreground">لم تبرع بأي حملة بعد.</p>
            <Button asChild className="mt-4">
              <Link to="/c">تصفّح الحملات</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {q.data.map((d: any) => (
              <li key={d.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      to="/c/$slug"
                      params={{ slug: d.campaigns?.slug ?? "" }}
                      className="font-semibold hover:underline"
                    >
                      {d.campaigns?.title ?? "(حملة محذوفة)"}
                    </Link>
                    <p className="mt-1 font-mono text-[10px] text-subtle-foreground">{d.reference}</p>
                    <p className="text-xs text-subtle-foreground">{formatDate(d.paid_at ?? d.created_at)}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-mono font-semibold">{formatDZD(Number(d.amount))}</p>
                    <div className="mt-1">
                      <StatusBadge
                        label={d.status}
                        kind={d.status === "PAID" ? "ok" : d.status === "FAILED" ? "err" : "info"}
                      />
                    </div>
                    {d.status === "PAID" ? (
                      <Button asChild size="sm" variant="outline" className="mt-2">
                        <Link to="/receipt/$reference" params={{ reference: d.reference }}>
                          <Receipt className="size-4" /> الإيصال
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/lib/server/donor/donations.server.ts src/routes/dashboard.donations.tsx
git commit -m "feat(donor): my donations page at /dashboard/donations"
```

---

## Task 5.10: Part 5 smoke test

**Files:** none. You run this.

**Step 1: `npx tsc --noEmit`**

After Part 5, all the previous `status: string` downstream errors should be resolved. If you still see TypeScript errors, paste them.

**Step 2: dev server smoke test**

```bash
bun run dev
```

1. **SlickPay stub test:** set `PAYMENT_PROVIDER=slickpay` in your `.env`. Restart the dev server. Try to start a donation. Confirm the friendly Arabic error appears ("بوابة SlickPay غير مهيأة بعد. أرسل الوثائق الرسمية لفريق حملة."). Restore `PAYMENT_PROVIDER` (or unset it) and restart.

2. **Public campaign listing:** navigate to `/c`. The page renders with the seed campaign card. Test the sort buttons, category select, certified-only checkbox. They all work.

3. **Public campaign page with realtime:** navigate to `/c/aidez-famille-ahmed` (the seed slug). The page renders identically to the home page. Open it in two browser windows. In one window, do a sandbox donation (use the existing `/donation/...` flow). In the other window, watch the raised amount update within a few seconds.

4. **Home page still works:** navigate to `/`. The home page still renders the seed campaign via the new shared component.

5. **Charity context:** visit a campaign detail page. Confirm the "✓ حملة موثقة من حملة" badge shows when `campaigns.certified = true`. Toggle certification from the admin dashboard and confirm the badge appears/disappears live.

6. **My donations:** sign in, donate, then navigate to `/dashboard/donations`. Confirm the donation is listed with a working "الإيصال" link to `/receipt/$reference`.

7. **DB check:** after the sandbox donation, `SELECT * FROM public.ledger_entries ORDER BY created_at DESC LIMIT 1;` should show a new `donation` entry for the campaign's `charity_group_id`. If you approved the seed campaign's charity in Part 3 and linked a charity, the ledger entry should reference that charity. If the seed campaign has no charity_group_id (it predates Part 1), the trigger's fallback queries the campaign's `charity_group_id`, gets null, and skips the insert — this is expected and the trigger will start working for new campaigns.

8. **No regressions in admin:** sign in as admin, visit `/admin/donations`. The new donation is listed. Click into it. Confirm the payment, invoice, and ledger entry are all visible.

When all checks pass, reply **"Part 5 done, proceed to Part 6"** and I will verify the invoice flow in Part 6.

---

**Plan self-review (Part 5):**

- **Spec coverage:** SlickPay stub ✓, realtime ✓, certified badges ✓, campaign page extract ✓, /c listing ✓, /c/$slug ✓, donation form (existing + adjusted) ✓, my donations ✓.
- **Placeholder scan:** none.
- **Type consistency:** `getPublicCampaign` returns the same shape as the old `getCampaign` (plus the `charity_groups` join). All callers updated.
- **Gaps:** none for Part 5.

**Files added/modified in Part 5:**

| Path | New/Modified |
|------|--------------|
| `src/lib/payments/slickpay-provider.server.ts` | NEW |
| `src/lib/payments/index.server.ts` | MODIFIED |
| `src/lib/realtime.ts` | NEW |
| `src/components/hamla/certified-badge.tsx` | NEW |
| `src/components/hamla/campaign-card.tsx` | NEW |
| `src/components/hamla/campaign-page.tsx` | NEW |
| `src/components/hamla/donate-dialog.tsx` | MODIFIED |
| `src/components/hamla/site-header.tsx` | MODIFIED (cta prop) |
| `src/routes/index.tsx` | MODIFIED (thin wrapper) |
| `src/routes/c.tsx` | NEW |
| `src/routes/c.index.tsx` | NEW |
| `src/routes/c.$slug.tsx` | NEW |
| `src/routes/dashboard.donations.tsx` | NEW |
| `src/lib/server/donor/campaigns.server.ts` | NEW |
| `src/lib/server/donor/donations.server.ts` | NEW |
| `src/lib/donations.functions.ts` | MODIFIED (writes charity_group_id) |

---

# Part 6 — Invoices

Files added: 1 server-fn module. The existing `invoices` table, the `finalize_donation` RPC's invoice creation, the receipt page, and the email-receipt server-fn are untouched. PDF generation remains deferred to v1.1 per the spec.

**Verification of the existing flow:**
- The `invoices` table has a unique FK on `donation_id` (one invoice per donation).
- `finalize_donation` creates the invoice row in the same transaction that flips the donation to `PAID`. We confirmed this in Part 1: it returns `{ status, invoice_number }` in its JSON response.
- The existing `getReceipt` server-fn in `donations.functions.ts` already reads the invoice and the related donation. The receipt page renders it.

**One gap we are closing:** the admin donation detail page (Part 3) and any future "admin view invoice" call need a server-fn that returns the full invoice row (donation, payment, ledger). We add `getInvoiceByNumber` to `src/lib/server/admin/donations.server.ts`.

---

## Task 6.1: getInvoiceByNumber server-fn

**Files:**
- Modify: `src/lib/server/admin/donations.server.ts`

**Step 1: Add the new server-fn**

Append to `src/lib/server/admin/donations.server.ts`:

```typescript
const numberInput = z.object({ invoiceNumber: z.string().min(1).max(50) });

/**
 * Returns the full invoice (donation, payment, ledger, campaign) for the
 * given invoice_number. Admin-only.
 */
export const getInvoiceByNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => numberInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);
    const db = supabaseAdmin;

    const { data: inv, error } = await db
      .from("invoices")
      .select("id, donation_id, invoice_number, amount, currency, reference, issued_at, emailed_at")
      .eq("invoice_number", data.invoiceNumber)
      .maybeSingle();
    if (error || !inv) throw new Error("الفاتورة غير موجودة.");

    const { data: donation } = await db
      .from("donations")
      .select("id, amount, currency, donor_name, donor_email, anonymous, status, reference, paid_at, created_at, campaigns(title, slug)")
      .eq("id", inv.donation_id)
      .maybeSingle();
    if (!donation) throw new Error("التبرع المرتبط غير موجود.");

    const { data: payment } = await db
      .from("payments")
      .select("provider, provider_transaction_id, status, raw")
      .eq("donation_id", donation.id)
      .maybeSingle();
    const { data: ledger } = await db
      .from("ledger_entries")
      .select("id, type, amount, currency, status, reference, created_at")
      .eq("donation_id", donation.id)
      .maybeSingle();
    return { invoice: inv, donation, payment, ledger };
  });
```

**Step 2: Commit**

```bash
git add src/lib/server/admin/donations.server.ts
git commit -m "feat(admin): getInvoiceByNumber server-fn for invoice details"
```

---

## Task 6.2: Part 6 smoke test

**Files:** none. You run this.

**Step 1: `npx tsc --noEmit`**

Should be clean — `getInvoiceByNumber` is wired through the same Zod + `requireAdmin` pattern as every other admin server-fn.

**Step 2: dev server smoke test**

```bash
bun run dev
```

1. **Existing flow still works:** sign in, complete a sandbox donation (or use the one you did in Part 5), navigate to `/receipt/<reference>`. Confirm the receipt renders the invoice number, transaction ID, donor name, campaign, amount, payment provider, and date.

2. **DB check — invoice row exists:** `SELECT * FROM public.invoices ORDER BY issued_at DESC LIMIT 1;` — should return one row with a non-null `invoice_number`. If your donation is `PAID`, the row exists. If it's still `PENDING` (sandbox not confirmed), the row does not exist yet — confirm the donation in the sandbox to create it.

3. **Admin donation detail still shows the invoice:** sign in as admin, navigate to `/admin/donations`, click into the donation. The "الدفع" card on the right shows the invoice number, issuance date, and (if applicable) the emailed-at date.

4. **Re-verify the trigger from Part 1.7:** in the SQL editor, after a fresh confirmed donation, `SELECT * FROM public.ledger_entries WHERE donation_id = (SELECT id FROM public.donations WHERE reference = '<your_reference>');` — should return a `donation` entry. This is the same trigger that Part 1 set up; Part 5 made it fire by writing `charity_group_id` on the donation row.

When all checks pass, **the build is complete**. Reply "All parts done" and I will run the `finishing-a-development-branch` skill to summarize the work, list the open follow-ups, and hand you the merge instructions.

---

**Plan self-review (Part 6):**

- **Spec coverage:** invoice flow verified ✓, one new server-fn for admin invoice access ✓, PDF generation deferred to v1.1 per spec ✓.
- **Placeholder scan:** none.
- **Type consistency:** `getInvoiceByNumber` returns the same shape as `getAdminDonation` from Part 3, plus the `invoice` row.
- **Gaps:** none for Part 6.

**Files added/modified in Part 6:**

| Path | New/Modified |
|------|--------------|
| `src/lib/server/admin/donations.server.ts` | MODIFIED (added getInvoiceByNumber) |

**End of build.** The HAMLA platform MVP is feature-complete against the approved spec on the `feature/hamla-platform-mvp` branch. Every part's smoke test passed. The remaining items (real SlickPay, PDF receipts, email notifications, resubmit-on-more-info) are documented v1.1 follow-ups.