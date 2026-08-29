# HAMLA Platform — Technical Design

**Date:** 2026-08-29
**Status:** Approved (6/6 sections)
**Branch:** `feature/hamla-platform-mvp`
**Author:** HAMLA Build Agent
**Reviewers:** Project owner (you)

## Purpose

Extend the existing HAMLA TanStack Start + Supabase codebase from a single-campaign donation page into a multi-role crowdfunding platform with three distinct user classes (USER, CHARITY_GROUP, ADMIN), full campaign and payout moderation, a financial ledger, signed-URL document storage, and a SlickPay payment provider stub ready to be swapped for the real implementation once documentation is provided.

## Non-negotiable rules (enforced in every layer)

1. **Role changes, charity verification, campaign certification, and payout approval happen ONLY through security-definer Postgres functions run as `service_role`.** Never from client code.
2. **A user can never self-grant `charity_group` or `admin`.** Only the security-definer functions, called by the admin server functions, can write to `user_roles`.
3. **Charity group verification (`charity_groups.verified`) and campaign certification (`campaigns.certified`) are SEPARATE booleans.** A verified charity can publish campaigns without certification. The existing `campaigns.verified` column is kept and treated as a third distinct concept (organizer is HAMLA-verified for that specific campaign).
4. **No direct balance math.** Campaign and charity balances are always derived by summing `ledger_entries`. Never `raised_amount - payouts`.
5. **Every admin action writes an `audit_logs` row:** who (admin_id), what (action enum), target (type + id), when (created_at), why (metadata jsonb).
6. **Payment status only changes via server-side verification** against the payment gateway. The browser never declares a donation paid.
7. **RLS denies `authenticated` and `anon` write access to sensitive tables:** `user_roles`, `audit_logs`, `payouts.status`, `charity_groups.verified/status`, all `ledger_entries`. Only `service_role` writes them.

## SlickPay provider decision

The SlickPay developer documentation at `https://developers.slick-pay.com/authentication` is an empty stub page. No public API reference, no OpenAPI spec, no endpoint listing. Implementing a real `slickpay-provider.server.ts` against documented endpoints is not possible without the real documentation.

**Decision:** Ship a `slickpay-provider.server.ts` that implements the existing `PaymentProvider` interface and throws `PaymentGatewayError("بوابة SlickPay غير مهيأة بعد. أرسل الوثائق الرسمية لفريق حملة.")` on every method. The provider registry `src/lib/payments/index.server.ts` is updated to read `PAYMENT_PROVIDER=slickpay` and route to the stub. When real documentation is provided, replace the stub body — no other code changes needed.

## Architecture overview

Single TanStack Start + Supabase monolith. No new services. Reuses the existing patterns:
- `createServerFn` for all server-side logic.
- `requireSupabaseAuth` middleware (existing) for authenticated endpoints.
- `supabaseAdmin` (existing service-role client) for all writes that cross the trust boundary.
- File-based routing under `src/routes/`.

**Cross-cutting helpers built once, used everywhere:**
- `src/lib/server/admin/guard.server.ts` — `requireAdmin(userId)` calls `has_role(auth.uid(), 'admin')`. Every admin route and admin server-fn uses this.
- `src/lib/server/audit.server.ts` — `logAdminAction({ adminId, action, targetType, targetId, metadata })`. The only place application code touches `audit_logs`.
- `src/lib/server/charity-applications.server.ts` (Part 2) — file upload validation. Re-checks size, MIME, and storage path server-side after upload. Never trusts the client.
- `src/lib/storage/*` — private bucket helpers. Signed URLs with 5-minute TTL, generated server-side, never exposed as raw paths to the client.
- `src/lib/realtime.ts` — `useCampaignRealtime(slug, onUpdate)` for the public campaign page.
- `src/hooks/use-role.ts` — client hook that calls `getMyRole()` RPC. The only role-exposing surface for authenticated users.

## Database schema (one new migration)

**Migration file:** `supabase/migrations/20260829000000_hamla_platform.sql`
**Storage file:** `supabase/migrations/20260829000001_storage_buckets.sql` (fallback: create buckets in dashboard if SQL fails)

### Enums

```sql
CREATE TYPE user_role AS ENUM ('user', 'charity_group', 'admin');
CREATE TYPE charity_status AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'more_info_required', 'suspended');
CREATE TYPE app_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'more_info_required', 'suspended');
CREATE TYPE campaign_status AS ENUM ('draft', 'submitted', 'published', 'paused', 'completed', 'rejected', 'suspended', 'archived');
CREATE TYPE payout_status AS ENUM ('pending', 'under_review', 'approved', 'processing', 'paid', 'rejected', 'failed');
CREATE TYPE ledger_type AS ENUM ('donation', 'payment_fee', 'platform_fee', 'refund', 'payout', 'payout_fee', 'adjustment');
CREATE TYPE audit_action AS ENUM (
  'approve_charity', 'reject_charity', 'suspend_charity',
  'approve_campaign', 'reject_campaign', 'certify_campaign',
  'remove_certification', 'suspend_campaign',
  'approve_payout', 'reject_payout', 'mark_payout_paid',
  'suspend_user', 'reactivate_user',
  'view_charity_document'
);
```

### New tables

| Table | Purpose | Service-role-only writes |
|-------|---------|--------------------------|
| `user_roles` | One row per user with their current role. | Yes |
| `charity_groups` | Long-lived charity record. | Yes (status, verified) |
| `charity_applications` | Submission workflow. Multiple per user. | Yes (status, admin_notes) |
| `charity_documents` | Storage paths only. URLs are signed on demand. | Yes |
| `payouts` | Charity payout requests. | Yes (status changes) |
| `ledger_entries` | The only source of balance truth. | Yes (all writes) |
| `audit_logs` | Append-only admin action log. | Yes (all writes) |
| `notifications` | In-app user notifications. | Yes (inserts) |

### Modified tables

- `profiles` — add `role user_role default 'user'`, `status text default 'active'`.
- `campaigns` — add `charity_group_id uuid references charity_groups(id)` (nullable), `certified boolean default false`, `certified_at`, `certified_by`. Cast existing `status` text to the new `campaign_status` enum (existing values are all valid enum members). Existing `verified` column kept.
- `donations` — add `charity_group_id uuid` (denormalized at insert by `startDonation` for fast ledger writes).

### Security-definer functions

All `REVOKE ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE TO service_role;` unless flagged.

| Function | Grant | Notes |
|----------|-------|-------|
| `has_role(_user_id, _role)` | `authenticated` | Read-only. Safe to expose. |
| `grant_role(_user_id, _role, _granted_by)` | `service_role` | |
| `revoke_role(_user_id, _role)` | `service_role` | |
| `get_my_role()` | `authenticated` | Returns role string for `auth.uid()`. Only role-exposing RPC. |
| `approve_charity_application(_id, _reviewer, _notes)` | `service_role` | Creates charity_group if missing, grants `charity_group` role, writes audit log, sends notification. |
| `reject_charity_application(_id, _reviewer, _reason)` | `service_role` | |
| `request_more_info(_id, _reviewer, _notes)` | `service_role` | |
| `certify_campaign(_id, _admin)` | `service_role` | Idempotent. |
| `remove_campaign_certification(_id, _admin, _reason)` | `service_role` | Idempotent. |
| `publish_campaign(_id, _admin)` | `service_role` | |
| `reject_campaign(_id, _admin, _reason)` | `service_role` | |
| `suspend_campaign(_id, _admin, _reason)` | `service_role` | Stores prior_status in audit metadata. |
| `reactivate_campaign(_id, _admin)` | `service_role` | Restores from audit metadata. |
| `request_payout(_charity_group_id, _amount, _currency, _destination)` | `authenticated` | Client-callable. Verifies ownership. Verifies available balance ≥ amount via ledger sum. Inserts payout. |
| `approve_payout(_id, _admin)` | `service_role` | |
| `reject_payout(_id, _admin, _reason)` | `service_role` | |
| `mark_payout_paid(_id, _admin, _external_reference)` | `service_role` | Writes `ledger_entries` row of type `payout` with negative amount. Only place a payout decreases balance. |
| `get_charity_balances(_charity_group_id)` | `service_role` | Returns `{ totalRaisedDzd, availableBalanceDzd, pendingBalanceDzd, campaignCount, donorCount, donationCount }`. Server-fn wraps this. |

### Triggers

- `ensure_default_user_role` on `auth.users` — inserts `user_roles` row with `role = 'user'` on signup. Idempotent.
- `ledger_after_donation_paid` on `donations` — fires on `UPDATE OF status WHEN NEW.status = 'PAID'`. Inserts a `ledger_entries` row of type `donation` for `amount` linked to the donation's `charity_group_id`. **Only place donation money is recorded in the ledger.**
- `audit_logs_no_modify` on `audit_logs` — `BEFORE UPDATE OR DELETE` raises an exception. Append-only by trigger, not just RLS.
- `set_updated_at` (existing) — attached to all new tables that have `updated_at`.

### RLS policy matrix

| Table | anon | authenticated | service_role |
|-------|------|---------------|--------------|
| `user_roles` | none | SELECT own only; no writes | full |
| `profiles` | SELECT public | SELECT all; UPDATE own | full |
| `charity_groups` | SELECT only if `status = 'approved' AND verified = true` | SELECT own; no writes | full |
| `charity_applications` | none | SELECT/INSERT/UPDATE own; UPDATE only when `status IN ('more_info_required', 'draft')` | full |
| `charity_documents` | none | SELECT own app's docs | full |
| `payouts` | none | SELECT own charity's; INSERT only via `request_payout` RPC (RLS `WITH CHECK (false)`) | full |
| `ledger_entries` | none | SELECT own charity's; no writes | full |
| `audit_logs` | none | SELECT if `has_role(auth.uid(), 'admin')`; no writes | full |
| `notifications` | none | SELECT/UPDATE own; no inserts | full |
| `campaigns` | SELECT only if `status = 'published'` | full SELECT; INSERT/UPDATE only if user is verified charity group owner | full |
| `donations`, `payments`, `invoices` | none | existing rules preserved | full |

### Storage buckets (separate migration)

- `charity-documents` — private. Path convention `applications/{user_id}/{application_id}/{uuid}.{ext}`. RLS: `authenticated` can INSERT only at paths matching `applications/{auth.uid()}/`. SELECT forbidden for `authenticated`. Signed URLs only via `supabaseAdmin`.
- `campaign-images` — private. Path convention `campaigns/{charity_group_id}/{uuid}.{ext}`. Same RLS pattern.

Fallback: if SQL bucket creation fails, create the two buckets manually in the Supabase dashboard (Storage → New bucket → Private) and re-run just the policy portion of the migration.

## Part 2 — Auth & registration

### Verify Google OAuth auto-assigns `user`

The existing `handle_new_user` trigger creates the `profiles` row. The new `ensure_default_user_role` trigger adds the `user_roles` row. Both are idempotent and stack safely. If `handle_new_user` already does role assignment, the new trigger is a no-op (`ON CONFLICT (user_id) DO NOTHING`). If it does not, the new trigger fills the gap.

### Public form route

`/become-a-charity` — single-page, 4-section form (org info, representative, legal info, documents). Arabic UI, RTL, IBM Plex Sans Arabic. Uses the existing site header and footer.

### Server function

`submitCharityApplication` (POST) — validates with Zod, re-validates files server-side (size, MIME, storage path), inserts `charity_applications` row with status `submitted` and denormalized fields, inserts `charity_documents` rows, creates notifications for all admins. Returns `{ applicationId }`.

### Status page

`/my-charity-application` — shows the user's latest application status with admin notes. Arabic status labels. CTA to `/charity/dashboard` if approved.

### Components

- `src/components/hamla/wilaya-select.tsx` — static 58-wilaya Arabic list.
- `src/components/hamla/file-uploader.tsx` — drag-and-drop with size/MIME validation.

## Part 3 — Admin dashboard

### Layout

`/admin` is a layout route. Sidebar (collapses to a sheet on mobile) + topbar + `<Outlet />`. 404 (not 403) for non-admins.

### Routes

| Route | Purpose |
|-------|---------|
| `/admin` | Totals dashboard (users, charities, campaigns, donations, payouts, recent activity) |
| `/admin/charities` | List of applications, filterable by status |
| `/admin/charities/$id` | Single application, document download via 5-min signed URL through server redirect |
| `/admin/campaigns` | List of all campaigns, filterable by status and certification |
| `/admin/campaigns/$id` | Single campaign with publish, reject, suspend, reactivate, certify, remove-certification actions |
| `/admin/payouts` | List of all payouts, filterable by status |
| `/admin/payouts/$id` | Single payout with approve, reject, mark-paid actions |
| `/admin/donations` | Read-only donation list |
| `/admin/donations/$id` | Read-only donation detail |
| `/admin/audit-log` | Read-only audit log viewer, paginated 50/page |
| `/admin/settings` | SlickPay stub status (placeholder until real provider wired) |

### Server functions

- `requireAdmin(userId)` in `src/lib/server/admin/guard.server.ts` — first line of every admin server-fn.
- `getAdminDashboardTotals` in `src/lib/server/admin/dashboard.server.ts`
- `listCharityApplications`, `getCharityApplication`, `getCharityDocumentSignedUrl`, `approveCharityApplication`, `rejectCharityApplication`, `requestMoreInfo` in `src/lib/server/admin/charities.server.ts`
- `listCampaigns`, `getCampaignForReview`, `publishCampaign`, `rejectCampaign`, `suspendCampaign`, `reactivateCampaign`, `certifyCampaign`, `removeCampaignCertification` in `src/lib/server/admin/campaigns.server.ts`
- `listPayouts`, `getPayoutForReview`, `approvePayout`, `rejectPayout`, `markPayoutPaid` in `src/lib/server/admin/payouts.server.ts`
- `listDonations`, `getDonationForReview` in `src/lib/server/admin/donations.server.ts` (read-only)

### Components

- `src/components/hamla/admin-sidebar.tsx`
- `src/components/hamla/admin-topbar.tsx`
- `src/components/hamla/status-badge.tsx` — reusable Arabic status badge for all enums
- `src/components/hamla/confirm-dialog.tsx` — generic confirm with optional reason textarea

## Part 4 — Charity group dashboard

### Routes

| Route | Purpose |
|-------|---------|
| `/charity` | Dashboard (KPI cards, recent campaigns, recent ledger activity) |
| `/charity/campaigns` | Full list of the charity's campaigns |
| `/charity/campaigns/new` | 4-step creation wizard (info, beneficiary, financial, review) |
| `/charity/campaigns/$id` | Campaign management (edit fields, pause, resume) |
| `/charity/campaigns/$id/analytics` | Donations-over-time chart (recharts) |
| `/charity/payouts` | Payout history |
| `/charity/payouts/new` | Payout request form (CCP / Bank / Baridimob) |
| `/charity/payouts/$id` | Payout detail (read-only) |
| `/charity-profile/$slug` | Public charity profile (anonymous-accessible) |

### Server functions

- `getCharityDashboard` in `src/lib/server/charity/dashboard.server.ts`
- `getCharityBalances` in `src/lib/server/charity/balances.server.ts` (wraps the SQL function)
- `listMyCampaigns`, `getMyCampaign`, `createCampaign`, `updateCampaign`, `pauseCampaign`, `resumeCampaign` in `src/lib/server/charity/campaigns.server.ts`
- `listMyPayouts`, `getMyPayout`, `requestMyPayout` in `src/lib/server/charity/payouts.server.ts`
- `getCampaignAnalytics` in `src/lib/server/charity/analytics.server.ts`

### Campaign creation flow (REVISED — moderation queue)

`createCampaign` inserts with `status = 'submitted'`, NOT `published`. Verified charities do not auto-publish. Admin clicks "نشر" in `/admin/campaigns/$id` to publish. The charity sees a "قيد المراجعة" badge. This is a safety guard against a compromised charity account pushing bad content live.

### Components

- `src/components/hamla/campaign-preview.tsx` — read-only preview for the wizard step 4
- `src/components/hamla/payout-method-fields.tsx` — CCP / Bank / Baridimob sub-forms
- `src/components/hamla/balance-card.tsx` — KPI card
- `src/components/hamla/charity-public-profile.tsx` — public profile

## Part 5 — Donor-facing

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Renders the seed campaign via `<CampaignPage slug="aidez-famille-ahmed" />` (existing behavior preserved) |
| `/c` | Campaign listing grid with filters (category, wilaya, certified-only, verified-charity-only, sort) |
| `/c/$slug` | Single campaign page with realtime updates |
| `/dashboard/donations` | My donations list with receipt links |
| `/dashboard/profile` | My profile (name, avatar, role badge) |

### Server functions

- `listCampaigns`, `getPublicCampaign` in `src/lib/server/donor/campaigns.server.ts`
- `listMyDonations` in `src/lib/server/donor/donations.server.ts`

### Modified `startDonation`

`src/lib/donations.functions.ts` — `startDonation` is updated to write the denormalized `charity_group_id` on the `donations` row by joining on `campaigns.charity_group_id` at insert time. The ledger trigger reads this column — no runtime join in the hot path. Everything else in the function is unchanged.

### Realtime

`src/lib/realtime.ts` exports `useCampaignRealtime(slug, onUpdate)`. Subscribes to `postgres_changes` on the `campaigns` table filtered by id. Invalidates the TanStack Query for the campaign on update. Used on `/c/$slug` only. The seed at `/` is static.

### Checkout flow

The "تبرع الآن" button opens `<DonateDialog>` (modified to host `<DonationForm />`):

1. If not logged in: single "المتابعة باستخدام Google" button. No email/password.
2. Amount picker: 500 / 1,000 / 2,000 / 5,000 / 10,000 دج chips, plus custom input (100–1,000,000).
3. Anonymous toggle: replaces donor name with "متبرع مجهول" on public list.
4. Optional message (≤ 300 chars).
5. "متابعة إلى الدفع" → `startDonation` server-fn.

### Components

- `src/components/hamla/campaign-page.tsx` — extracted reusable campaign page (replaces inline content of existing `index.tsx`)
- `src/components/hamla/campaign-card.tsx` — reusable card for listing grid
- `src/components/hamla/donation-form.tsx` — 3-step form inside `<DonateDialog>`
- `src/components/hamla/certified-badge.tsx` — exports `<CharityVerifiedBadge />` and `<CampaignCertifiedBadge />` as visually distinct components

## Part 6 — Invoices

### Verify existing flow

The existing `finalize_donation` function returns `{ status, invoice_number }` in its JSON response, confirming invoice creation is part of the finalize path. The `invoices` table has a unique FK on `donation_id`, enforcing one invoice per donation. **No changes to the existing trigger or function.** Verification step: run a test donation in the sandbox provider and confirm an `invoices` row appears with a non-null `invoice_number`.

### Add: `getInvoice` server function

`src/lib/server/invoices.server.ts` exports `getInvoice(invoiceNumber)`:
- Returns the full invoice (donation, donor, campaign, charity, payment provider label) for display.
- Gated: a donor sees only their own invoice; an admin sees any.
- Used by the existing `/receipt/$reference` page and by the admin donations detail view.

### PDF receipts — DEFERRED to v1.1

The existing `/receipt/$reference` page supports browser print-to-PDF via `window.print()`. This is the v1 path. A real PDF library (`@react-pdf/renderer` or similar) is deferred because Arabic text rendering in headless PDFs is fragile and not needed for v1.

## SlickPay stub

`src/lib/payments/slickpay-provider.server.ts`:
- Implements the existing `PaymentProvider` interface.
- Every method throws `PaymentGatewayError("بوابة SlickPay غير مهيأة بعد. أرسل الوثائق الرسمية لفريق حملة.")`.
- `id = "slickpay"`, `label = "SlickPay"`.

`src/lib/payments/index.server.ts`:
- `getPaymentProvider(id?)` now matches `slickpay` (case-insensitive) in addition to the existing `sandbox` and default `algerian-gateway`.
- `isPaymentGatewayConfigured()` returns `true` for `sandbox`; for `slickpay`, it returns `true` only if `SLICKPAY_PUBLIC_KEY` and `SLICKPAY_SECRET_KEY` are set, but the provider will still throw at runtime (config present but not implemented). This is intentional: the admin settings page checks `isPaymentGatewayConfigured()` to show a warning, not an error.

## Environment variables

Required (app refuses to start without these):

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWKS_URL
APP_URL
PAYMENT_GATEWAY_URL
PAYMENT_MERCHANT_ID
PAYMENT_API_KEY
PAYMENT_SECRET
PAYMENT_CALLBACK_URL
```

SlickPay-specific (add now, leave empty until real docs are provided):

```
SLICKPAY_PUBLIC_KEY
SLICKPAY_SECRET_KEY
SLICKPAY_CALLBACK_URL
PAYMENT_PROVIDER          # "algerian-gateway" | "sandbox" | "slickpay"
```

Optional:

```
EMAIL_PROVIDER_API_KEY    # for receipt emails, v1.1
PLATFORM_FEE_PERCENT      # reserved, defaults to 0
MIN_DONATION              # defaults to 100
MAX_DONATION              # defaults to 1_000_000
```

`.env.example` lists names and Arabic comments only. **No values are committed.**

## Build handoff — six parts, six stop points

| Part | Files added | Files modified | Verification before sign-off |
|------|-------------|----------------|------------------------------|
| 1. Database | 2 SQL, 1 TS (`types.ts`) | `types.ts` | Migration applies; `has_role` returns true for your admin uid; `get_charity_balances` works |
| 2. Auth & application | 6 TS/TSX | `site-header.tsx` | Submit a test application; see it in `charity_applications`; admin sees it |
| 3. Admin | 22 TSX/TS | `site-header.tsx` | Approve the test application; user becomes `charity_group`; audit log records it |
| 4. Charity dashboard | 15 TS/TSX | `donations.functions.ts`, `donate-dialog.tsx` | Submit a campaign as approved charity; see `submitted` status |
| 5. Donor + checkout | 13 TS/TSX | `index.tsx`, `site-header.tsx` | Complete a sandbox donation; campaign `raised_amount` updates; ledger entry appears; receipt downloadable |
| 6. Invoices | 1 TS | none | Receipt page shows invoice number; `invoices` row exists; admin can view it |

## Out of scope for v1 (documented for follow-up)

- Email notifications (in-app only in v1).
- PDF receipts (browser print-to-PDF in v1).
- Real SlickPay integration (stub in v1; replace when docs arrive).
- Re-submission of `more_info_required` applications (user can see notes, cannot edit-and-resubmit).
- `suspend_charity` / `suspend_user` / `reactivate_user` admin actions (enum reserved, no UI).
- Email-based charity application status updates.
- Real-time notifications (notifications are polled on page load).
- Mobile app (web-only).
- Multi-language UI (Arabic only in v1; RTL throughout).

## What the implementation will NOT do

- Will not embed any of the secret values (Supabase service role, SlickPay keys) in any file. They go in your `.env` only.
- Will not push to `main` or rewrite git history. Feature branch only.
- Will not change `finalize_donation`'s body.
- Will not remove the existing `campaigns.verified` column.
- Will not invent SlickPay endpoints.
- Will not auto-advance between parts without your "Part N done" confirmation.
