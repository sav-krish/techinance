// @ts-check

/**
 * Supabase configuration for the Techinance static site.
 *
 * Supabase provides private email-and-password accounts, cross-device learning
 * progress, and the optional public leaderboard. This site never stores a raw
 * password. Supabase Auth handles password verification and session issuance.
 *
 * BOTH VALUES BELOW ARE PUBLIC BY DESIGN. The anon key is meant to ship in
 * browser code; it identifies the project and nothing else. Row Level Security,
 * which supabase/schema.sql turns on for every table, is what actually protects
 * the data. Never paste the `service_role` key here: that one bypasses RLS
 * entirely and would let anyone rewrite every learner's score.
 *
 * PRODUCTION SETTINGS
 * -------------------
 * `supabase/config.toml` is the source of truth for the live Auth service. It
 * limits redirects to Techinance pages, enables a one-time confirmation when a
 * new account is created, requires a strong password, rotates refresh tokens,
 * and keeps Google sign-in disabled. Apply it with `supabase config push`.
 *
 * WHAT THIS DOES AND DOESN'T PROTECT
 * ----------------------------------
 * Supabase verifies identity, so learners cannot impersonate one another.
 * The schema restricts each learner to their own progress records. The
 * leaderboard returns only accounts that deliberately opt in, with their chosen
 * display name and aggregate learning totals.
 *
 * It does not by itself verify *scores*. XP is still calculated in the browser
 * and sent up, so a determined learner with devtools can still post a number
 * they didn't earn. schema.sql caps XP per episode at a sane ceiling, which
 * stops the obvious "set it to a million" case. Making scores fully tamper-proof
 * needs the scene graph to run server-side, which is a much larger change and
 * probably not worth it for free learning content.
 *
 * Leaving these empty keeps the learning hub signed out. It never creates a
 * browser-only account or silently saves an identity outside Supabase.
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
 * True when both values are filled in.
 *
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return SUPABASE_URL.trim() !== "" && SUPABASE_ANON_KEY.trim() !== "";
}
