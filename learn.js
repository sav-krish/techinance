// @ts-check

/**
 * Drives learn.html, the "My Learning" hub.
 *
 * Responsibilities:
 *   - toggle the signed-out / signed-in panels from `onAuthChange`
 *   - create and sign in private Techinance password accounts
 *   - render total XP, badges, and per-episode progress from progress.js
 *   - handle `?course=<slug>` deep links from courses.html, which drop a signed-in
 *     visitor straight onto that course's episodes
 *
 * Episode metadata (badge names, max XP) is pulled from the episode module with
 * a dynamic import so a broken or half-written content file can never stop the
 * hub, or its sign-in, from working.
 */

import {
  createAccount,
  initAuth,
  onAuthChange,
  signIn,
  signOut,
} from "./auth.js";
import { icon, iconMarkup } from "./icon.js";
import { startProgressSync } from "./progress-sync.js";
import { getProgress } from "./progress.js";

/** @typedef {import("./auth.js").User} User */
/** @typedef {{ id: string, name: string, description: string, icon: string }} BadgeMeta */

/** Icon shown when a badge names no icon of its own. */
const DEFAULT_BADGE_ICON = "award";

const EPISODE_ID = "cyber-u1";

/** Used until (or unless) the real episode module reports its own total. */
const FALLBACK_TOTAL_XP = 900;

/** An unfinished episode never shows a full bar, however much XP is banked. */
const MAX_INCOMPLETE_PERCENT = 96;

/** @type {Map<string, BadgeMeta>} */
const badgeMeta = new Map();

let totalEpisodeXp = FALLBACK_TOTAL_XP;

/* ------------------------------------------------------------------ */
/* tiny helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === "object" && value !== null;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function toText(value) {
  return typeof value === "string" ? value : "";
}

/**
 * @param {string} selector
 * @param {ParentNode} [scope]
 * @returns {HTMLElement | null}
 */
function pick(selector, scope) {
  const found = (scope ?? document).querySelector(selector);
  return found instanceof HTMLElement ? found : null;
}

/**
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
  return value.toLocaleString("en-GB");
}

/* ------------------------------------------------------------------ */
/* episode metadata                                                    */
/* ------------------------------------------------------------------ */

/**
 * Highest XP reachable in an episode: choice scenes pay their best option, every
 * other scene type pays a flat `xp`.
 *
 * @param {unknown} episode
 * @returns {number}
 */
function maxEpisodeXp(episode) {
  if (!isObject(episode) || !isObject(episode.scenes)) {
    return 0;
  }
  let total = 0;
  for (const scene of Object.values(episode.scenes)) {
    if (!isObject(scene)) {
      continue;
    }
    total += toNumber(scene.xp);
    if (scene.type === "choice" && Array.isArray(scene.options)) {
      let best = 0;
      for (const option of scene.options) {
        if (isObject(option)) {
          best = Math.max(best, toNumber(option.xp));
        }
      }
      total += best;
    }
  }
  return total;
}

/**
 * @param {unknown} episode
 * @returns {void}
 */
function readBadges(episode) {
  if (!isObject(episode) || !Array.isArray(episode.badges)) {
    return;
  }
  for (const badge of episode.badges) {
    if (!isObject(badge)) {
      continue;
    }
    const id = toText(badge.id);
    if (id === "") {
      continue;
    }
    badgeMeta.set(id, {
      id,
      name: toText(badge.name) || id,
      description: toText(badge.description),
      icon: toText(badge.icon) || DEFAULT_BADGE_ICON,
    });
  }
}

/**
 * @returns {Promise<void>}
 */
async function loadEpisodeMeta() {
  try {
    const modules = await Promise.all([
      import("./content/cyber-unit1.js"),
      import("./content/cyber-unit2.js"),
      import("./content/cyber-unit3.js"),
      import("./content/cyber-unit4.js"),
      import("./content/finance-unit1.js"),
      import("./content/finance-unit2.js"),
      import("./content/finance-unit3.js"),
      import("./content/finance-unit4.js"),
      import("./content/neuro-unit1.js"),
      import("./content/neuro-unit2.js"),
      import("./content/neuro-unit3.js"),
      import("./content/neuro-unit4.js"),
      import("./content/startup-unit1.js"),
      import("./content/startup-unit2.js"),
      import("./content/startup-unit3.js"),
      import("./content/startup-unit4.js"),
      import("./content/startup-unit5.js"),
      import("./content/startup-unit6.js"),
    ]);
    let grandMax = 0;
    for (const mod of modules) {
      const episode = mod.episode;
      if (episode) {
        readBadges(episode);
        grandMax += maxEpisodeXp(episode);
      }
    }
    if (grandMax > 0) {
      totalEpisodeXp = grandMax;
    }
  } catch {
    // Content not ready: the fallback total and raw badge ids are enough.
  }
}

/* ------------------------------------------------------------------ */
/* course deep links (?course=...)                                     */
/* ------------------------------------------------------------------ */

/**
 * Extra spellings accepted in `?course=`. A link written elsewhere on the site
 * doesn't have to match the rail's own slug exactly. Anything not listed here
 * is tried as-is against the rail, and anything the rail doesn't know about is
 * ignored, so the page behaves exactly as it does without a parameter.
 *
 * @type {Record<string, string>}
 */
const COURSE_ALIASES = {
  cyber: "cybersecurity",
  security: "cybersecurity",
  technology: "cybersecurity",
  finance: "financial-literacy",
  "financial-literacy": "financial-literacy",
  neuro: "neuroscience",
  entrepreneurship: "startup",
  "start-up": "startup",
  "how-2-build-a-start-up": "startup",
};

/** Slugs go into a selector, so only these characters are ever accepted. */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

let courseFocusApplied = false;

/** Where the season block sat before it was moved, so it can be put back. */
/** @type {{ parent: Node, next: Node | null } | null} */
let seasonHome = null;

/** @type {HTMLElement | null} */
let focusedSeason = null;

/** @type {HTMLElement | null} */
let focusedCard = null;

/**
 * @returns {string} a slug that exists on this page, or ""
 */
function readRequestedCourse() {
  /** @type {string} */
  let raw;
  try {
    raw = new URLSearchParams(window.location.search).get("course") ?? "";
  } catch {
    return "";
  }
  const slug = raw.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    return "";
  }
  const resolved = COURSE_ALIASES[slug] ?? slug;
  if (!SLUG_PATTERN.test(resolved)) {
    return "";
  }
  return document.querySelector(`[data-course="${resolved}"]`) === null ? "" : resolved;
}

/** The course asked for in the URL, or "" when there isn't a usable one. */
const requestedCourse = readRequestedCourse();

/**
 * @param {HTMLElement} element
 * @returns {void}
 */
function revealElement(element) {
  /** @type {boolean} */
  let reduced;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    reduced = false;
  }
  element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

/**
 * Opens or collapses the general course rail.
 *
 * @param {boolean} open
 * @returns {void}
 */
function setRailOpen(open) {
  const rail = pick("[data-rail]");
  if (rail) {
    rail.hidden = !open;
  }
  const toggle = pick("[data-rail-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(open));
  }
  const label = pick("[data-rail-toggle-label]");
  if (label) {
    label.textContent = open ? "Hide the other courses" : "Show all courses";
  }
}

/**
 * Puts the page on one course: its season block moves above the rail, the rail
 * collapses behind a toggle, and keyboard focus lands on the season heading.
 * A course with no season block yet just gets highlighted in the rail.
 *
 * @param {string} slug
 * @returns {void}
 */
function applyCourseFocus(slug) {
  const season = pick(`[data-season="${slug}"]`);
  const heading = season ? pick("[data-season-heading]", season) : null;
  const courseSection = pick("[data-course-section]");

  if (season && heading) {
    const parent = season.parentElement;
    if (courseSection && parent && courseSection.parentElement === parent) {
      seasonHome = { parent, next: season.nextElementSibling };
      parent.insertBefore(season, courseSection);
    }
    focusedSeason = season;
    season.classList.add("learn-section--focused");
    if (courseSection) {
      courseSection.classList.add("learn-section--muted");
    }
    document.body.classList.add("learn-course-focus");

    const back = pick("[data-season-back]", season);
    if (back) {
      back.hidden = false;
    }
    const toggle = pick("[data-rail-toggle]");
    if (toggle) {
      toggle.hidden = false;
    }
    setRailOpen(false);

    heading.focus({ preventScroll: true });
    revealElement(season);
    return;
  }

  // No season block for this course yet, so point at its card instead.
  const card = pick(`[data-course="${slug}"]`);
  if (card) {
    focusedCard = card;
    card.classList.add("learn-course--focused");
    card.setAttribute("tabindex", "-1");
    card.focus({ preventScroll: true });
    revealElement(card);
  }
}

/**
 * Undoes `applyCourseFocus`, so signing out returns the normal page.
 *
 * @returns {void}
 */
function clearCourseFocus() {
  if (focusedSeason) {
    if (seasonHome) {
      seasonHome.parent.insertBefore(focusedSeason, seasonHome.next);
      seasonHome = null;
    }
    focusedSeason.classList.remove("learn-section--focused");
    const back = pick("[data-season-back]", focusedSeason);
    if (back) {
      back.hidden = true;
    }
    focusedSeason = null;
  }
  if (focusedCard) {
    focusedCard.classList.remove("learn-course--focused");
    focusedCard.removeAttribute("tabindex");
    focusedCard = null;
  }
  const courseSection = pick("[data-course-section]");
  if (courseSection) {
    courseSection.classList.remove("learn-section--muted");
  }
  const toggle = pick("[data-rail-toggle]");
  if (toggle) {
    toggle.hidden = true;
  }
  document.body.classList.remove("learn-course-focus");
  setRailOpen(true);
}

/* ------------------------------------------------------------------ */
/* rendering                                                           */
/* ------------------------------------------------------------------ */

/**
 * @param {User} user
 * @returns {void}
 */
function renderIdentity(user) {
  const avatar = pick("[data-user-avatar]");
  if (avatar) {
    avatar.replaceChildren();
    avatar.classList.toggle("learn-avatar--photo", user.picture !== "");
    if (user.picture !== "") {
      const img = document.createElement("img");
      img.src = user.picture;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.width = 56;
      img.height = 56;
      avatar.appendChild(img);
    } else {
      const initial = document.createElement("span");
      initial.className = "learn-avatar__initial";
      initial.textContent = (user.name.trim()[0] ?? "?").toUpperCase();
      avatar.appendChild(initial);
    }
  }

  const name = pick("[data-user-name]");
  if (name) {
    name.textContent = user.name;
  }

  const meta = pick("[data-user-meta]");
  if (meta) {
    meta.textContent = user.email;
  }
}

/**
 * @param {string[]} badges
 * @returns {void}
 */
function renderBadges(badges) {
  const list = pick("[data-badge-list]");
  if (!list) {
    return;
  }
  if (badges.length === 0) {
    const empty = document.createElement("p");
    empty.className = "learn-badges__empty";
    empty.textContent = "No badges yet. Finish a scene in Unit 1 to earn your first.";
    list.replaceChildren(empty);
    return;
  }
  /** @type {HTMLElement[]} */
  const chips = [];
  for (const id of badges) {
    const meta = badgeMeta.get(id);
    const chip = document.createElement("span");
    chip.className = "learn-badge";
    if (meta && meta.description !== "") {
      chip.title = meta.description;
    }

    const iconWrap = document.createElement("span");
    iconWrap.className = "learn-badge__icon";
    iconWrap.setAttribute("aria-hidden", "true");
    iconWrap.innerHTML = iconMarkup(meta ? meta.icon : DEFAULT_BADGE_ICON, { size: 18 });

    const label = document.createElement("span");
    label.className = "learn-badge__name";
    label.textContent = meta ? meta.name : id;

    chip.append(iconWrap, label);
    chips.push(chip);
  }
  list.replaceChildren(...chips);
}

/**
 * @param {User | null} user
 * @returns {void}
 */
function renderEpisode(user) {
  const episodes = document.querySelectorAll(".learn-episode[data-episode]");
  episodes.forEach((card) => {
    const episodeId = card.getAttribute("data-episode") || EPISODE_ID;
    // pick() narrows to HTMLElement, which `.hidden` and `.style` below need.
    // Raw querySelector returns Element and fails the typecheck.
    const wrap = pick("[data-progress]", card);
    const bar = pick("[data-progress-bar]", card);
    const fill = pick("[data-progress-fill]", card);
    const text = pick("[data-progress-text]", card);
    const xpLabel = pick("[data-progress-xp]", card);
    const cta = pick("[data-episode-cta]", card);

    if (!user) {
      if (wrap) {
        wrap.hidden = true;
      }
      if (cta) {
        cta.textContent = "Start episode";
      }
      return;
    }

    const episodeState = getProgress(user.id).episodes[episodeId];
    const started = episodeState ? episodeState.started : false;
    const completed = episodeState ? episodeState.completed : false;
    const xp = episodeState ? episodeState.xp : 0;
    const raw = totalEpisodeXp > 0 ? Math.round((xp / totalEpisodeXp) * 100) : 0;
    const percent = completed ? 100 : Math.max(0, Math.min(MAX_INCOMPLETE_PERCENT, raw));

    if (wrap) {
      wrap.hidden = false;
    }
    if (bar) {
      bar.setAttribute("aria-valuenow", String(percent));
    }
    if (fill) {
      fill.style.width = `${percent}%`;
    }
    if (text) {
      text.textContent = completed
        ? "Completed"
        : started
          ? `In progress · ${percent}%`
          : "Not started";
    }
    if (xpLabel) {
      xpLabel.textContent = `${formatNumber(xp)} XP`;
    }
    if (cta) {
      cta.textContent = completed
        ? "Play again"
        : started
          ? "Resume episode"
          : "Start episode";
    }
  });
}

/**
 * @param {User | null} user
 * @returns {void}
 */
function render(user) {
  const gate = pick("[data-signed-out]");
  const account = pick("[data-signed-in]");
  if (gate) {
    gate.hidden = user !== null;
  }
  if (account) {
    account.hidden = user === null;
  }
  document.body.classList.toggle("learn-signed-in", user !== null);

  if (user) {
    const progress = getProgress(user.id);
    renderIdentity(user);
    renderBadges(progress.badges);

    const totalXp = pick("[data-total-xp]");
    if (totalXp) {
      totalXp.textContent = formatNumber(progress.xp);
    }
    const badgeCount = pick("[data-badge-count]");
    if (badgeCount) {
      badgeCount.textContent = formatNumber(progress.badges.length);
    }
    const episodeCount = pick("[data-episode-count]");
    if (episodeCount) {
      const done = Object.values(progress.episodes).filter((ep) => ep.completed).length;
      episodeCount.textContent = formatNumber(done);
    }
  }

  renderEpisode(user);

  // A `?course=` link waits for sign-in: the gate comes first, then the course.
  if (user && requestedCourse !== "" && !courseFocusApplied) {
    courseFocusApplied = true;
    applyCourseFocus(requestedCourse);
  } else if (!user && courseFocusApplied) {
    courseFocusApplied = false;
    clearCourseFocus();
  }
}

/* ------------------------------------------------------------------ */
/* wiring                                                              */
/* ------------------------------------------------------------------ */

/** @type {User | null} */
let currentUser = null;

/* ------------------------------------------------------------------ */
/* account form                                                        */
/* ------------------------------------------------------------------ */

/** @type {"signin" | "signup"} */
let accountMode = "signin";

const accountForm = document.querySelector("[data-account-form]");
const accountModeToggle = pick("[data-account-mode-toggle]");
const accountTitle = pick("[data-account-title]");
const accountDescription = pick("[data-account-description]");
const displayNameField = pick("[data-display-name-field]");
const displayNameInput = document.querySelector("[data-account-display-name]");
const emailInput = document.querySelector("[data-account-email]");
const passwordInput = document.querySelector("[data-account-password]");
const accountStatus = pick("[data-account-status]");
const accountSubmit = document.querySelector("[data-account-submit]");

/**
 * @param {string} message
 * @param {boolean} [isError]
 * @returns {void}
 */
function setAccountStatus(message, isError = false) {
  if (!accountStatus) {
    return;
  }
  accountStatus.textContent = message;
  accountStatus.classList.toggle("is-error", isError);
}

/**
 * @param {"signin" | "signup"} mode
 * @returns {void}
 */
function setAccountMode(mode) {
  accountMode = mode;
  const creating = mode === "signup";
  if (accountTitle) {
    accountTitle.textContent = creating ? "Create Your Techinance Account" : "Sign In to Save Your Progress";
  }
  if (accountDescription) {
    accountDescription.textContent = creating
      ? "Create a private account to save your learning across devices."
      : "Sign in to continue securely across your devices.";
  }
  if (displayNameField) {
    displayNameField.hidden = !creating;
  }
  if (displayNameInput instanceof HTMLInputElement) {
    displayNameInput.required = creating;
  }
  if (passwordInput instanceof HTMLInputElement) {
    passwordInput.autocomplete = creating ? "new-password" : "current-password";
  }
  if (accountSubmit instanceof HTMLButtonElement) {
    accountSubmit.textContent = creating ? "Create account" : "Sign in";
  }
  if (accountModeToggle instanceof HTMLButtonElement) {
    accountModeToggle.textContent = creating ? "Already have an account? Sign in" : "Need an account? Create one";
    accountModeToggle.setAttribute("aria-pressed", String(creating));
  }
  setAccountStatus("");
}

/**
 * @param {string} password
 * @returns {string}
 */
function passwordIssue(password) {
  if (password.length < 12) {
    return "Use a password with at least 12 characters.";
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Use uppercase and lowercase letters, a number, and a symbol.";
  }
  return "";
}

/**
 * @param {boolean} isBusy
 * @returns {void}
 */
function setAccountBusy(isBusy) {
  if (accountSubmit instanceof HTMLButtonElement) {
    accountSubmit.disabled = isBusy;
    accountSubmit.textContent = isBusy
      ? accountMode === "signup"
        ? "Creating account..."
        : "Signing in..."
      : accountMode === "signup"
        ? "Create account"
        : "Sign in";
  }
  if (accountModeToggle instanceof HTMLButtonElement) {
    accountModeToggle.disabled = isBusy;
  }
}

if (accountModeToggle instanceof HTMLButtonElement) {
  accountModeToggle.addEventListener("click", () => {
    setAccountMode(accountMode === "signup" ? "signin" : "signup");
  });
}

if (
  accountForm instanceof HTMLFormElement &&
  displayNameInput instanceof HTMLInputElement &&
  emailInput instanceof HTMLInputElement &&
  passwordInput instanceof HTMLInputElement
) {
  accountForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const displayName = displayNameInput.value.trim().replace(/\s+/g, " ");

    if (!emailInput.validity.valid || email === "") {
      setAccountStatus("Enter a valid email address.", true);
      emailInput.focus();
      return;
    }
    const issue = passwordIssue(password);
    if (issue !== "") {
      setAccountStatus(issue, true);
      passwordInput.focus();
      return;
    }
    if (accountMode === "signup") {
      if (displayName.length < 2 || displayName.length > 32 || displayName.includes("@")) {
        setAccountStatus("Choose a nickname between 2 and 32 characters, without an email address.", true);
        displayNameInput.focus();
        return;
      }
    }

    setAccountBusy(true);
    setAccountStatus("");
    try {
      if (accountMode === "signup") {
        const result = await createAccount({ email, password, displayName });
        if (!result.ok) {
          setAccountStatus(result.error, true);
          return;
        }
        passwordInput.value = "";
        if (result.requiresEmailConfirmation) {
          setAccountMode("signin");
          setAccountStatus("Check your email once to finish creating your account. Then sign in with your password.");
        } else {
          setAccountStatus("Your account is ready.");
        }
        return;
      }

      const result = await signIn({ email, password });
      if (!result.ok) {
        setAccountStatus(result.error, true);
        return;
      }
      passwordInput.value = "";
      setAccountStatus("Signed in successfully.");
    } catch {
      setAccountStatus("We couldn't complete that request. Please try again.", true);
    } finally {
      setAccountBusy(false);
    }
  });
}

setAccountMode("signin");

const signOutButton = pick("[data-signout-button]");
if (signOutButton instanceof HTMLButtonElement) {
  signOutButton.addEventListener("click", () => {
    signOut();
  });
}

const railToggle = pick("[data-rail-toggle]");
if (railToggle instanceof HTMLButtonElement) {
  railToggle.addEventListener("click", () => {
    const rail = pick("[data-rail]");
    setRailOpen(rail ? rail.hidden !== false : true);
  });
}

const profileIcon = pick("[data-profile-icon]");
if (profileIcon) {
  profileIcon.replaceChildren(icon("user", { size: 18 }));
}

const backIcon = pick("[data-season-back-icon]");
if (backIcon) {
  backIcon.replaceChildren(icon("arrow-left", { size: 16 }));
}

onAuthChange((user) => {
  currentUser = user;
  render(user);
});

initAuth();
startProgressSync();

// Progress written by the player in another tab should show up here.
window.addEventListener("storage", (event) => {
  if (event.key === null || event.key.startsWith("techinance.")) {
    render(currentUser);
  }
});

void loadEpisodeMeta().then(() => render(currentUser));
