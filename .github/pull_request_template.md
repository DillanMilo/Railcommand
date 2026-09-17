## Change

Describe the user-visible behavior and why it changes.

## Web and mobile impact

Read [the change policy](../docs/WEB_MOBILE_CHANGE_POLICY.md) before implementation.

- Web:
- Native mobile (or reason not applicable):
- Shared API/domain/database:
- Offline classification and retained drafts/queues:
- Older installed app compatibility:
- Release plan and rollback:
- Deliberate gaps / linked follow-ups:

## Verification

- [ ] Both platforms assessed; every applicable change implemented or explicitly tracked.
- [ ] Authorization, retries/idempotency and conflicts checked where affected.
- [ ] Web -> mobile and mobile -> web behavior verified where affected.
- [ ] Offline/restart and queued-work upgrade behavior checked where affected.
- [ ] Relevant tests, TypeScript and builds passed; evidence below.
- [ ] Required physical-device checks recorded, including anything still pending.
- [ ] Deployment source retains existing mobile routes and compatible contracts.

Evidence and limitations:

Documentation-only changes: review content/links and mark runtime checks not applicable.
