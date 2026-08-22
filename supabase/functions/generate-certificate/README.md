# generate-certificate

Issues a course completion certificate: draws the PDF, stores it, records it,
and emails it.

## What it checks before issuing

1. **Who is asking.** The caller's access token is verified against Supabase
   Auth. The user id and email come from that token. Nothing identifying is read
   from the request body.
2. **Whether they finished.** Every episode the course requires must be marked
   complete in `episode_progress` for that user, read here rather than reported
   by the browser.

Both are refusals with a real status code: `401` if there is no valid session,
`403` if any unit is outstanding. The browser must not fall back to drawing a
certificate locally when it sees either.

## What it deliberately does not solve

`episode_progress` is still written by the browser, so someone determined can
mark episodes complete without playing them. Closing that needs the scene graph
to run server-side, which is a much larger change and probably not worth it for
free learning content. What this does close is the case where no play was
required at all, and forging a certificate now means forging progress under your
own signed-in account.

## Deploying

```bash
supabase functions deploy generate-certificate --project-ref <ref>
```

Run `supabase/migrations/20260812_certificates.sql` first. It creates the table,
the one-certificate-per-course unique index the upsert depends on, and a
**private** storage bucket.

### Secrets

| Name | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Provided by the platform. |
| `SUPABASE_ANON_KEY` | yes | Used only to verify the caller's token. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Reads progress and writes storage. Never goes near the browser. |
| `RESEND_API_KEY` | no | Without it the certificate is still issued and stored, just not emailed. |
| `RESEND_SENDER_EMAIL` | no | Defaults to the Resend onboarding sender. |

```bash
supabase secrets set RESEND_API_KEY=... RESEND_SENDER_EMAIL="Techinance <hello@example.org>"
```

### Allowed origins

`ALLOWED_ORIGINS` in `index.ts` is the CORS allowlist. Add any new site origin
there; a wildcard is what made the previous version cheap to abuse.

## Adding a course

Add it to `courses.ts` **and** to `COURSE_DEFINITIONS` in
`certificate-generator.js`. A test asserts the two lists match exactly, and that
neither names an episode that does not exist — that check is there because
`financial-literacy` once required `fin-u3`, a unit that was never written,
which made its certificate impossible to earn.
