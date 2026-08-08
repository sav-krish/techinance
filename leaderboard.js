// @ts-check

/**
 * Drives leaderboard.html.
 *
 * The board is deliberately remote-only. It never reads the browser's progress
 * cache or the legacy device roster, because showing everyone who has used a
 * shared computer would disclose learner identities without their consent.
 * Supabase returns only learners who have explicitly opted in through their
 * profile settings.
 */

import { getUser, initAuth, onAuthChange } from "./auth.js";
import { icon } from "./icon.js";
import { startProgressSync } from "./progress-sync.js";
import { fetchLeaderboard, isRemoteEnabled } from "./supabase.js";

/** @typedef {import("./auth.js").User} User */
/** @typedef {{ isCurrentUser: boolean, name: string, xp: number, badges: number, episodes: number }} Row */

/** A response from an earlier auth state must not repaint a later one. */
let renderVersion = 0;

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
 * @param {Row} row
 * @param {number} rank
 * @returns {HTMLElement}
 */
function renderRow(row, rank) {
  const isYou = row.isCurrentUser;
  const item = el("li", `board-row${isYou ? " board-row--you" : ""}`);

  const place = el("span", "board-row__rank");
  if (rank <= 3) {
    const marker = el("span", `board-row__medal board-row__medal--${rank}`);
    marker.setAttribute("aria-hidden", "true");
    marker.appendChild(icon("medal", { size: 18 }));
    place.append(marker);
  }
  place.append(el("span", "board-row__place", String(rank)));

  const who = el("div", "board-row__who");
  const name = el("p", "board-row__name", row.name);
  if (isYou) {
    name.append(el("span", "board-row__you", "You"));
  }
  const badgeWord = row.badges === 1 ? "badge" : "badges";
  const episodeWord = row.episodes === 1 ? "episode" : "episodes";
  who.append(
    name,
    el(
      "p",
      "board-row__meta",
      `${formatNumber(row.badges)} ${badgeWord} · ${formatNumber(row.episodes)} ${episodeWord} finished`,
    ),
  );

  const xp = el("p", "board-row__xp");
  xp.append(el("span", "board-row__xp-value", formatNumber(row.xp)), el("span", "board-row__xp-label", "XP"));

  item.append(place, who, xp);
  return item;
}

/**
 * @param {Row[]} rows
 * @param {string} countText
 * @returns {void}
 */
function paint(rows, countText) {
  const list = pick("[data-board-list]");
  const empty = pick("[data-board-empty]");
  const count = pick("[data-board-count]");
  if (!list) {
    return;
  }
  if (empty) {
    empty.hidden = rows.length > 0;
  }
  list.hidden = rows.length === 0;
  list.replaceChildren(...rows.map((row, index) => renderRow(row, index + 1)));
  if (count) {
    count.textContent = countText;
  }
}

/**
 * @param {User | null} user
 * @returns {void}
 */
function render(user) {
  const version = ++renderVersion;
  for (const node of pickAll("[data-signed-out]")) {
    node.hidden = user !== null;
  }
  for (const node of pickAll("[data-signed-in]")) {
    node.hidden = user === null;
  }
  if (!user) {
    return;
  }

  if (!isRemoteEnabled()) {
    paint([], "The leaderboard is unavailable right now.");
    return;
  }

  paint([], "Loading the leaderboard...");
  fetchLeaderboard(50)
    .then(({ rows, error }) => {
      if (version !== renderVersion || getUser()?.id !== user.id) {
        return;
      }
      if (error) {
        paint([], "The leaderboard is temporarily unavailable. Your progress remains private.");
        return;
      }
      const mapped = rows.map((row) => ({
        isCurrentUser: row.isCurrentUser === true,
        name: row.name,
        xp: row.xp,
        badges: row.badges,
        episodes: row.episodes,
      }));
      paint(
        mapped,
        mapped.length === 1
          ? "1 learner has chosen to share their totals."
          : `${formatNumber(mapped.length)} learners have chosen to share their totals.`,
      );
    })
    .catch(() => {
      if (version === renderVersion && getUser()?.id === user.id) {
        paint([], "The leaderboard is temporarily unavailable. Your progress remains private.");
      }
    });
}

/**
 * Fills every `[data-icon="name"]` placeholder in the static markup.
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

paintStaticIcons();
initAuth();
startProgressSync();
render(getUser());
onAuthChange(render);
window.addEventListener("techinance:progress-hydrated", () => render(getUser()));
