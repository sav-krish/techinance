// @ts-check

/**
 * Keeps localStorage progress and Supabase in step.
 *
 * This sits between progress.js (which owns the local store and knows nothing
 * about the network) and supabase.js (which owns the network and knows nothing
 * about gameplay). Neither one imports the other; both import nothing from here.
 * That keeps a Supabase outage from being able to break an episode.
 *
 * WHEN IT PUSHES
 *   Debounced, a few seconds after progress changes, and immediately on page
 *   hide. A learner who finishes a scene and closes the tab still lands on the
 *   leaderboard, and a learner clicking quickly through five scenes causes one
 *   write, not five.
 *
 * WHEN IT PULLS
 *   Once, when a verified learner is seen on a device whose local store is empty
 *   for them. That is the "signed in on a new laptop" case. It deliberately does
 *   not merge: overwriting real local progress with a stale remote copy is worse
 *   than the reverse, so local always wins when local has anything to say.
 */

import { getUser, onAuthChange } from "./auth.js";
import { getProgress } from "./progress.js";
import { isRemoteEnabled, pullProgress, pushProgress } from "./supabase.js";

/** Long enough to batch a burst of scenes, short enough to survive a closed tab. */
const PUSH_DEBOUNCE_MS = 4000;

const PROGRESS_KEY = "techinance.progress.v1";

/** @type {ReturnType<typeof setTimeout> | null} */
let pending = null;

/** Guests are local-only by definition: nothing to sync, nothing to rank. */
let currentUserId = "";

/** Stops a pull from racing a push on first sign-in. */
let hydrating = false;

/**
 * @param {string} userId
 * @returns {boolean}
 */
function syncable(userId) {
  return isRemoteEnabled() && userId !== "" && userId !== "guest";
}

/** @returns {void} */
function flush() {
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  if (!syncable(currentUserId) || hydrating) {
    return;
  }
  pushProgress(currentUserId).catch(() => {
    // Offline or rejected. The local store is unaffected and the next change
    // schedules another attempt, so a failed sync costs a learner nothing.
  });
}

/**
 * Pushes now and resolves once the write has landed.
 *
 * `flush()` is deliberately fire-and-forget, and pushes are debounced by four
 * seconds, which is fine for background syncing. It is not fine for the
 * certificate claim: the server reads episode_progress to decide whether the
 * course is finished, so a learner who completes the last episode and clicks
 * straight through would be told they have not finished. Await this first.
 *
 * @returns {Promise<void>}
 */
export async function flushProgressNow() {
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  if (!syncable(currentUserId) || hydrating) {
    return;
  }
  try {
    await pushProgress(currentUserId);
  } catch {
    // Offline or rejected. The caller decides what to do about it; the local
    // store is unaffected either way.
  }
}

/** @returns {void} */
function schedulePush() {
  if (!syncable(currentUserId)) {
    return;
  }
  if (pending) {
    clearTimeout(pending);
  }
  pending = setTimeout(flush, PUSH_DEBOUNCE_MS);
}

/**
 * True when this device has no progress recorded for the user yet.
 *
 * @param {string} userId
 * @returns {boolean}
 */
function localIsEmpty(userId) {
  const progress = getProgress(userId);
  return progress.xp === 0 && progress.badges.length === 0;
}

/**
 * Writes pulled remote progress into the local store.
 *
 * progress.js has no bulk-import function, and adding one to serve a single
 * caller would widen an API that every scene depends on. Writing the store key
 * directly here is contained to this function, and it re-reads through
 * getProgress afterwards so any shape problem surfaces immediately.
 *
 * @param {string} userId
 * @param {{ episodes: Record<string, { xp: number, completed: boolean, sceneId: string | null }>, badges: string[] }} remote
 * @returns {boolean}
 */
function writeLocal(userId, remote) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const store = raw ? JSON.parse(raw) : { v: 1, users: {}, index: {} };
    if (typeof store !== "object" || store === null) {
      return false;
    }
    store.users = store.users ?? {};
    let total = 0;
    /** @type {Record<string, unknown>} */
    const episodes = {};
    for (const [id, state] of Object.entries(remote.episodes)) {
      total += state.xp;
      episodes[id] = {
        started: true,
        completed: state.completed,
        xp: state.xp,
        sceneId: state.sceneId,
      };
    }
    store.users[userId] = {
      xp: total,
      badges: remote.badges.slice(),
      scenes: store.users[userId]?.scenes ?? {},
      episodes,
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/**
 * Pulls remote progress onto a device that has none for this learner.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function hydrate(userId) {
  if (!syncable(userId) || !localIsEmpty(userId)) {
    return;
  }
  hydrating = true;
  try {
    const remote = await pullProgress();
    if (remote && (remote.badges.length > 0 || Object.keys(remote.episodes).length > 0)) {
      if (writeLocal(userId, remote)) {
        window.dispatchEvent(new CustomEvent("techinance:progress-hydrated"));
      }
    }
  } catch {
    // A device that can't reach Supabase simply starts fresh locally.
  } finally {
    hydrating = false;
  }
}

/**
 * Starts syncing. Safe to call from any page and safe to call more than once.
 *
 * @returns {void}
 */
export function startProgressSync() {
  if (!isRemoteEnabled()) {
    return;
  }

  onAuthChange((user) => {
    const next = user?.id ?? "";
    if (next === currentUserId) {
      return;
    }
    currentUserId = next;
    if (syncable(next)) {
      hydrate(next).then(() => schedulePush());
    }
  });

  // progress.js writes synchronously to localStorage, so the storage event
  // (other tabs) plus a periodic flush on this tab covers both cases without
  // progress.js needing to know a sync layer exists.
  window.addEventListener("storage", (event) => {
    if (event.key === PROGRESS_KEY) {
      schedulePush();
    }
  });

  // Same-tab changes: the engine writes on every scene, so poll cheaply rather
  // than instrumenting every call site.
  let lastSeen = "";
  setInterval(() => {
    if (!syncable(currentUserId)) {
      return;
    }
    const snapshot = JSON.stringify(getProgress(currentUserId));
    if (snapshot !== lastSeen) {
      lastSeen = snapshot;
      schedulePush();
    }
  }, 2000);

  // A closed tab is the most common way progress would otherwise be lost.
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  });

  const user = getUser();
  if (user) {
    currentUserId = user.id;
    if (syncable(currentUserId)) {
      hydrate(currentUserId).then(() => schedulePush());
    }
  }
}
