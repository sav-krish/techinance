# Supabase setup

Techinance uses Supabase Auth for first-party email-and-password accounts and
Supabase Postgres for private Story Mode progress. This document is the launch
checklist for the configured project.

## 1. Apply the database schema

In the Supabase dashboard, open **SQL Editor**, create a query, paste all of
[`supabase/schema.sql`](supabase/schema.sql), and run it.

The schema is safe to run again. It creates or updates:

- `profiles` with a learner-controlled display name and a private-by-default
  leaderboard preference
- `episode_progress` and `earned_badges` for the signed-in learner only
- Row Level Security policies that restrict each learner to their own records
- `leaderboard()` which returns only opted-in aliases and aggregate totals
- `reset_my_progress()` for an authenticated learner's own progress

## 2. Configure Auth securely

In **Authentication → Providers**:

- Enable **Email**.
- Keep third-party social sign-in providers disabled unless they are separately
  reviewed and added to the privacy policy.
- Keep **Confirm email** enabled. This protects account ownership when an
  account is created. It does not send an email during ordinary password
  sign-ins.
- Set a password policy of at least 12 characters. Require upper- and
  lower-case letters, a number, and a symbol if the project settings provide
  those controls. Enable leaked-password protection where available.

In **Authentication → URL Configuration**:

- **Site URL:** `https://sav-krish.github.io/techinance/`
- **Redirect URLs:**

  ```text
  https://sav-krish.github.io/techinance/learn.html
  ```

Add a separate exact URL only when a new account-related page is deployed.

Add CAPTCHA or Turnstile for sign-up, sign-in, and password recovery after its
site keys have been created. It adds abuse protection without weakening the
email confirmation requirement.

## 3. Client configuration

In **Project Settings → API**, copy the project URL and **publishable** key to
[`supabase-config.js`](supabase-config.js):

```js
export const SUPABASE_URL = "https://<project-ref>.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_...";
```

The URL and publishable key are intended for browser use. Never put a
`service_role` key in this repository, in a browser bundle, or in a GitHub Pages
secret exposed to frontend code. A service-role key bypasses Row Level Security.

## Privacy model

- Supabase Auth processes account passwords. The site does not store raw
  passwords in its JavaScript, local progress cache, or database tables.
- Supabase persists a signed-in session token in the browser so a learner stays
  signed in. It is not their password. Signing out or clearing browser data
  removes the local session.
- Browser storage can hold a local progress copy for offline continuity. The
  page never reads a device-wide roster or renders identities saved by other
  people using the same browser.
- Row Level Security allows a learner to read and modify only their own profile,
  progress, and badges.
- A learner is absent from the leaderboard unless they explicitly opt in. The
  leaderboard returns only an alias, total XP, badge count, and episode count.
  It never returns email addresses, profile images, answers, or scene history.

Keep the Privacy Policy and Terms aligned with any future change to what is
stored, shared, or displayed.

## Progress integrity

XP is calculated in the browser, so it is suitable for personal progress but
not for prizes or high-stakes ranking. The schema caps XP per episode, which
rejects obvious invalid values. A competition-grade score system would require
server-side grading and validation.

## How the code fits together

```text
supabase-config.js  Project URL and publishable browser key.
supabase.js         Supabase Auth, private progress sync, and opt-in leaderboard RPC.
auth.js             First-party email/password session state and navigation controls.
progress-sync.js    Local-first progress cache plus authenticated push and pull.
leaderboard.js      Remote opt-in board only. Never reads device identity caches.
supabase/schema.sql Tables, RLS policies, trigger, and database functions.
```
