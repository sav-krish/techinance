// @ts-check

/**
 * Supabase configuration for the Techinance static site.
 *
 * Supabase gives this site two things it cannot do on its own: a Google sign-in
 * that is actually *verified* by a server, and a leaderboard that can see more
 * than one device. Without it the site still works, in guest mode, with a
 * device-local leaderboard. Filling these two values in is what switches it on.
 *
 * BOTH VALUES BELOW ARE PUBLIC BY DESIGN. The anon key is meant to ship in
 * browser code; it identifies the project and nothing else. Row Level Security,
 * which supabase/schema.sql turns on for every table, is what actually protects
 * the data. Never paste the `service_role` key here: that one bypasses RLS
 * entirely and would let anyone rewrite every learner's score.
 *
 * SETUP
 * -----
 * 1. Create a project at https://supabase.com/dashboard. Any region, free tier
 *    is fine for this.
 *
 * 2. Project Settings > API. Copy "Project URL" and the "anon public" key into
 *    the two constants at the bottom of this file.
 *
 * 3. Run the schema. SQL Editor > New query, paste the whole of
 *    `supabase/schema.sql`, and run it. That creates the tables, turns on Row
 *    Level Security, and adds the leaderboard function.
 *
 * 4. Turn on Google. This needs a Google OAuth client, which is a different
 *    thing from the browser-only client ID in auth-config.js:
 *
 *    a. In Supabase: Authentication > Providers > Google. Copy the "Callback
 *       URL (for OAuth)" it shows you. It looks like
 *       https://<project-ref>.supabase.co/auth/v1/callback
 *
 *    b. In https://console.cloud.google.com/ > APIs & Services > Credentials,
 *       create an OAuth client ID of type "Web application".
 *       - Authorized JavaScript origins: your site origins, no path,
 *         no trailing slash:
 *           http://localhost:4173
 *           http://localhost:5173
 *           https://<your-user>.github.io
 *       - Authorized redirect URIs: the Supabase callback URL from step 4a.
 *         This one DOES need to be exact, including https and the /auth/v1/callback path.
 *
 *    c. Copy the client ID *and* client secret back into the Supabase Google
 *       provider form, and enable it. The secret lives in Supabase, never in
 *       this repo.
 *
 * 5. Tell Supabase where it is allowed to send people after sign-in.
 *    Authentication > URL Configuration:
 *      - Site URL: https://<your-user>.github.io/techinance/
 *      - Redirect URLs: add every origin+path combination you use, e.g.
 *          http://localhost:4173/techinance/**
 *          https://<your-user>.github.io/techinance/**
 *    A redirect that isn't on this list is rejected, and sign-in will bounce
 *    back to the home page with an error.
 *
 * WHAT THIS DOES AND DOESN'T PROTECT
 * ----------------------------------
 * Supabase verifies *identity*: after this, a learner cannot claim to be
 * somebody else, which is the thing that matters most for a leaderboard.
 *
 * It does not by itself verify *scores*. XP is still calculated in the browser
 * and sent up, so a determined learner with devtools can still post a number
 * they didn't earn. schema.sql caps XP per episode at a sane ceiling, which
 * stops the obvious "set it to a million" case. Making scores fully tamper-proof
 * needs the scene graph to run server-side, which is a much larger change and
 * probably not worth it for free learning content.
 *
 * Leaving these empty is safe: the site falls back to guest mode and a
 * device-local leaderboard, exactly as it behaves today.
 */

/**
 * Project URL, e.g. "https://abcdefghijklm.supabase.co". No trailing slash.
 * @type {string}
 */
export const SUPABASE_URL = "https://olzrznsctcqujtmhczjh.supabase.co";

/**
 * The public client key. Safe to commit. Never the service_role key.
 * @type {string}
 */
export const SUPABASE_ANON_KEY = "sb_publishable_1ukz0dX9htcBpE4JnAeVSw_i1Jmedw8";

/**
 * True when both values are filled in. Everything Supabase-related checks this
 * first and degrades to local-only behaviour when it's false.
 *
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return SUPABASE_URL.trim() !== "" && SUPABASE_ANON_KEY.trim() !== "";
}
