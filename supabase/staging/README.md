# Mobile staging fixtures

This directory contains synthetic, staging-only infrastructure for the Phase 1
mobile architecture spike. It is intentionally outside `supabase/migrations` and
must never be applied to production.

`phase1_mobile_spike.sql` fails before making changes unless the linked database
contains the private `mobile_staging.fixture_manifest` marker created for the
RailCommand Mobile Staging project. The script contains no customer or production
data.

Apply only after verifying the linked project is `cyacardivfzrsravqjto`:

```sh
supabase projects list
supabase db query --linked --file supabase/staging/phase1_mobile_spike.sql
supabase db advisors --linked --type security --level warn
```
