# Shared mobile workspace — bounded implementation

Use the released web UI inside an isolated in-app WebView for online functionality.
Keep the native field tools, SQLite outbox, photos and RailBot. This replaces the
separate-screen parity project with reuse of the same authenticated web workflows.
External browser links alone do not count as in-app functionality.

Offline: workspace is **online-only**. Keep its current page mounted on network
loss, block navigation/reloads while offline, and warn before leaving edited forms.
Native field tools remain **offline draft/queue**. No existing queued item changes
identity or is removed by this work. Closing the workspace/app discards unsaved web
forms only after a visible warning when navigation is under app control; no claim
of durable web-form drafts is made.

Auth: verified native identity -> short-lived encrypted one-time handoff -> separate
Supabase web session. No native refresh token is copied into the page; no token in a
URL; no email is sent. Scope tickets to the verified account and same-origin path.
Require an already confirmed email, reject MFA downgrade, validate returned user ID,
recheck the pilot gate, use ephemeral WebView storage, and destroy it on account
change. All data access still uses the web user's existing RLS/permissions.

Downloads: bridge user-triggered web exports into the native share sheet using
bounded temporary user-owned files. Never forward authentication to external URLs.
Uploads use the existing web file inputs/system picker and existing server checks.

Verify synthetic auth/replay/expiry/account-isolation and web write/readback flows,
file upload/download, navigation and offline form retention. Test old native API
compatibility. Deploy the exact reviewed backend, stage/apply only the reviewed
same-day-log migration with a current recovery snapshot, then produce and assign
an internal iPhone build. Physical iPhone acceptance and external Apple review are
separate required gates, not inferred from an uploaded build.
