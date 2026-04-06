# Supabase SMTP Setup (Resend)

Supabase's built-in email service throttles to **3 emails per hour**. This guide configures Resend as a custom SMTP provider to remove that limit.

**Supabase project:** `gwvftrrknusdfdgiwuij.supabase.co`

---

## 1. Navigate to SMTP Settings

Open the Supabase Dashboard for the project:

- Go to **Authentication** > **Settings** > **SMTP Settings**
  _(Older dashboard versions: Authentication > Email Templates > SMTP Settings)_

---

## 2. Configure SMTP

| Setting            | Value                                |
|--------------------|--------------------------------------|
| Enable Custom SMTP | **ON**                               |
| Host               | `smtp.resend.com`                    |
| Port               | `465`                                |
| Username           | `resend`                             |
| Password           | _(RESEND_API_KEY from Vercel env vars)_ |
| Sender name        | `RailCommand`                        |
| Sender email       | `noreply@railcommand.a5rail.com`     |
| Minimum interval   | `0` seconds                          |

Click **Save**.

---

## 3. What This Affects

All Supabase Auth emails will now route through Resend:

- Sign-up confirmation
- Password reset
- Magic link
- Email change confirmation

---

## 4. How to Test

1. Open the RailCommand login page.
2. Click "Forgot password" and enter a valid email address.
3. Verify the reset email arrives from `noreply@railcommand.a5rail.com`.
4. Check the Resend dashboard for delivery status if the email does not arrive.

---

## 5. Important Notes

- The `RESEND_API_KEY` must have sending permission for the `railcommand.a5rail.com` domain in Resend.
- Google OAuth sign-in is **unaffected** by this change.
- The 3/hour throttle only applies to Supabase's built-in mailer. Once custom SMTP is configured, Supabase imposes no send-rate limit (Resend handles its own rate limiting).
- The minimum interval of 0 seconds is safe because Resend manages rate limiting on their end.
