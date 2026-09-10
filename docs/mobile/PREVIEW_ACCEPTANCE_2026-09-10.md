# September 10 staging Preview

The user approved proceeding with the prepared staging Preview and private
reviewer sign-in after the concrete deployment request in this task.

- Deployed source: `5ed222b307384611ae58dcdc12d3639482f45095`.
- Project: `railcommand-mobile-staging`, `prj_JWLbG1P1z06rCpN1bDI2DuugVpCy`.
- Deployment: `dpl_37ak9wcmcCa9vd3YAr5MKAoniEqS`.
- Exact URL: https://railcommand-mobile-staging-rdom3qft3-dillans-projects-f662840b.vercel.app
- Vercel inspection: `READY`, target `preview`.
- Source upload dry run checked 664 regular files; runtime environment files,
  credentials, backups, and generated native/export content were excluded.
- CLI rejected the production-only `--skip-domain` option before creating a
  deployment; the successful command used explicit Preview target.
- Existing staging hostname still resolves to `dpl_6KSvsv6dMLLMmSX31Who9AVxNmG3`.
- No migration, production deployment, account mutation, or domain reassignment.

The local reviewer runner and its assertion now target this exact deployment.
All 14 harness tests pass. Fresh deployed preflight passed application JSON,
no-store, and unauthenticated bootstrap rejection. This is not signed-in workflow
acceptance. No reviewer session or synthetic workflow record was created.

## Next action

Run in an interactive Terminal from this candidate worktree:

```sh
node --import tsx scripts/mobile/verify-preview-reviewer.mjs
```

Enter the existing `app-review@railcommand.io` app password at the hidden prompt.
It is not the database password. The bounded test retains one synthetic daily
log, photo, RFI, and Submittal, tests replay/readback, and ends its temporary session.
It does not reset credentials or delete previous records. Results are sanitized
into ignored `.vercel/phase5-signed-in-result.json`.

Computer Use denied Terminal access in this session. The user must launch this
command; no UI workaround or alternate credential retrieval was attempted.

Offline classification: online-only deployment/API acceptance. Supported device
work remains offline read-only or draft/queue as documented; existing device
storage, drafts, and outboxes are unchanged.
