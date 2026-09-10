# Hosted staging bridge rehearsal — 2026-09-05

## Result

**Passed in RailCommand Mobile Staging** (`rxuvchdqbzvovqijvfhx`). Production
(`gwvftrrknusdfdgiwuij`) was not opened, queried, configured, or changed.

The exact hosted sequence was:

1. Read-only preflight against the private synthetic staging marker.
2. Additive bridge foundation migration.
3. Staging-only `assign_entity_number()` compatibility baseline, required because the
   synthetic staging fixture used a namespaced trigger function while production has
   the expected public function. The shim attached no trigger and wrote no row.
4. Additive write-hardening migration.
5. Transaction-rolled-back acceptance using the existing synthetic owner
   `railcommand-mobile-owner@creativecurrents.test`.
6. Read-only postflight.
7. Security Advisor review.

## Exact checked files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `supabase/staging/production_bridge_preflight.sql` | 3,851 | `3979a1c7e477a69060555f411fdb89279b32362c0acd7d5aef1255ad404a9143` |
| `supabase/migrations/20260903221812_production_mobile_bridge_foundation.sql` | 18,624 | `0918fb818daac834fb67c5e0ab256d5bfa82b4b0d12ecf4bb3a137cad3bdbcd9` |
| `supabase/staging/production_bridge_assign_number_baseline.sql` | 2,695 | `320857c0dc9df221dbe4827ad475293fc10b55f24e497f4d33e06b38aac952c1` |
| `supabase/migrations/20260903222219_production_mobile_write_hardening.sql` | 17,811 | `b51efdc98cd65fe11a0fbf4d89cb6bb5957da473500821718999bb1dd221c34d` |
| `supabase/staging/production_bridge_acceptance.sql` | 11,118 | `1d6a0fbe0e76c11ffbe4942c802e65a10ef600d36a3f75a3b30ee87eac754af2` |
| `supabase/staging/production_bridge_postflight.sql` | 5,733 | `8961ec12f54f8c7f70c3d62cb2564ece264396cb4f7574e8164b2d79d0d2f3e9` |

## Acceptance evidence

The hosted acceptance reported:

> PASS staging production-bridge acceptance; all fixture changes rolled back

It covered current membership permission checks, daily-log and photo idempotency,
uploaded-photo metadata denial, invitation acceptance, account-deletion safeguards,
and four-digit `RFI-1000` numbering. The first invitation attempt exposed a test-only
JWT omission: staging's restrictive membership policy checks the signed-in email
claim, which a real Supabase access token contains. The acceptance harness now includes
that claim and its focused test prevents regression.

The hosted read-only postflight then reported:

> PASS staging bridge postflight; contracts present and acceptance residue absent

This verified the new tables/functions, RLS, hardened photo policies, authenticated-
only RPC execution, anonymous denial, and absence of every exact rollback fixture.

Security Advisor showed **0 errors** and three reviewed warnings: the two intentionally
authenticated, ownership-checking deletion-request security-definer functions and the
project-level leaked-password-protection setting. No Advisor suggestion was applied.

## Data and offline boundary

No customer or production data was used. Acceptance mutations existed only inside a
transaction that ended with `ROLLBACK`; postflight verified zero residue. Existing
staging identities, memberships, passwords, and records were not persistently changed.

The bridge remains **online-only infrastructure**. Cached project/team/log data stays
**offline read-only**, while new daily logs and photos remain **offline draft/queue**.
A denied or unavailable backend must leave queued device work intact.

## Remaining gate

This closes only `staging-backend-rehearsal`. Production recovery evidence, a separately
authorized read-only live pilot, signed internal store betas, reviewer reconciliation,
store approval, rollout stability, and named operations ownership remain pending.
