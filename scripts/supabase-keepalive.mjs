// @ts-check

/**
 * Keeps the Supabase project awake.
 *
 * Free Supabase projects pause after 7 days without database activity, and a
 * paused project means sign-in stops working until somebody opens the dashboard
 * and restores it. A course site is exactly the usage pattern that trips this:
 * quiet stretches between cohorts, and nobody notices until a student reports
 * they can't log in.
 *
 * So this runs a trivial query twice a week. It reads the same
 * `supabase-config.js` the site does, rather than duplicating the URL and key
 * into GitHub variables, because two copies of a value drift apart eventually
 * and only one of them is the one the site actually uses.
 *
 * The query deliberately targets the private `profiles` table. The anonymous
 * key has no SELECT grant, so PostgREST normally returns PostgreSQL's 42501
 * "permission denied" response. That is an expected successful health check:
 * PostgreSQL received and evaluated the query, while no learner data was read.
 *
 * A future policy might instead return an empty array. That is also safe and
 * successful. Any other error, including an invalid key or a missing table,
 * must still fail loudly.
 *
 * Exit codes: 0 for pinged or deliberately skipped, 1 for a real failure.
 */

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "../supabase-config.js";

const TIMEOUT_MS = 20000;

if (!isSupabaseConfigured()) {
  console.log("Supabase isn't configured yet (supabase-config.js is empty). Nothing to ping.");
  process.exit(0);
}

const url = `${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`;
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

/**
 * Returns true only for the exact permission error expected from this
 * project's private profiles table. Do not broaden this: an arbitrary 401
 * could mean an invalid key or a broken Supabase configuration.
 *
 * @param {number} status
 * @param {string} body
 */
function isExpectedPrivateProfilesResponse(status, body) {
  if (status !== 401 && status !== 403) return false;

  try {
    const payload = JSON.parse(body);
    return (
      payload?.code === "42501" &&
      typeof payload?.message === "string" &&
      /permission denied for table profiles/i.test(payload.message)
    );
  } catch {
    return false;
  }
}

try {
  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    signal: controller.signal,
  });

  if (!response.ok) {
    const body = await response.text();

    if (isExpectedPrivateProfilesResponse(response.status, body)) {
      console.log(
        `Pinged ${SUPABASE_URL} successfully. ` +
          "The anonymous key was correctly denied access to private profiles (PostgreSQL 42501).",
      );
      process.exit(0);
    }

    console.error(`Ping failed: HTTP ${response.status} ${response.statusText}`);
    console.error(body.slice(0, 500));
    // Anything besides the exact privacy denial above can indicate an invalid
    // key, missing schema, or unavailable project. Fail rather than silently
    // letting the project pause a week later.
    process.exit(1);
  }

  const rows = await response.json();
  console.log(
    `Pinged ${SUPABASE_URL} successfully. ` +
      `Rows returned: ${Array.isArray(rows) ? rows.length : "unknown"} ` +
      `(0 is expected and correct: Row Level Security hides every profile from an anonymous caller.)`,
  );
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Ping failed: ${reason}`);
  process.exit(1);
} finally {
  clearTimeout(timer);
}
