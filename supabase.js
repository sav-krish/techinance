// @ts-check

/**
 * The Supabase layer: private password accounts, progress sync, and the
 * cross-device leaderboard.
 *
 * DESIGN: local first, remote second.
 *
 * Gameplay never waits on the network. story-engine.js keeps writing XP and
 * badges to localStorage through progress.js exactly as before, so a scene
 * advances at the speed of a click whether the connection is good, bad or
 * absent. This module pushes that local state up afterwards, and pulls it back
 * down when a learner signs in somewhere new.
 *
 * That ordering is deliberate. The alternative, writing to Postgres on every
 * scene, would put a round trip between a learner tapping an answer and seeing
 * whether they got it right, on school wifi, for no benefit.
 *
 * Account-only Story Mode intentionally has no guest fallback. If Supabase is
 * unavailable, the learning hub remains signed out instead of creating an
 * unverified local identity.
 */

import { createClient } from "@supabase/supabase-js";

import { getProgress } from "./progress.js";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "./supabase-config.js";

/** @typedef {{ id: string, name: string, email: string, picture: string }} RemoteUser */
/** @typedef {{ isCurrentUser: boolean, name: string, xp: number, badges: number, episodes: number }} BoardRow */

/** Episodes whose progress is worth syncing. Unknown ids are ignored. */
const EPISODE_IDS = ["cyber-u1", "cyber-u2", "cyber-u3", "cyber-u4", "fin-u1", "fin-u4"];

/** Matches the CHECK constraint in supabase/schema.sql. */
const MAX_EPISODE_XP = 2000;

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
let client = null;

/**
 * The Supabase client, or null when the project isn't configured.
 *
 * Created lazily so that a site with an empty config never constructs one and
 * never opens a connection.
 *
 * @returns {import("@supabase/supabase-js").SupabaseClient | null}
 */
export function supabase() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Handles the one-time email confirmation return during account setup.
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  }
  return client;
}

/** @returns {boolean} */
export function isRemoteEnabled() {
  return supabase() !== null;
}

/**
 * Turns a Supabase auth user into the shape the rest of the site already uses.
 *
 * @param {import("@supabase/supabase-js").User} user
 * @returns {RemoteUser}
 */
function toRemoteUser(user) {
  const meta = user.user_metadata ?? {};
  const name = (typeof meta.display_name === "string" && meta.display_name.trim()) || "Learner";
  return {
    id: user.id,
    name,
    email: user.email ?? "",
    picture: "",
  };
}

/**
 * The signed-in Supabase user, or null.
 *
 * @returns {Promise<RemoteUser | null>}
 */
export async function getRemoteUser() {
  const db = supabase();
  if (!db) {
    return null;
  }
  const { data, error } = await db.auth.getSession();
  if (error || !data.session) {
    return null;
  }
  return toRemoteUser(data.session.user);
}

/**
 * @returns {string | undefined}
 */
function accountReturnUrl() {
  if (typeof window === "undefined") {
    return undefined;
  }
  return new URL("learn.html", window.location.href).href;
}

/**
 * Normalizes data which is allowed to become a profile display name. Account
 * email addresses and provider names are deliberately never used as a fallback.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeDisplayName(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 32);
}

/**
 * Creates a Techinance email-and-password account.
 *
 * When Supabase email confirmation is enabled, successful account creation
 * yields no session until the learner uses that one confirmation message. Normal
 * password sign-in does not send mail.
 *
 * @param {{ email: string, password: string, displayName: string }} credentials
 * @returns {Promise<{ ok: boolean, error: string, requiresEmailConfirmation: boolean }>}
 */
export async function signUpWithPassword(credentials) {
  const db = supabase();
  if (!db) {
    return {
      ok: false,
      error: "Accounts are temporarily unavailable. Please try again shortly.",
      requiresEmailConfirmation: false,
    };
  }

  const email = credentials.email.trim().toLowerCase();
  const displayName = normalizeDisplayName(credentials.displayName);
  const redirectTo = accountReturnUrl();
  const options = {
    data: { display_name: displayName },
    ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
  };
  try {
    const { data, error } = await db.auth.signUp({
      email,
      password: credentials.password,
      options,
    });
    if (error) {
      return {
        ok: false,
        error: "We couldn't create your account. Check the details and try again.",
        requiresEmailConfirmation: false,
      };
    }
    return {
      ok: true,
      error: "",
      requiresEmailConfirmation: !data.session,
    };
  } catch {
    return {
      ok: false,
      error: "We couldn't create your account. Check the details and try again.",
      requiresEmailConfirmation: false,
    };
  }
}

/**
 * Starts a normal email-and-password session.
 *
 * The message stays deliberately generic so an attacker cannot use this form to
 * discover whether a particular email address has an account.
 *
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ ok: boolean, error: string }>}
 */
export async function signInWithPassword(credentials) {
  const db = supabase();
  if (!db) {
    return { ok: false, error: "Accounts are temporarily unavailable. Please try again shortly." };
  }
  try {
    const { error } = await db.auth.signInWithPassword({
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    });
    return error
      ? { ok: false, error: "We couldn't sign you in. Check your email and password." }
      : { ok: true, error: "" };
  } catch {
    return { ok: false, error: "We couldn't sign you in. Check your email and password." };
  }
}

/** @returns {Promise<void>} */
export async function signOutRemote() {
  const db = supabase();
  if (db) {
    await db.auth.signOut();
  }
}

/**
 * Reads the signed-in learner's private leaderboard settings.
 *
 * @returns {Promise<{ ok: boolean, displayName: string, leaderboardVisible: boolean, error: string }>}
 */
export async function getProfilePrivacy() {
  const db = supabase();
  const remote = await getRemoteUser();
  if (!db || !remote) {
    return { ok: false, displayName: "Learner", leaderboardVisible: false, error: "Not signed in." };
  }

  const { data, error } = await db
    .from("profiles")
    .select("display_name, leaderboard_visible")
    .eq("id", remote.id)
    .maybeSingle();
  if (error) {
    return { ok: false, displayName: "Learner", leaderboardVisible: false, error: error.message };
  }
  return {
    ok: true,
    displayName: normalizeDisplayName(data?.display_name || remote.name || "Learner") || "Learner",
    leaderboardVisible: data?.leaderboard_visible === true,
    error: "",
  };
}

/**
 * Saves an alias and whether the learner wants their aggregate totals shown on
 * the public leaderboard. This writes only the current learner's RLS-protected
 * profile row.
 *
 * @param {{ displayName: string, leaderboardVisible: boolean }} settings
 * @returns {Promise<{ ok: boolean, error: string }>}
 */
export async function updateProfilePrivacy(settings) {
  const db = supabase();
  const remote = await getRemoteUser();
  if (!db || !remote) {
    return { ok: false, error: "Not signed in." };
  }

  const displayName = normalizeDisplayName(settings.displayName);
  if (displayName.length < 2 || displayName.includes("@")) {
    return { ok: false, error: "Choose a nickname between 2 and 32 characters, without an email address." };
  }

  const { error } = await db.from("profiles").upsert(
    {
      id: remote.id,
      display_name: displayName,
      leaderboard_visible: settings.leaderboardVisible === true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    return { ok: false, error: "We couldn't save those privacy settings. Please try again." };
  }

  // Keep the signed-in account's own greeting consistent with its chosen alias.
  // A failure here does not expose data or undo the already-private profile save.
  try {
    await db.auth.updateUser({ data: { display_name: displayName } });
  } catch {
    // The profile setting is already saved. A later session refresh will still
    // use the private profile row for the leaderboard.
  }
  return { ok: true, error: "" };
}

/**
 * Runs `cb` whenever the Supabase session changes.
 *
 * @param {(user: RemoteUser | null) => void} cb
 * @returns {() => void} unsubscribe
 */
export function onRemoteAuthChange(cb) {
  const db = supabase();
  if (!db) {
    return () => {};
  }
  const { data } = db.auth.onAuthStateChange((_event, sessionValue) => {
    cb(sessionValue ? toRemoteUser(sessionValue.user) : null);
  });
  return () => data.subscription.unsubscribe();
}

/* ------------------------------------------------------------------ */
/* progress sync                                                       */
/* ------------------------------------------------------------------ */

/**
 * Pushes one learner's local progress up.
 *
 * Uses upsert on the composite key, so this is idempotent: syncing twice writes
 * the same rows. XP is clamped to the same ceiling the database enforces, so a
 * corrupted local store produces a rejected row rather than a failed batch.
 *
 * @param {string} localUserId the id progress.js stores under
 * @returns {Promise<{ ok: boolean, error: string }>}
 */
export async function pushProgress(localUserId) {
  const db = supabase();
  if (!db) {
    return { ok: false, error: "Supabase isn't configured." };
  }
  const remote = await getRemoteUser();
  if (!remote) {
    return { ok: false, error: "Not signed in." };
  }

  const progress = getProgress(localUserId);

  const episodeRows = EPISODE_IDS.filter((id) => progress.episodes[id]).map((id) => {
    const state = progress.episodes[id];
    return {
      user_id: remote.id,
      episode_id: id,
      xp: Math.max(0, Math.min(MAX_EPISODE_XP, Math.round(state.xp))),
      completed: state.completed === true,
      scene_id: state.sceneId,
      updated_at: new Date().toISOString(),
    };
  });

  const badgeRows = progress.badges.map((badgeId) => ({
    user_id: remote.id,
    badge_id: badgeId,
  }));

  if (episodeRows.length > 0) {
    const { error } = await db
      .from("episode_progress")
      .upsert(episodeRows, { onConflict: "user_id,episode_id" });
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  if (badgeRows.length > 0) {
    const { error } = await db
      .from("earned_badges")
      .upsert(badgeRows, { onConflict: "user_id,badge_id", ignoreDuplicates: true });
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true, error: "" };
}

/**
 * Reads this learner's progress back down.
 *
 * Used when someone signs in on a new device. The caller decides what to do with
 * it: this returns data rather than writing to localStorage, because merging two
 * sets of progress is a policy question (highest XP wins? most recent?) that
 * belongs with the caller, not down here.
 *
 * @returns {Promise<{ episodes: Record<string, { xp: number, completed: boolean, sceneId: string | null }>, badges: string[] } | null>}
 */
export async function pullProgress() {
  const db = supabase();
  if (!db) {
    return null;
  }
  const remote = await getRemoteUser();
  if (!remote) {
    return null;
  }

  const [episodesResult, badgesResult] = await Promise.all([
    db.from("episode_progress").select("episode_id, xp, completed, scene_id"),
    db.from("earned_badges").select("badge_id"),
  ]);

  if (episodesResult.error || badgesResult.error) {
    return null;
  }

  /** @type {Record<string, { xp: number, completed: boolean, sceneId: string | null }>} */
  const episodes = {};
  for (const row of episodesResult.data ?? []) {
    episodes[row.episode_id] = {
      xp: row.xp ?? 0,
      completed: row.completed === true,
      sceneId: row.scene_id ?? null,
    };
  }

  return {
    episodes,
    badges: (badgesResult.data ?? []).map((row) => row.badge_id),
  };
}

/**
 * Wipes this learner's remote progress. Pairs with the reset control on the
 * profile page, so resetting locally doesn't leave a stale score on the board.
 *
 * @returns {Promise<{ ok: boolean, error: string }>}
 */
export async function resetRemoteProgress() {
  const db = supabase();
  if (!db) {
    return { ok: false, error: "Supabase isn't configured." };
  }
  const { error } = await db.rpc("reset_my_progress");
  return error ? { ok: false, error: error.message } : { ok: true, error: "" };
}

/* ------------------------------------------------------------------ */
/* leaderboard                                                         */
/* ------------------------------------------------------------------ */

/**
 * The cross-device leaderboard, highest XP first.
 *
 * Reads through the `leaderboard()` function rather than the tables, because
 * Row Level Security deliberately forbids reading another learner's rows. The
 * function returns names and totals only.
 *
 * @param {number} [limit]
 * @returns {Promise<{ rows: BoardRow[], error: string }>}
 */
export async function fetchLeaderboard(limit = 50) {
  const db = supabase();
  if (!db) {
    return { rows: [], error: "Supabase isn't configured." };
  }
  const { data, error } = await db.rpc("leaderboard", { limit_count: limit });
  if (error) {
    return { rows: [], error: error.message };
  }
  /** @type {{ is_current_user: boolean, display_name: string, xp: number, badges: number, episodes: number }[]} */
  const raw = data ?? [];
  const rows = raw.map((row) => ({
    isCurrentUser: row.is_current_user === true,
    name: row.display_name || "Learner",
    xp: row.xp ?? 0,
    badges: row.badges ?? 0,
    episodes: row.episodes ?? 0,
  }));
  return { rows, error: "" };
}
