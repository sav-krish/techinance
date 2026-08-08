// @ts-check

/**
 * Drives profile.html, the Story Mode profile page.
 *
 * learn.html shows a small progress panel next to the episode list. This page is
 * the wider view: identity, headline totals, the whole badge collection, course
 * by course progress, and the controls for signing out or wiping progress.
 *
 * Everything is read through progress.js and auth.js, so this file owns no state
 * of its own beyond the episode metadata it imports. Episode metadata comes in
 * through a dynamic import: a broken or half-written content file must not stop
 * the page, or its sign-out button, from working.
 */

import { initAuth, onAuthChange, signOut } from "./auth.js";
import { icon } from "./icon.js";
import { getProgress, resetEpisode } from "./progress.js";
import { startProgressSync } from "./progress-sync.js";
import {
  getProfilePrivacy,
  resetRemoteProgress,
  updateProfilePrivacy,
} from "./supabase.js";

/** @typedef {import("./auth.js").User} User */
/** @typedef {{ id: string, name: string, description: string, icon: string }} BadgeMeta */
/** @typedef {{ unit: number, title: string, episodeId: string, playable: boolean }} UnitMeta */
/**
 * @typedef {{
 *   slug: string,
 *   title: string,
 *   tag: string,
 *   icon: string,
 *   units: UnitMeta[],
 * }} CourseMeta
 */

/** Icon used when a badge names no icon of its own. */
const DEFAULT_BADGE_ICON = "award";

/** Used until (or unless) the real episode module reports its own total. */
const FALLBACK_TOTAL_XP = 900;

/** An unfinished episode never shows a full bar, however much XP is banked. */
const MAX_INCOMPLETE_PERCENT = 96;

/**
 * Courses with episodes written. `playable` drives the unit counter, the reset
 * scope and the locked styling, so a unit listed here but not yet written stays
 * visible as a locked row.
 *
 * This list and the episode cards in learn.html must agree. See STORY-MODE.md.
 *
 * @type {CourseMeta[]}
 */
const COURSES = [
  {
    slug: "cybersecurity",
    title: "Cybersecurity",
    tag: "Technology · Ages 12–16",
    icon: "shield-check",
    units: [
      { unit: 1, title: "The Cost of Cybercrime", episodeId: "cyber-u1", playable: true },
      {
        unit: 2,
        title: "Digital Footprint and Defense",
        episodeId: "cyber-u2",
        playable: true,
      },
      {
        unit: 3,
        title: "Careers, Skills, and Certifications",
        episodeId: "cyber-u3",
        playable: true,
      },
      {
        unit: 4,
        title: "Programming for Cybersecurity",
        episodeId: "cyber-u4",
        playable: true,
      },
    ],
  },
  {
    slug: "financial-literacy",
    title: "Financial Literacy",
    tag: "Finance · Ages 10–16",
    icon: "wallet",
    units: [
      {
        unit: 1,
        title: "Budgeting and Smart Spending",
        episodeId: "fin-u1",
        playable: true,
      },
      {
        unit: 2,
        title: "Debt and Credit Management",
        episodeId: "fin-u2",
        playable: true,
      },
      { unit: 3, title: "Coming soon", episodeId: "fin-u3", playable: false },
      {
        unit: 4,
        title: "Investing, Savings, and Retirement",
        episodeId: "fin-u4",
        playable: true,
      },
    ],
  },
  {
    slug: "neuroscience",
    title: "Neuroscience",
    tag: "Neuroscience · Ages 12–16",
    icon: "brain",
    units: [
      {
        unit: 1,
        title: "How Your Brain Processes Reality",
        episodeId: "neuro-u1",
        playable: true,
      },
      {
        unit: 2,
        title: "The Neuroscience Behind Emotions",
        episodeId: "neuro-u2",
        playable: true,
      },
      {
        unit: 3,
        title: "Hacking Reward Systems to Overcome Dopamine Addictions",
        episodeId: "neuro-u3",
        playable: true,
      },
      {
        unit: 4,
        title: "Understanding Neurological Disorders",
        episodeId: "neuro-u4",
        playable: true,
      },
    ],
  },
  {
    slug: "startup",
    title: "How 2 Build a Start Up",
    tag: "Entrepreneurship · Ages 12–16",
    icon: "rocket",
    units: [
      {
        unit: 1,
        title: "What Is a Startup, Really?",
        episodeId: "startup-u1",
        playable: true,
      },
      {
        unit: 2,
        title: "Finding a Real Problem Worth Solving",
        episodeId: "startup-u2",
        playable: true,
      },
      {
        unit: 3,
        title: "From Idea to MVP",
        episodeId: "startup-u3",
        playable: true,
      },
      {
        unit: 4,
        title: "Y Combinator and Accelerators",
        episodeId: "startup-u4",
        playable: true,
      },
      {
        unit: 5,
        title: "Funding, Grants and Competitions",
        episodeId: "startup-u5",
        playable: true,
      },
      {
        unit: 6,
        title: "Wrap-Up and Founder Portfolio",
        episodeId: "startup-u6",
        playable: true,
      },
    ],
  },
];

/** Every playable unit across every course. Drives totals and the reset scope. */
const PLAYABLE_UNITS = COURSES.flatMap((course) =>
  course.units.filter((unit) => unit.playable),
);

/**
 * Courses with no episodes written. Every Techinance course is now in Story
 * Mode, so this is empty; renderCourses() skips the section entirely when it is.
 */
const OTHER_COURSES = /** @type {{ icon: string, title: string, tag: string, blurb: string }[]} */ ([]);

/** Badge metadata in the order the episode declares it. */
/** @type {BadgeMeta[]} */
let badgeOrder = [];

let totalEpisodeXp = FALLBACK_TOTAL_XP;
let totalScenes = 0;

/** Maximum XP per episode, keyed by episode id. @type {Map<string, number>} */
const episodeXpById = new Map();

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
 * @param {string} selector
 * @returns {HTMLElement[]}
 */
function pickAll(selector) {
  /** @type {HTMLElement[]} */
  const found = [];
  for (const node of document.querySelectorAll(selector)) {
    if (node instanceof HTMLElement) {
      found.push(node);
    }
  }
  return found;
}

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

/**
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
  return value.toLocaleString("en-GB");
}

/**
 * Fills every `[data-icon="name"]` placeholder in the static markup. Keeps the
 * page on one icon family without a second lucide entry point.
 *
 * @returns {void}
 */
function paintStaticIcons() {
  for (const node of pickAll("[data-icon]")) {
    const name = node.dataset.icon;
    if (!name) {
      continue;
    }
    const size = Number(node.dataset.iconSize);
    node.replaceChildren(icon(name, size > 0 ? { size } : {}));
  }
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
 * @returns {BadgeMeta[]}
 */
function readBadges(episode) {
  /** @type {BadgeMeta[]} */
  const list = [];
  if (!isObject(episode) || !Array.isArray(episode.badges)) {
    return list;
  }
  for (const badge of episode.badges) {
    if (!isObject(badge)) {
      continue;
    }
    const id = toText(badge.id);
    if (id === "" || list.some((known) => known.id === id)) {
      continue;
    }
    list.push({
      id,
      name: toText(badge.name) || id,
      description: toText(badge.description),
      icon: toText(badge.icon) || DEFAULT_BADGE_ICON,
    });
  }
  return list;
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
    badgeOrder = [];
    let grandXp = 0;
    let grandScenes = 0;

    for (const mod of modules) {
      const episode = mod.episode;
      if (episode) {
        const badges = readBadges(episode);
        for (const b of badges) {
          if (!badgeOrder.includes(b)) {
            badgeOrder.push(b);
          }
        }
        const episodeXp = maxEpisodeXp(episode);
        // Per-episode totals as well as the grand total. A unit's completion
        // percentage has to divide by its own XP, not by every unit combined.
        if (typeof episode.id === "string" && episodeXp > 0) {
          episodeXpById.set(episode.id, episodeXp);
        }
        grandXp += episodeXp;
        if (isObject(episode) && isObject(episode.scenes)) {
          grandScenes += Object.keys(episode.scenes).length;
        }
      }
    }
    if (grandXp > 0) {
      totalEpisodeXp = grandXp;
    }
    if (grandScenes > 0) {
      totalScenes = grandScenes;
    }
  } catch {
    // Content not ready. The page still renders totals and raw badge ids.
  }
}

/* ------------------------------------------------------------------ */
/* progress maths                                                      */
/* ------------------------------------------------------------------ */

/**
 * Progress for one episode, measured against that episode's own XP ceiling.
 *
 * @param {string} userId
 * @param {string} episodeId
 * @returns {{ started: boolean, completed: boolean, xp: number, percent: number }}
 */
function episodeSummary(userId, episodeId) {
  const state = getProgress(userId).episodes[episodeId];
  const started = state ? state.started : false;
  const completed = state ? state.completed : false;
  const xp = state ? state.xp : 0;
  const ceiling = episodeXpById.get(episodeId) ?? totalEpisodeXp;
  const raw = ceiling > 0 ? Math.round((xp / ceiling) * 100) : 0;
  const percent = completed ? 100 : Math.max(0, Math.min(MAX_INCOMPLETE_PERCENT, raw));
  return { started, completed, xp, percent };
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
    avatar.classList.remove("profile-avatar--photo");
    avatar.appendChild(initialFor(user.name));
  }

  const name = pick("[data-user-name]");
  if (name) {
    name.textContent = user.name;
  }

  const kind = pick("[data-user-kind]");
  if (kind) {
    kind.replaceChildren(
      icon("shield-check", { size: 15 }),
      el("span", "", "Techinance account"),
    );
  }

  const detail = pick("[data-user-detail]");
  if (detail) {
    detail.textContent = user.email
      ? `Signed in as ${user.email}. Your progress is private to your account.`
      : "Your progress is private to your Techinance account.";
  }
}

/**
 * @param {string} name
 * @returns {HTMLElement}
 */
function initialFor(name) {
  const initial = el("span", "profile-avatar__initial");
  initial.textContent = (name.trim()[0] ?? "?").toUpperCase();
  return initial;
}

/**
 * @param {import("./progress.js").Progress} progress
 * @returns {void}
 */
function renderTotals(progress) {
  const xp = pick("[data-total-xp]");
  if (xp) {
    xp.textContent = formatNumber(progress.xp);
  }

  const earned = progress.badges.length;
  const badgeCount = pick("[data-badge-count]");
  if (badgeCount) {
    badgeCount.textContent =
      badgeOrder.length > 0
        ? `${formatNumber(earned)} / ${formatNumber(badgeOrder.length)}`
        : formatNumber(earned);
  }
  const badgeNote = pick("[data-badge-note]");
  if (badgeNote) {
    badgeNote.textContent =
      badgeOrder.length > 0 ? "earned so far" : "badges collected";
  }

  const done = Object.values(progress.episodes).filter((ep) => ep.completed).length;
  const episodeCount = pick("[data-episode-count]");
  if (episodeCount) {
    episodeCount.textContent = formatNumber(done);
  }

  const scenes = Object.values(progress.scenes).filter((scene) => scene.visited).length;
  const sceneCount = pick("[data-scene-count]");
  if (sceneCount) {
    sceneCount.textContent =
      totalScenes > 0
        ? `${formatNumber(scenes)} / ${formatNumber(totalScenes)}`
        : formatNumber(scenes);
  }
  const sceneNote = pick("[data-scene-note]");
  if (sceneNote) {
    sceneNote.textContent = totalScenes > 0 ? "scenes across all units" : "scenes played";
  }
}

/**
 * The badge collection. Every badge in the episode gets a tile, whether it's
 * been earned or not, so the page shows what's still out there.
 *
 * @param {string[]} earnedIds
 * @returns {void}
 */
function renderBadges(earnedIds) {
  const grid = pick("[data-badge-grid]");
  if (!grid) {
    return;
  }
  const earned = new Set(earnedIds);

  /** @type {BadgeMeta[]} */
  const all = badgeOrder.slice();
  for (const id of earnedIds) {
    if (!all.some((badge) => badge.id === id)) {
      all.push({ id, name: id, description: "Earned in Story Mode.", icon: DEFAULT_BADGE_ICON });
    }
  }

  if (all.length === 0) {
    const empty = el("li", "profile-badges__empty");
    empty.textContent =
      "The badge list couldn't be loaded. Play a scene and check back.";
    grid.replaceChildren(empty);
    return;
  }

  /** @type {HTMLElement[]} */
  const tiles = [];
  for (const badge of all) {
    const has = earned.has(badge.id);
    const tile = el("li", `profile-badge ${has ? "profile-badge--earned" : "profile-badge--locked"}`);

    const iconWrap = el("span", "profile-badge__icon");
    iconWrap.setAttribute("aria-hidden", "true");
    iconWrap.appendChild(icon(has ? badge.icon : "lock", { size: 26 }));

    const name = el("p", "profile-badge__name", badge.name);
    const status = el("p", "profile-badge__status", has ? "Earned" : "Locked");
    const description = el("p", "profile-badge__desc", badge.description);

    tile.append(iconWrap, name, status, description);
    tiles.push(tile);
  }

  grid.replaceChildren(...tiles);

  const lead = pick("[data-badge-lead]");
  if (lead) {
    const count = earnedIds.filter((id) => all.some((badge) => badge.id === id)).length;
    lead.textContent =
      count === all.length
        ? `You've earned all ${formatNumber(all.length)} Cybersecurity badges.`
        : `You've earned ${formatNumber(count)} of the ${formatNumber(all.length)} Cybersecurity badges. Each one records a skill you used to finish part of an episode.`;
  }
}

/**
 * @param {number} percent
 * @param {string} label
 * @returns {HTMLElement}
 */
function progressBar(percent, label) {
  const track = el("div", "profile-bar");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(percent));
  track.setAttribute("aria-label", label);
  const fill = el("span", "profile-bar__fill");
  fill.style.width = `${percent}%`;
  track.appendChild(fill);
  return track;
}

/**
 * @param {string} userId
 * @param {CourseMeta} course
 * @returns {HTMLElement}
 */
function liveCourseCard(userId, course) {
  const playable = course.units.filter((unit) => unit.playable);
  // One summary per playable unit. Reusing a single episode's summary for every
  // row would show unit 1's progress against unit 2's title.
  const summaries = new Map(
    playable.map((unit) => [unit.episodeId, episodeSummary(userId, unit.episodeId)]),
  );
  const unitsDone = [...summaries.values()].filter((s) => s.completed).length;
  const coursePercent = Math.round((unitsDone / course.units.length) * 100);

  const card = el("article", "profile-course profile-course--live");

  const head = el("div", "profile-course__head");
  const iconWrap = el("span", "profile-course__icon");
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.appendChild(icon(course.icon, { size: 22 }));
  const heading = el("div", "profile-course__heading");
  heading.append(
    el("p", "profile-course__tag", course.tag),
    el("h3", "profile-course__title", course.title),
  );
  head.append(iconWrap, heading);

  const unitWord = course.units.length === 1 ? "unit" : "units";
  const state = el(
    "p",
    "profile-course__state",
    playable.length === course.units.length
      ? `${formatNumber(unitsDone)} of ${formatNumber(course.units.length)} ${unitWord} completed.`
      : `${formatNumber(unitsDone)} of ${formatNumber(course.units.length)} ${unitWord} completed. ${formatNumber(playable.length)} are playable, the rest are still being written.`,
  );

  const list = el("ol", "profile-units");
  for (const meta of course.units) {
    const row = el("li", `profile-unit ${meta.playable ? "" : "profile-unit--soon"}`.trim());

    const marker = el("span", "profile-unit__marker", String(meta.unit));
    marker.setAttribute("aria-hidden", "true");

    const body = el("div", "profile-unit__body");
    body.appendChild(el("p", "profile-unit__title", `Unit ${meta.unit}. ${meta.title}`));

    const summary = summaries.get(meta.episodeId);

    if (meta.playable && summary) {
      const line = el("p", "profile-unit__meta");
      line.append(
        el(
          "span",
          "profile-unit__state",
          summary.completed
            ? "Completed"
            : summary.started
              ? `In progress · ${summary.percent}%`
              : "Not started",
        ),
        el("span", "profile-unit__xp", `${formatNumber(summary.xp)} XP`),
      );
      body.append(progressBar(summary.percent, `Unit ${meta.unit} progress`), line);
    } else {
      body.appendChild(el("p", "profile-unit__meta", "Not written yet"));
    }

    const action = el("div", "profile-unit__action");
    if (meta.playable && summary) {
      const link = el("a", "profile-unit__link");
      if (link instanceof HTMLAnchorElement) {
        link.href = `story.html?episode=${meta.episodeId}`;
        link.textContent = summary.completed
          ? "Play again"
          : summary.started
            ? "Resume"
            : "Start";
      }
      action.appendChild(link);
    } else {
      const lock = el("span", "profile-unit__lock");
      lock.setAttribute("aria-hidden", "true");
      lock.appendChild(icon("lock", { size: 16 }));
      action.appendChild(lock);
    }

    row.append(marker, body, action);
    list.appendChild(row);
  }

  card.append(head, state, progressBar(coursePercent, `${course.title} course progress`), list);
  return card;
}

/**
 * @param {{ icon: string, title: string, tag: string, blurb: string }} course
 * @returns {HTMLElement}
 */
function soonCard(course) {
  const card = el("article", "profile-course profile-course--soon");

  const head = el("div", "profile-course__head");
  const iconWrap = el("span", "profile-course__icon");
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.appendChild(icon(course.icon, { size: 22 }));
  const heading = el("div", "profile-course__heading");
  heading.append(
    el("p", "profile-course__tag", course.tag),
    el("h3", "profile-course__title", course.title),
  );
  head.append(iconWrap, heading);

  const status = el("p", "profile-course__status");
  const dot = el("span", "profile-course__dot");
  dot.setAttribute("aria-hidden", "true");
  status.append(dot, el("span", "", "Not started · episodes still being written"));

  card.append(head, el("p", "profile-course__blurb", course.blurb), status);
  return card;
}

/**
 * @param {string} userId
 * @returns {void}
 */
function renderCourses(userId) {
  const list = pick("[data-course-list]");
  if (!list) {
    return;
  }
  /** @type {HTMLElement[]} */
  const cards = COURSES.map((course) => liveCourseCard(userId, course));
  for (const course of OTHER_COURSES) {
    cards.push(soonCard(course));
  }
  list.replaceChildren(...cards);
}

/**
 * @param {User | null} user
 * @returns {void}
 */
function render(user) {
  for (const node of pickAll("[data-signed-out]")) {
    node.hidden = user !== null;
  }
  for (const node of pickAll("[data-signed-in]")) {
    node.hidden = user === null;
  }
  document.body.classList.toggle("profile-signed-in", user !== null);

  if (!user) {
    closeConfirm();
    resetPrivacyForm();
    return;
  }

  const progress = getProgress(user.id);
  renderIdentity(user);
  renderTotals(progress);
  renderBadges(progress.badges);
  renderCourses(user.id);
  loadProfilePrivacy(user);
}

/* ------------------------------------------------------------------ */
/* wiring                                                              */
/* ------------------------------------------------------------------ */

/** @type {User | null} */
let currentUser = null;

let privacyRequestVersion = 0;
let privacyUserId = "";
let privacyLoaded = false;
let privacyLoading = false;
let privacyNicknameNeedsChoice = false;
let storedPrivateNickname = "Learner";

const privacyForm = pick("[data-privacy-form]");
const privacyNickname = pick("[data-profile-display-name]");
const privacyVisible = pick("[data-leaderboard-visible]");
const privacySave = pick("[data-privacy-save]");
const privacyStatus = pick("[data-privacy-status]");

/**
 * @param {string} message
 * @returns {void}
 */
function setPrivacyStatus(message) {
  if (privacyStatus) {
    privacyStatus.textContent = message;
  }
}

/**
 * @param {boolean} disabled
 * @returns {void}
 */
function setPrivacyControlsDisabled(disabled) {
  if (privacyNickname instanceof HTMLInputElement) {
    privacyNickname.disabled = disabled;
  }
  if (privacyVisible instanceof HTMLInputElement) {
    privacyVisible.disabled = disabled;
  }
  if (privacySave instanceof HTMLButtonElement) {
    privacySave.disabled = disabled;
  }
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeNickname(value) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * @param {string} value
 * @returns {string}
 */
function nicknameError(value) {
  if (value.length < 2 || value.length > 32) {
    return "Choose a nickname between 2 and 32 characters.";
  }
  if (value.includes("@")) {
    return "Choose a nickname without an email address.";
  }
  return "";
}

/** @returns {void} */
function resetPrivacyForm() {
  privacyRequestVersion += 1;
  privacyUserId = "";
  privacyLoaded = false;
  privacyLoading = false;
  privacyNicknameNeedsChoice = false;
  storedPrivateNickname = "Learner";
  if (privacyNickname instanceof HTMLInputElement) {
    privacyNickname.value = "";
  }
  if (privacyVisible instanceof HTMLInputElement) {
    privacyVisible.checked = false;
  }
  setPrivacyControlsDisabled(true);
  setPrivacyStatus("");
}

/**
 * Loads the current learner's private settings once per account. A private
 * profile intentionally starts with a blank nickname field, so a legacy name
 * can never become public just because someone checks the opt-in box.
 *
 * @param {User} user
 * @returns {void}
 */
function loadProfilePrivacy(user) {
  if (privacyUserId === user.id && (privacyLoaded || privacyLoading)) {
    return;
  }

  const version = ++privacyRequestVersion;
  privacyUserId = user.id;
  privacyLoaded = false;
  privacyLoading = true;
  privacyNicknameNeedsChoice = false;
  setPrivacyControlsDisabled(true);
  setPrivacyStatus("Loading private leaderboard settings...");

  void getProfilePrivacy()
    .then((result) => {
      if (version !== privacyRequestVersion || currentUser?.id !== user.id) {
        return;
      }
      privacyLoading = false;
      if (!result.ok) {
        setPrivacyStatus("Privacy settings are unavailable right now. Your progress remains private.");
        return;
      }

      const savedNickname = normalizeNickname(result.displayName);
      storedPrivateNickname = savedNickname || "Learner";
      privacyNicknameNeedsChoice = result.leaderboardVisible !== true;
      if (privacyNickname instanceof HTMLInputElement) {
        privacyNickname.value = result.leaderboardVisible ? savedNickname : "";
      }
      if (privacyVisible instanceof HTMLInputElement) {
        privacyVisible.checked = result.leaderboardVisible === true;
      }
      privacyLoaded = true;
      setPrivacyControlsDisabled(false);
      setPrivacyStatus(
        result.leaderboardVisible
          ? "Your chosen nickname and aggregate totals are visible on the leaderboard."
          : "Your progress is private. Choose a nickname only if you want to opt in.",
      );
    })
    .catch(() => {
      if (version !== privacyRequestVersion || currentUser?.id !== user.id) {
        return;
      }
      privacyLoading = false;
      setPrivacyStatus("Privacy settings are unavailable right now. Your progress remains private.");
    });
}

if (privacyVisible instanceof HTMLInputElement) {
  privacyVisible.addEventListener("change", () => {
    if (privacyVisible.checked && privacyNicknameNeedsChoice) {
      if (privacyNickname instanceof HTMLInputElement) {
        privacyNickname.value = "";
        privacyNickname.focus();
      }
      setPrivacyStatus("Choose a nickname before sharing your totals.");
    }
  });
}

if (privacyNickname instanceof HTMLInputElement) {
  privacyNickname.addEventListener("input", () => {
    if (normalizeNickname(privacyNickname.value) !== "") {
      privacyNicknameNeedsChoice = false;
    }
  });
}

if (privacyForm instanceof HTMLFormElement) {
  privacyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const user = currentUser;
    if (!user || !privacyLoaded || privacyLoading) {
      return;
    }

    const visible = privacyVisible instanceof HTMLInputElement && privacyVisible.checked;
    const nickname =
      privacyNickname instanceof HTMLInputElement ? normalizeNickname(privacyNickname.value) : "";

    // A private learner can leave this optional field blank. There is nothing
    // to save in that case, and their records remain private by default.
    if (!visible && nickname === "") {
      setPrivacyStatus("Your progress is already private. Choose a nickname only if you want to opt in.");
      return;
    }

    const error = nicknameError(nickname);
    if (error) {
      setPrivacyStatus(error);
      if (privacyNickname instanceof HTMLInputElement) {
        privacyNickname.focus();
      }
      return;
    }

    const version = ++privacyRequestVersion;
    privacyLoading = true;
    setPrivacyControlsDisabled(true);
    setPrivacyStatus("Saving privacy settings...");

    void updateProfilePrivacy({ displayName: nickname || storedPrivateNickname, leaderboardVisible: visible })
      .then((result) => {
        if (version !== privacyRequestVersion || currentUser?.id !== user.id) {
          return;
        }
        privacyLoading = false;
        if (!result.ok) {
          setPrivacyControlsDisabled(false);
          setPrivacyStatus("We couldn't save those privacy settings. Please try again.");
          return;
        }

        storedPrivateNickname = nickname;
        privacyNicknameNeedsChoice = false;
        privacyLoaded = true;
        setPrivacyControlsDisabled(false);
        setPrivacyStatus(
          visible
            ? "Your chosen nickname and aggregate totals are now visible on the leaderboard."
            : "Your progress is private and will not appear on the leaderboard.",
        );

        // The helper also updates the Auth metadata. Updating this view now
        // avoids leaving an old nickname on screen until the next auth event.
        currentUser = { ...user, name: nickname };
        renderIdentity(currentUser);
      })
      .catch(() => {
        if (version !== privacyRequestVersion || currentUser?.id !== user.id) {
          return;
        }
        privacyLoading = false;
        setPrivacyControlsDisabled(false);
        setPrivacyStatus("We couldn't save those privacy settings. Please try again.");
      });
  });
}

const resetButton = pick("[data-reset-button]");
const resetConfirm = pick("[data-reset-confirm]");
const resetYes = pick("[data-reset-yes]");
const resetCancel = pick("[data-reset-cancel]");
const resetStatus = pick("[data-reset-status]");

/**
 * @param {string} [message]
 * @returns {void}
 */
function closeConfirm(message) {
  if (resetConfirm) {
    resetConfirm.hidden = true;
  }
  if (resetButton) {
    resetButton.hidden = false;
  }
  if (resetStatus) {
    resetStatus.textContent = message ?? "";
  }
}

if (resetButton instanceof HTMLButtonElement) {
  resetButton.addEventListener("click", () => {
    if (resetConfirm) {
      resetConfirm.hidden = false;
    }
    resetButton.hidden = true;
    if (resetStatus) {
      resetStatus.textContent = "";
    }
    if (resetYes instanceof HTMLButtonElement) {
      resetYes.focus();
    }
  });
}

if (resetYes instanceof HTMLButtonElement) {
  resetYes.addEventListener("click", () => {
    const resetUser = currentUser;
    if (!resetUser) {
      closeConfirm("Sign in to reset your progress.");
      return;
    }

    for (const unit of PLAYABLE_UNITS) {
      resetEpisode(resetUser.id, unit.episodeId);
    }
    render(resetUser);
    closeConfirm("Progress cleared for every unit. Syncing that reset across your devices. Your badges stay.");
    if (resetButton instanceof HTMLButtonElement) {
      resetButton.focus();
    }

    // This does not block the local reset. A learner can keep using the page
    // while the authenticated database request completes.
    void resetRemoteProgress()
      .then(({ ok }) => {
        if (currentUser?.id !== resetUser.id || !resetStatus) {
          return;
        }
        resetStatus.textContent = ok
          ? "Progress cleared across your signed-in devices. Your badges stay."
          : "Progress was cleared on this device. We could not update saved progress yet. Check your connection and try again.";
      })
      .catch(() => {
        if (currentUser?.id === resetUser.id && resetStatus) {
          resetStatus.textContent =
            "Progress was cleared on this device. We could not update saved progress yet. Check your connection and try again.";
        }
      });
  });
}

if (resetCancel instanceof HTMLButtonElement) {
  resetCancel.addEventListener("click", () => {
    closeConfirm("Nothing was deleted.");
    if (resetButton instanceof HTMLButtonElement) {
      resetButton.focus();
    }
  });
}

const signOutButton = pick("[data-signout-button]");
if (signOutButton instanceof HTMLButtonElement) {
  signOutButton.addEventListener("click", () => {
    signOut();
  });
}

paintStaticIcons();

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
