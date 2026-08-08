// @ts-check

/**
 * Account state for the Techinance learning site.
 *
 * Authentication is handled only by Supabase Auth. This module deliberately
 * keeps no separate account record, password, or identity cache in browser
 * storage. Supabase keeps its session tokens so a learner can stay
 * signed in on their own browser; passwords never pass through local storage.
 */

import {
  getRemoteUser,
  isRemoteEnabled,
  onRemoteAuthChange,
  signInWithPassword,
  signOutRemote,
  signUpWithPassword,
} from "./supabase.js";

const LEARN_URL = "learn.html";
const PROFILE_URL = "profile.html";
const LEADERBOARD_URL = "leaderboard.html";

/**
 * @typedef {object} User
 * @property {string} id Stable Supabase user id and progress namespace.
 * @property {string} name Learner-chosen display name.
 * @property {string} email Private account email.
 * @property {string} picture Reserved for a future optional avatar.
 */

/** @type {User | null} */
let session = null;

/** @type {Set<(user: User | null) => void>} */
const listeners = new Set();

/** @type {Map<HTMLElement, () => void>} */
const navMounts = new Map();

/**
 * Aborts document-level listeners from a previous rendering of one nav mount.
 * @type {WeakMap<HTMLElement, AbortController>}
 */
const navControllers = new WeakMap();

let started = false;
let ready = false;

/** @type {() => void} */
let resolveReady = () => {};

/** @type {Promise<void>} */
const authReady = new Promise((resolve) => {
  resolveReady = () => resolve();
});

/**
 * Superseded browser-only identity records. They are removed once so an old
 * browser-only identity cannot continue to appear in this account system.
 * Supabase's own session key is intentionally not touched.
 */
const LEGACY_IDENTITY_KEYS = ["techinance.auth.v1", "techinance.roster.v1"];

/** @returns {void} */
function clearLegacyIdentityRecords() {
  try {
    for (const key of LEGACY_IDENTITY_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in a private browsing context.
  }
}

/** @returns {void} */
function settleReady() {
  if (!ready) {
    ready = true;
    resolveReady();
  }
}

/** @returns {void} */
function notify() {
  for (const listener of Array.from(listeners)) {
    try {
      listener(session);
    } catch {
      // One view must not prevent the remaining views from updating.
    }
  }
}

/**
 * @param {User | null} next
 * @returns {void}
 */
function setSession(next) {
  const unchanged = session?.id === next?.id && session?.name === next?.name && session?.email === next?.email;
  session = next;
  if (!unchanged) {
    notify();
  }
}

/**
 * @param {Awaited<ReturnType<typeof getRemoteUser>>} remote
 * @returns {User | null}
 */
function toUser(remote) {
  if (!remote) {
    return null;
  }
  return {
    id: remote.id,
    name: remote.name || "Learner",
    email: remote.email,
    picture: "",
  };
}

/**
 * Starts Supabase session restoration. Safe to call more than once.
 *
 * There is intentionally no local fallback identity. If Supabase is not
 * configured, account-only Story Mode stays signed out rather than silently
 * creating a browser-only account.
 *
 * @returns {void}
 */
export function initAuth() {
  if (started) {
    return;
  }
  started = true;
  clearLegacyIdentityRecords();

  if (!isRemoteEnabled()) {
    setSession(null);
    settleReady();
    return;
  }

  onRemoteAuthChange((remote) => {
    setSession(toUser(remote));
  });

  getRemoteUser()
    .then((remote) => {
      setSession(toUser(remote));
    })
    .catch(() => {
      setSession(null);
    })
    .finally(settleReady);
}

/**
 * Resolves after Supabase has checked its persisted session.
 *
 * Pages that must choose between rendering protected content and redirecting
 * should await this rather than treating the initial asynchronous check as a
 * signed-out result.
 *
 * @returns {Promise<void>}
 */
export function whenAuthReady() {
  initAuth();
  return authReady;
}

/**
 * @returns {User | null} the signed-in learner, or null while signed out
 */
export function getUser() {
  if (!started) {
    initAuth();
  }
  return session;
}

/**
 * Creates a password account with a learner-selected display name.
 *
 * @param {{ email: string, password: string, displayName: string }} credentials
 * @returns {Promise<{ ok: boolean, error: string, requiresEmailConfirmation: boolean }>}
 */
export async function createAccount(credentials) {
  return signUpWithPassword(credentials);
}

/**
 * Starts a normal password sign-in. It never triggers a confirmation email.
 *
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ ok: boolean, error: string }>}
 */
export async function signIn(credentials) {
  return signInWithPassword(credentials);
}

/** @returns {void} */
export function signOut() {
  setSession(null);
  void signOutRemote().catch(() => {
    // The local UI has already signed out. A later auth event will agree.
  });
}

/**
 * Subscribes to sign-in and sign-out. The callback receives the current state
 * immediately, then receives any later Supabase updates.
 *
 * @param {(user: User | null) => void} cb
 * @returns {() => void}
 */
export function onAuthChange(cb) {
  if (typeof cb !== "function") {
    return () => {};
  }
  listeners.add(cb);
  try {
    cb(getUser());
  } catch {
    // A broken subscriber is isolated from the rest of the site.
  }
  return () => listeners.delete(cb);
}

/* ------------------------------------------------------------------ */
/* header control                                                      */
/* ------------------------------------------------------------------ */

/** @returns {void} */
function ensureNavStyles() {
  if (document.querySelector("style[data-auth-styles]")) {
    return;
  }
  const style = document.createElement("style");
  style.setAttribute("data-auth-styles", "");
  style.textContent = [
    ":where(.auth-nav){position:relative;display:inline-flex;align-items:center}",
    ":where(.auth-user){display:inline-flex;align-items:center;gap:8px;cursor:pointer;",
    "border:0;background:transparent;font:inherit;padding:4px 6px;border-radius:999px}",
    ":where(.auth-avatar){width:28px;height:28px;border-radius:50%;object-fit:cover;flex:0 0 auto}",
    ":where(.auth-avatar--initial){display:inline-flex;align-items:center;justify-content:center;",
    "font-weight:700;font-size:13px;background:#d9e8f6;color:#0b2447}",
    ":where(.auth-menu){position:absolute;top:calc(100% + 8px);right:0;z-index:60;min-width:170px;",
    "display:flex;flex-direction:column;background:#fff;border-radius:12px;padding:6px;",
    "box-shadow:0 12px 30px rgba(11,36,71,0.18)}",
    ":where(.auth-menu[hidden]){display:none}",
    ":where(.auth-menu__item){display:block;width:100%;text-align:left;padding:9px 12px;",
    "border:0;background:transparent;font:inherit;color:#0b2447;text-decoration:none;",
    "border-radius:8px;cursor:pointer}",
    ":where(.auth-menu__item:hover),:where(.auth-menu__item:focus-visible){background:#d9e8f6}",
    ":where(.auth-menu__item--signout){margin-top:5px;padding-top:10px;",
    "border-top:1px solid #d9e8f6;color:#5a6b80}",
  ].join("");
  document.head.appendChild(style);
}

/**
 * @param {string} name
 * @returns {HTMLElement}
 */
function initialAvatar(name) {
  const span = document.createElement("span");
  span.className = "auth-avatar auth-avatar--initial";
  span.setAttribute("aria-hidden", "true");
  span.textContent = (name.trim()[0] || "?").toUpperCase();
  return span;
}

/**
 * @param {User} user
 * @returns {HTMLElement}
 */
function avatarFor(user) {
  if (user.picture !== "") {
    const image = document.createElement("img");
    image.className = "auth-avatar";
    image.src = user.picture;
    image.alt = "";
    image.width = 28;
    image.height = 28;
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.replaceWith(initialAvatar(user.name)));
    return image;
  }
  return initialAvatar(user.name);
}

/**
 * @param {HTMLElement} el
 * @param {User | null} user
 * @returns {void}
 */
function renderAuthNav(el, user) {
  const stale = navControllers.get(el);
  if (stale) {
    stale.abort();
    navControllers.delete(el);
  }
  el.replaceChildren();
  if (!user) {
    const link = document.createElement("a");
    link.className = "auth-link";
    link.href = LEARN_URL;
    link.textContent = "Sign in";
    el.appendChild(link);
    return;
  }

  ensureNavStyles();
  const wrap = document.createElement("div");
  wrap.className = "auth-nav";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "auth-user";
  toggle.setAttribute("aria-haspopup", "true");
  toggle.setAttribute("aria-expanded", "false");
  toggle.appendChild(avatarFor(user));
  const label = document.createElement("span");
  label.className = "auth-user__name";
  label.textContent = user.name.split(" ")[0] || user.name;
  toggle.appendChild(label);

  const menu = document.createElement("div");
  menu.className = "auth-menu";
  menu.hidden = true;

  const profile = document.createElement("a");
  profile.className = "auth-menu__item";
  profile.href = PROFILE_URL;
  profile.textContent = "Profile";

  const learn = document.createElement("a");
  learn.className = "auth-menu__item";
  learn.href = LEARN_URL;
  learn.textContent = "My Learning";

  const board = document.createElement("a");
  board.className = "auth-menu__item";
  board.href = LEADERBOARD_URL;
  board.textContent = "Leaderboard";

  const out = document.createElement("button");
  out.type = "button";
  out.className = "auth-menu__item auth-menu__item--signout";
  out.textContent = "Sign out";

  menu.append(profile, learn, board, out);
  wrap.append(toggle, menu);
  el.appendChild(wrap);

  /** @param {boolean} open */
  const setOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };

  const controller = new AbortController();
  navControllers.set(el, controller);
  const { signal } = controller;
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(menu.hidden !== false);
  });
  out.addEventListener("click", () => {
    setOpen(false);
    signOut();
  });
  document.addEventListener(
    "click",
    (event) => {
      if (event.target instanceof Node && !wrap.contains(event.target)) {
        setOpen(false);
      }
    },
    { signal },
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    },
    { signal },
  );
}

/**
 * Renders and keeps the header account control in sync.
 *
 * @param {HTMLElement} el
 * @returns {void}
 */
export function mountAuthNav(el) {
  if (!(el instanceof HTMLElement)) {
    return;
  }
  const previous = navMounts.get(el);
  if (previous) {
    previous();
  }
  navMounts.set(el, onAuthChange((user) => renderAuthNav(el, user)));
}
