// @ts-check

import { icon } from "./icon.js";
import {
  addXp,
  awardBadge,
  completeEpisode,
  getCheckpoint,
  getProgress,
  resetEpisode,
  saveScene,
  setCheckpoint,
} from "./progress.js";

/**
 * @typedef {Object} StorySource
 * @property {string} label
 * @property {string} url
 */

/**
 * @typedef {Object} StoryOption
 * @property {string} label
 * @property {string} [next]
 * @property {number} [xp]
 * @property {string} [feedback]
 * @property {"good" | "bad" | "neutral"} [tone]
 * @property {boolean} [correct]
 */

/**
 * @typedef {Object} ArtifactField
 * @property {string} label
 * @property {string} value
 * @property {string} [hot]
 */

/**
 * @typedef {{ hot: string, text: string }} ArtifactHotLine
 * @typedef {string | ArtifactHotLine} ArtifactBodyEntry
 */

/**
 * @typedef {Object} StoryArtifact
 * @property {string} [kind]
 * @property {ArtifactField[]} [fields]
 * @property {ArtifactBodyEntry[]} [body]
 */

/**
 * @typedef {Object} StoryHotspot
 * @property {boolean} [suspicious]
 * @property {string} [explain]
 */

/**
 * @typedef {Object} StoryBucket
 * @property {string} id
 * @property {string} label
 * @property {string} [hint]
 */

/**
 * @typedef {Object} StorySortItem
 * @property {string} id
 * @property {string} label
 * @property {string} bucket
 * @property {string} [explain]
 */

/**
 * @typedef {Object} StoryCommand
 * @property {string} id
 * @property {string} cmd
 * @property {string[]} [output]
 * @property {boolean} [required]
 */

/**
 * @typedef {Object} StoryTerm
 * @property {string} term
 * @property {string} definition
 */

/**
 * @typedef {Object} StoryBadge
 * @property {string} id
 * @property {string} [name]
 * @property {string} [description]
 * @property {string} [icon]
 */

/**
 * A scene. Every field beyond `id` and `type` is optional so that any content
 * module in `content/` type-checks against this shape.
 *
 * @typedef {Object} Scene
 * @property {string} id
 * @property {string} type
 * @property {string | null} [next]
 * @property {string[]} [text]
 * @property {string} [title]
 * @property {string} [prompt]
 * @property {string} [question]
 * @property {string} [speaker]
 * @property {string} [avatar]
 * @property {string} [location]
 * @property {number} [xp]
 * @property {string} [badge]
 * @property {StorySource} [source]
 * @property {(StoryOption | string)[]} [options]
 * @property {number} [answerIndex]
 * @property {string} [value]
 * @property {string} [caption]
 * @property {string} [explain]
 * @property {StoryArtifact} [artifact]
 * @property {Record<string, StoryHotspot>} [hotspots]
 * @property {number} [requiredFinds]
 * @property {StoryBucket[]} [buckets]
 * @property {StorySortItem[]} [items]
 * @property {string} [host]
 * @property {StoryCommand[]} [commands]
 * @property {StoryTerm[]} [terms]
 * @property {string} [teaser]
 */

/**
 * @typedef {Object} Episode
 * @property {string} id
 * @property {string} [course]
 * @property {string} [courseTitle]
 * @property {number} [unit]
 * @property {string} [title]
 * @property {string} [subtitle]
 * @property {string} [role]
 * @property {number} [estMinutes]
 * @property {string} startScene
 * @property {StoryBadge[]} [badges]
 * @property {Record<string, Scene>} scenes
 */

/**
 * @typedef {Object} StoryUser
 * @property {string} id
 * @property {string} [name]
 * @property {string} [email]
 * @property {string} [picture]
 * @property {boolean} [guest]
 */

/**
 * @typedef {Object} MountStoryOptions
 * @property {HTMLElement} root
 * @property {Episode} episode
 * @property {StoryUser | null} [user]
 * @property {() => void} [onExit]
 */

const TYPE_SPEED_MS = 16;
const STAGGER_MS = 110;
const TOAST_MS = 2600;
const COUNT_UP_MS = 1200;

/* ------------------------------------------------------------------ *
 * Small DOM + data helpers
 * ------------------------------------------------------------------ */

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asRecord(value) {
  if (value && typeof value === "object") {
    return /** @type {Record<string, unknown>} */ (value);
  }
  return {};
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function asStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry) => typeof entry === "string");
}

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function make(tag, className, text) {
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
 * @param {string} className
 * @param {string} label
 * @returns {HTMLButtonElement}
 */
function makeButton(className, label) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = label;
  return node;
}

/**
 * Visually hides a node without relying on learn.css being loaded.
 *
 * @param {HTMLElement} node
 * @returns {HTMLElement}
 */
function hideVisually(node) {
  node.classList.add("story-visually-hidden");
  node.style.position = "absolute";
  node.style.width = "1px";
  node.style.height = "1px";
  node.style.overflow = "hidden";
  node.style.clip = "rect(0 0 0 0)";
  node.style.clipPath = "inset(50%)";
  node.style.whiteSpace = "nowrap";
  return node;
}

/**
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * @param {number} index
 * @returns {string}
 */
function optionLetter(index) {
  return String.fromCharCode(65 + (index % 26));
}

/**
 * The A/B/C marker is decoration. Screen readers should hear the label only.
 *
 * @param {number} index
 * @returns {HTMLElement}
 */
function makeOptionIndex(index) {
  const node = make("span", "story-choice-index", optionLetter(index));
  node.setAttribute("aria-hidden", "true");
  return node;
}

/**
 * @param {StoryOption | string} option
 * @returns {StoryOption}
 */
function normaliseOption(option) {
  return typeof option === "string" ? { label: option } : option;
}

/* ------------------------------------------------------------------ *
 * Engine
 * ------------------------------------------------------------------ */

/**
 * Mounts the story player into `root`.
 *
 * @param {MountStoryOptions} options
 * @returns {void}
 */
export function mountStory(options) {
  const root = options.root;
  const episode = options.episode;
  const user = options.user ?? null;
  const userId = user && user.id ? user.id : "guest";
  const episodeId = episode && episode.id ? episode.id : "episode";

  const exit =
    typeof options.onExit === "function"
      ? options.onExit
      : () => {
          window.location.href = "learn.html";
        };

  /** @type {Set<number>} */
  const timers = new Set();
  /** @type {Set<number>} */
  const frames = new Set();

  /**
   * @param {() => void} fn
   * @param {number} ms
   * @returns {number}
   */
  function later(fn, ms) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  /**
   * @param {FrameRequestCallback} fn
   * @returns {void}
   */
  function frame(fn) {
    const id = window.requestAnimationFrame((time) => {
      frames.delete(id);
      fn(time);
    });
    frames.add(id);
  }

  /**
   * @returns {void}
   */
  function clearPending() {
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
    frames.forEach((id) => window.cancelAnimationFrame(id));
    frames.clear();
  }

  /* ---------------- shell ---------------- */

  root.classList.add("story-root");
  root.replaceChildren();

  const shell = make("div", "story-shell");
  const hud = make("header", "story-hud");
  const stage = make("main", "story-stage");
  const toastTray = make("div", "story-toast-tray");
  toastTray.setAttribute("aria-live", "polite");
  toastTray.setAttribute("role", "status");
  shell.append(hud, stage, toastTray);
  root.append(shell);

  const hudTitle = make("p", "story-hud-title", episode?.title ?? "Story mode");
  const hudSubtitle = make(
    "p",
    "story-hud-subtitle",
    episode?.subtitle ?? episode?.courseTitle ?? "",
  );
  const hudAct = make("p", "story-hud-act", "");
  const progressBar = make("div", "story-progress-bar");
  const progressFill = make("div", "story-progress-fill");
  progressBar.append(progressFill);
  progressBar.setAttribute("role", "progressbar");
  progressBar.setAttribute("aria-valuemin", "0");
  progressBar.setAttribute("aria-valuemax", "100");
  progressBar.setAttribute("aria-label", "Episode Progress");
  const progressLabel = make("p", "story-progress-label", "");
  const progress = make("div", "story-progress");
  progress.append(hudAct, progressBar, progressLabel);

  const hudMain = make("div", "story-hud-main");
  hudMain.append(hudTitle, hudSubtitle, progress);

  const xpValue = make("span", "story-xp-value", "0");
  const xpBox = make("p", "story-xp");
  const xpIcon = make("span", "story-xp-icon");
  xpIcon.append(icon("zap", { size: 14 }));
  xpBox.append(xpIcon, xpValue, make("span", "story-xp-label", "XP"));

  const badgeTray = make("ul", "story-badges");
  const hudExit = makeButton("story-button story-button-ghost story-hud-exit", "Back to my learning");
  hudExit.addEventListener("click", () => {
    clearPending();
    exit();
  });

  const hudStats = make("div", "story-hud-stats");
  hudStats.append(xpBox, badgeTray, hudExit);
  hud.append(hudMain, hudStats);

  /* ---------------- progress helpers ---------------- */

  /**
   * @returns {Record<string, unknown>}
   */
  function readProgress() {
    try {
      return asRecord(getProgress(userId));
    } catch {
      return {};
    }
  }

  /**
   * @param {string} sceneId
   * @returns {Record<string, unknown>}
   */
  function sceneRecord(sceneId) {
    return asRecord(asRecord(readProgress().scenes)[sceneId]);
  }

  /**
   * @returns {string[]}
   */
  function earnedBadgeIds() {
    const badges = readProgress().badges;
    return Array.isArray(badges) ? badges.filter((id) => typeof id === "string") : [];
  }

  /**
   * @returns {number}
   */
  function episodeXp() {
    const episodes = asRecord(readProgress().episodes);
    return asNumber(asRecord(episodes[episodeId]).xp);
  }

  /**
   * @param {string} sceneId
   * @returns {number}
   */
  function actNumber(sceneId) {
    const match = /^a(\d+)-/.exec(sceneId);
    return match ? Number(match[1]) : 0;
  }

  const sceneIds = Object.keys(asRecord(episode?.scenes));
  const actCount = new Set(
    sceneIds.map((id) => actNumber(id)).filter((act) => act > 0),
  ).size;

  /**
   * @param {string} currentId
   * @returns {void}
   */
  function updateHud(currentId) {
    const visited = asRecord(readProgress().scenes);
    let seen = 0;
    sceneIds.forEach((id) => {
      if (asRecord(visited[id]).visited === true) {
        seen += 1;
      }
    });
    const total = Math.max(sceneIds.length, 1);
    const percent = Math.min(100, Math.round((seen / total) * 100));
    progressFill.style.width = `${percent}%`;
    progressBar.setAttribute("aria-valuenow", String(percent));
    progressLabel.textContent = `${seen} of ${total} scenes done · ${percent}%`;

    const act = actNumber(currentId);
    if (act > 0 && actCount > 0) {
      hudAct.textContent = `Act ${act} of ${actCount}`;
    } else {
      hudAct.textContent = episode?.role ? `Your role: ${episode.role}` : "";
    }

    xpValue.textContent = String(asNumber(readProgress().xp));

    const earned = earnedBadgeIds();
    badgeTray.replaceChildren();
    const badges = Array.isArray(episode?.badges) ? episode.badges : [];
    badges.forEach((badge) => {
      const has = earned.includes(badge.id);
      const item = make(
        "li",
        `story-badge ${has ? "story-badge-earned" : "story-badge-locked"}`,
      );
      const slot = make("span", "story-badge-icon");
      slot.append(has ? icon(badge.icon ?? "award", { size: 16 }) : icon("lock", { size: 16 }));
      item.append(slot);
      const name = badge.name ?? badge.id;
      item.title = has ? `${name}: earned` : `${name}: locked`;
      item.append(hideVisually(make("span", "story-badge-name", item.title)));
      badgeTray.append(item);
    });
  }

  /**
   * @param {string} message
   * @param {string} [modifier]
   * @param {string} [iconName]
   * @returns {void}
   */
  function toast(message, modifier, iconName) {
    const node = make("p", `story-toast ${modifier ?? "story-toast-xp"}`, message);
    if (iconName) {
      node.prepend(icon(iconName, { size: 16, className: "story-toast-icon" }));
    }
    toastTray.append(node);
    later(() => {
      node.remove();
    }, TOAST_MS);
  }

  /**
   * Awards xp + badge for a scene, at most once ever.
   *
   * The store only keeps `{visited, correct}` per scene, so `visited` doubles
   * as the "completed and paid out" flag: it is written on completion, never
   * on entry. Re-walking a scene through a branch therefore pays nothing.
   *
   * @param {Scene} scene
   * @param {{ xp?: number, correct?: boolean }} [detail]
   * @returns {void}
   */
  function grantOnce(scene, detail) {
    if (sceneRecord(scene.id).visited === true) {
      updateHud(scene.id);
      return;
    }
    const amount = detail && typeof detail.xp === "number" ? detail.xp : asNumber(scene.xp);
    if (amount > 0) {
      addXp(userId, episodeId, amount);
      toast(`+${amount} XP`, "story-toast-xp");
    }
    if (typeof scene.badge === "string" && scene.badge) {
      const isNew = awardBadge(userId, scene.badge);
      if (isNew) {
        const meta = (episode?.badges ?? []).find((badge) => badge.id === scene.badge);
        const name = meta?.name ?? scene.badge;
        toast(`Badge unlocked: ${name}`, "story-toast-badge", meta?.icon ?? "award");
      }
    }
    saveScene(userId, episodeId, scene.id, {
      visited: true,
      correct: detail?.correct === true,
    });
    updateHud(scene.id);
  }

  /* ---------------- shared scene furniture ---------------- */

  /**
   * @param {HTMLElement[]} nodes
   * @returns {void}
   */
  function staggerIn(nodes) {
    if (prefersReducedMotion()) {
      return;
    }
    nodes.forEach((node, index) => {
      node.classList.add("story-prose-reveal");
      node.style.opacity = "0";
      node.style.transform = "translateY(8px)";
      node.style.transition = "opacity 340ms ease, transform 340ms ease";
      node.style.transitionDelay = `${index * STAGGER_MS}ms`;
      frame(() => {
        frame(() => {
          node.style.opacity = "";
          node.style.transform = "";
        });
      });
    });
  }

  /**
   * @param {string[]} lines
   * @returns {HTMLElement}
   */
  function makeProse(lines) {
    const prose = make("div", "story-prose");
    /** @type {HTMLElement[]} */
    const paragraphs = [];
    asStringList(lines).forEach((line) => {
      const p = make("p", "story-prose-line", line);
      paragraphs.push(p);
      prose.append(p);
    });
    staggerIn(paragraphs);
    return prose;
  }

  /**
   * @param {Scene} scene
   * @returns {HTMLElement | null}
   */
  function makeSpeaker(scene) {
    if (!scene.speaker && !scene.location && !scene.avatar) {
      return null;
    }
    const head = make("div", "story-scene-head");
    if (scene.speaker || scene.avatar) {
      const speaker = make("div", "story-speaker");
      const avatar = make("span", "story-speaker-avatar");
      avatar.setAttribute("aria-hidden", "true");
      avatar.append(icon(scene.avatar ?? "user", { size: 22 }));
      speaker.append(avatar, make("span", "story-speaker-name", scene.speaker ?? ""));
      head.append(speaker);
    }
    if (scene.location) {
      const chip = make("span", "story-chip story-chip-location");
      chip.append(
        icon("map-pin", { size: 12 }),
        make("span", "story-chip-text", scene.location),
      );
      head.append(chip);
    }
    return head;
  }

  /**
   * @param {StorySource | undefined} source
   * @returns {HTMLElement | null}
   */
  function makeSource(source) {
    if (!source || !source.url) {
      return null;
    }
    const wrap = make("p", "story-source");
    const glyph = icon("link", { size: 14, className: "story-source-icon" });
    const link = document.createElement("a");
    link.className = "story-source-link";
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = source.label ?? source.url;
    wrap.append(glyph, make("span", "story-source-label", "Source:"), link);
    return wrap;
  }

  /**
   * @typedef {Object} SceneFrame
   * @property {HTMLElement} section
   * @property {HTMLElement} title
   * @property {HTMLElement} body
   * @property {HTMLElement} feedback
   * @property {HTMLElement} foot
   * @property {(text: string, tone?: string) => void} say
   */

  /**
   * Builds the shared scene chrome (head, title, prose, live region, footer).
   *
   * @param {Scene} scene
   * @param {string} heading
   * @returns {SceneFrame}
   */
  function makeSceneFrame(scene, heading) {
    const section = make("section", `story-scene story-scene-${scene.type}`);
    section.setAttribute("aria-labelledby", `story-title-${scene.id}`);

    const head = makeSpeaker(scene);
    if (head) {
      section.append(head);
    }

    const title = make("h2", "story-scene-title", heading);
    title.id = `story-title-${scene.id}`;
    title.tabIndex = -1;
    section.append(title);

    section.append(makeProse(scene.text ?? []));

    const body = make("div", "story-scene-body");
    section.append(body);

    const feedback = make("div", "story-feedback");
    feedback.setAttribute("aria-live", "polite");
    section.append(feedback);

    const foot = make("footer", "story-scene-foot");
    const source = makeSource(scene.source);
    if (source) {
      foot.append(source);
    }
    section.append(foot);

    /**
     * @param {string} text
     * @param {string} [tone]
     * @returns {void}
     */
    function say(text, tone) {
      feedback.className = `story-feedback story-feedback-${tone ?? "info"}`;
      feedback.replaceChildren(make("p", "story-feedback-text", text));
    }

    return { section, title, body, feedback, foot, say };
  }

  /**
   * @param {SceneFrame} frameRef
   * @param {string} label
   * @param {() => void} onClick
   * @param {boolean} [enabled]
   * @returns {HTMLButtonElement}
   */
  function addContinue(frameRef, label, onClick, enabled) {
    const button = makeButton("story-button story-button-primary story-continue", label);
    button.disabled = enabled === false;
    button.addEventListener("click", onClick);
    frameRef.foot.append(button);
    return button;
  }

  /* ---------------- navigation ---------------- */

  let firstRender = true;

  /**
   * @param {string | null | undefined} sceneId
   * @returns {void}
   */
  function goTo(sceneId) {
    clearPending();
    if (!sceneId) {
      renderError("This scene doesn't link to a next scene.");
      return;
    }
    const scene = asRecord(episode?.scenes)[sceneId];
    if (!scene || typeof scene !== "object") {
      renderError(`Missing scene: ${sceneId}`);
      return;
    }
    const typed = /** @type {Scene} */ (scene);
    setCheckpoint(userId, episodeId, sceneId);
    updateHud(sceneId);

    const frameRef = renderScene(typed);
    stage.replaceChildren(frameRef.section);

    if (firstRender) {
      firstRender = false;
    } else {
      frameRef.title.focus({ preventScroll: true });
      if (!prefersReducedMotion()) {
        stage.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        stage.scrollIntoView({ block: "start" });
      }
    }
  }

  /**
   * @param {string} message
   * @returns {void}
   */
  function renderError(message) {
    const section = make("section", "story-scene story-error");
    const title = make("h2", "story-scene-title", "Something Went Wrong");
    title.tabIndex = -1;
    section.append(title, make("p", "story-error-text", message));
    const back = makeButton("story-button story-button-secondary", "Back to my learning");
    back.addEventListener("click", () => exit());
    section.append(back);
    stage.replaceChildren(section);
    title.focus({ preventScroll: true });
  }

  /**
   * @param {Scene} scene
   * @returns {SceneFrame}
   */
  function renderScene(scene) {
    switch (scene.type) {
      case "narrative":
        return renderNarrative(scene);
      case "choice":
        return renderChoice(scene);
      case "quiz":
        return renderQuiz(scene);
      case "reveal":
        return renderReveal(scene);
      case "inspect":
        return renderInspect(scene);
      case "sort":
        return renderSort(scene);
      case "terminal":
        return renderTerminal(scene);
      case "dossier":
        return renderDossier(scene);
      case "ending":
        return renderEnding(scene);
      default:
        return renderUnknown(scene);
    }
  }

  /**
   * @param {Scene} scene
   * @returns {SceneFrame}
   */
  function renderUnknown(scene) {
    const frameRef = makeSceneFrame(scene, scene.title ?? "Scene");
    frameRef.say(`This scene type isn't supported yet: ${scene.type}`, "bad");
    addContinue(frameRef, "Continue", () => {
      grantOnce(scene);
      goTo(scene.next);
    });
    return frameRef;
  }

  /* ---------------- 1. narrative ---------------- */

  /**
   * @param {Scene} scene
   * @returns {SceneFrame}
   */
  function renderNarrative(scene) {
    const frameRef = makeSceneFrame(scene, scene.title ?? scene.speaker ?? "Briefing");
    addContinue(frameRef, "Continue", () => {
      grantOnce(scene);
      goTo(scene.next);
    });
    return frameRef;
  }

  /* ---------------- 2. choice ---------------- */

  /**
   * @param {Scene} scene
   * @returns {SceneFrame}
   */
  function renderChoice(scene) {
    const frameRef = makeSceneFrame(scene, scene.title ?? "Your Decision");
    if (scene.prompt) {
      frameRef.body.append(make("p", "story-prompt", scene.prompt));
    }

    const list = make("div", "story-choices");
    list.setAttribute("role", "group");
    if (scene.prompt) {
      list.setAttribute("aria-label", scene.prompt);
    }
    frameRef.body.append(list);

    const options = (scene.options ?? []).map(normaliseOption);
    /** @type {HTMLButtonElement[]} */
    const buttons = [];

    options.forEach((option, index) => {
      const button = makeButton("story-choice", "");
      button.append(makeOptionIndex(index));
      button.append(make("span", "story-choice-label", option.label));
      button.addEventListener("click", () => {
        if (button.disabled) {
          return;
        }
        const tone = option.tone ?? "neutral";
        buttons.forEach((other) => {
          other.disabled = true;
          other.classList.add("story-choice-disabled");
        });
        button.classList.remove("story-choice-disabled");
        button.classList.add("story-choice-selected", `story-choice-${tone}`);
        frameRef.say(option.feedback ?? "Choice recorded.", tone);
        grantOnce(scene, { xp: asNumber(scene.xp) + asNumber(option.xp), correct: tone === "good" });
        const next = addContinue(frameRef, "Continue", () => goTo(option.next ?? scene.next));
        next.focus({ preventScroll: true });
      });
      buttons.push(button);
      list.append(button);
    });

    return frameRef;
  }

  /* ---------------- 3. quiz ---------------- */

  /**
   * @param {Scene} scene
   * @returns {SceneFrame}
   */
  function renderQuiz(scene) {
    const frameRef = makeSceneFrame(scene, scene.title ?? "Knowledge Check");
    if (scene.question) {
      frameRef.body.append(make("p", "story-question", scene.question));
    }

    const list = make("div", "story-quiz-options");
    list.setAttribute("role", "group");
    if (scene.question) {
      list.setAttribute("aria-label", scene.question);
    }
    frameRef.body.append(list);

    const status = make("p", "story-quiz-status", "");
    status.setAttribute("aria-live", "polite");
    frameRef.body.append(status);

    const options = (scene.options ?? []).map(normaliseOption);
    /** @type {HTMLButtonElement[]} */
    const buttons = [];
    let attempts = 0;
    let solved = false;

    /**
     * @param {boolean} locked
     * @returns {void}
     */
    function lockAll(locked) {
      buttons.forEach((button) => {
        if (button.classList.contains("story-quiz-option-wrong")) {
          button.disabled = true;
          return;
        }
        button.disabled = locked;
        button.classList.toggle("story-quiz-option-locked", locked);
      });
    }

    options.forEach((option, index) => {
      const button = makeButton("story-quiz-option", "");
      button.append(makeOptionIndex(index));
      button.append(make("span", "story-quiz-option-label", option.label));
      const mark = make("span", "story-quiz-mark", "");
      mark.setAttribute("aria-hidden", "true");
      button.append(mark);

      button.addEventListener("click", () => {
        if (solved || button.disabled) {
          return;
        }
        attempts += 1;
        button.classList.add("story-quiz-option-chosen");
        lockAll(true);

        if (option.correct === true) {
          solved = true;
          button.classList.add("story-quiz-option-correct");
          mark.replaceChildren(icon("check", { size: 18 }));
          status.textContent =
            attempts === 1 ? "Correct, first try." : "Correct.";
          frameRef.say(option.feedback ?? "Correct.", "good");
          grantOnce(scene, {
            xp: attempts === 1 ? asNumber(scene.xp) : 0,
            correct: true,
          });
          const next = addContinue(frameRef, "Continue", () => goTo(scene.next));
          next.focus({ preventScroll: true });
          return;
        }

        button.classList.add("story-quiz-option-wrong");
        button.disabled = true;
        mark.replaceChildren(icon("x", { size: 18 }));
        status.textContent = "Not quite. Read the explanation, then try again.";
        frameRef.say(option.feedback ?? "Not quite, try again.", "bad");

        const retry = makeButton("story-button story-button-secondary story-quiz-retry", "Try again");
        retry.addEventListener("click", () => {
          retry.remove();
          lockAll(false);
          frameRef.say("Pick another answer.", "info");
          const firstOpen = buttons.find((candidate) => !candidate.disabled);
          if (firstOpen) {
            firstOpen.focus({ preventScroll: true });
          }
        });
        frameRef.feedback.append(retry);
        retry.focus({ preventScroll: true });
      });

      buttons.push(button);
      list.append(button);
    });

    return frameRef;
  }

  /* ---------------- 4. reveal ---------------- */

  /**
   * @param {HTMLElement} node
   * @param {string} text
   * @returns {void}
   */
  function animateValue(node, text) {
    if (prefersReducedMotion()) {
      node.textContent = text;
      return;
    }
    const match = /-?\d[\d,]*(\.\d+)?/.exec(text);
    if (!match) {
      scrambleValue(node, text);
      return;
    }
    const raw = match[0];
    const start = match.index;
    const prefix = text.slice(0, start);
    const suffix = text.slice(start + raw.length);
    const grouped = raw.includes(",");
    const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
    const target = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(target)) {
      node.textContent = text;
      return;
    }

    node.classList.add("story-reveal-counting");
    const begun = performance.now();

    /**
     * @param {number} now
     * @returns {void}
     */
    function step(now) {
      const t = Math.min(1, (now - begun) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = target * eased;
      const shown = grouped
        ? current.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : current.toFixed(decimals);
      node.textContent = `${prefix}${shown}${suffix}`;
      if (t < 1) {
        frame(step);
      } else {
        node.textContent = text;
        node.classList.remove("story-reveal-counting");
      }
    }

    frame(step);
  }

  /**
   * @param {HTMLElement} node
   * @param {string} text
   * @returns {void}
   */
  function scrambleValue(node, text) {
    const pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%.,";
    node.classList.add("story-reveal-counting");
    let locked = 0;

    /**
     * @returns {void}
     */
    function tick() {
      const chars = text.split("").map((char, index) => {
        if (index < locked || char === " ") {
          return char;
        }
        return pool[Math.floor(Math.random() * pool.length)];
      });
      node.textContent = chars.join("");
      locked += 1;
      if (locked <= text.length) {
        later(tick, 45);
      } else {
        node.textContent = text;
        node.classList.remove("story-reveal-counting");
      }
    }

    tick();
  }

  /**
   * @param {Scene} scene
   * @returns {SceneFrame}
   */
  function renderReveal(scene) {
    const frameRef = makeSceneFrame(scene, scene.title ?? "Estimate the Number");
    if (scene.question) {
      frameRef.body.append(make("p", "story-question", scene.question));
    }

    const list = make("div", "story-reveal-options");
    list.setAttribute("role", "group");
    if (scene.question) {
      list.setAttribute("aria-label", scene.question);
    }
    frameRef.body.append(list);

    const stageBox = make("div", "story-reveal-stage");
    frameRef.body.append(stageBox);

    const options = (scene.options ?? []).map(normaliseOption);
    /** @type {HTMLButtonElement[]} */
    const buttons = [];
    let answered = false;

    options.forEach((option, index) => {
      const button = makeButton("story-reveal-option", option.label);
      button.addEventListener("click", () => {
        if (answered) {
          return;
        }
        answered = true;
        const right = index === asNumber(scene.answerIndex);
        buttons.forEach((other, otherIndex) => {
          other.disabled = true;
          if (otherIndex === asNumber(scene.answerIndex)) {
            other.classList.add("story-reveal-option-correct");
          }
        });
        button.classList.add(
          "story-reveal-option-chosen",
          right ? "story-reveal-option-correct" : "story-reveal-option-wrong",
        );
        frameRef.say(
          right
            ? "Correct. That's the right order of magnitude."
            : "Not quite. Here's the real number.",
          right ? "good" : "bad",
        );

        const valueNode = make("p", "story-reveal-value", "");
        valueNode.setAttribute("aria-live", "polite");
        stageBox.append(valueNode);
        animateValue(valueNode, scene.value ?? "");

        if (scene.caption) {
          stageBox.append(make("p", "story-reveal-caption", scene.caption));
        }
        if (scene.explain) {
          stageBox.append(make("p", "story-reveal-explain", scene.explain));
        }

        grantOnce(scene, { correct: right });
        const next = addContinue(frameRef, "Continue", () => goTo(scene.next));
        next.focus({ preventScroll: true });
      });
      buttons.push(button);
      list.append(button);
    });

    return frameRef;
  }

  /* ---------------- 5. inspect ---------------- */

  /**
   * @param {Scene} scene
   * @returns {SceneFrame}
   */
  function renderInspect(scene) {
    const frameRef = makeSceneFrame(scene, scene.title ?? "Inspect the Evidence");
    if (scene.prompt) {
      frameRef.body.append(make("p", "story-prompt", scene.prompt));
    }

    const artifact = scene.artifact ?? {};
    const hotspots = scene.hotspots ?? {};
    const suspiciousIds = Object.keys(hotspots).filter(
      (id) => hotspots[id] && hotspots[id].suspicious === true,
    );
    const needed = Math.min(
      asNumber(scene.requiredFinds) || suspiciousIds.length,
      Math.max(suspiciousIds.length, 1),
    );

    // Continue unlocks at `needed`, but a learner who keeps digging can find
    // every planted tell, so the counter counts towards the real total rather
    // than reporting an absurd "7 of 5".
    const total = Math.max(suspiciousIds.length, needed);

    /** @type {Set<string>} */
    const found = new Set();

    const counter = make("p", "story-finds", "");
    counter.setAttribute("aria-live", "polite");
    const countValue = make("span", "story-finds-count", `0 of ${total}`);
    counter.append(make("span", "story-finds-label", "Clues found: "), countValue);

    const card = make("div", `story-artifact story-artifact-${artifact.kind ?? "email"}`);
    const cardHead = make("div", "story-artifact-head");
    cardHead.append(make("span", "story-artifact-kind", artifactLabel(artifact.kind)));
    card.append(cardHead);

    let continueButton = /** @type {HTMLButtonElement | null} */ (null);

    /**
     * @returns {void}
     */
    function refresh() {
      countValue.textContent = `${found.size} of ${total}`;
      if (continueButton && found.size >= needed) {
        continueButton.disabled = false;
      }
    }

    /**
     * @param {HTMLButtonElement} button
     * @param {string} hotId
     * @returns {void}
     */
    function wireHotspot(button, hotId) {
      button.addEventListener("click", () => {
        const spot = hotspots[hotId] ?? {};
        if (spot.suspicious === true) {
          button.classList.add("story-hotspot-found");
          button.setAttribute("aria-pressed", "true");
          found.add(hotId);
          frameRef.say(spot.explain ?? "That's a warning sign.", "good");
          refresh();
          return;
        }
        button.classList.add("story-hotspot-clear");
        frameRef.say(
          `${spot.explain ?? "There's nothing wrong with this one."} Check something else.`,
          "neutral",
        );
      });
    }

    const fields = Array.isArray(artifact.fields) ? artifact.fields : [];
    if (fields.length > 0) {
      const fieldList = make("dl", "story-artifact-fields");
      fields.forEach((field) => {
        const label = make("dt", "story-artifact-field-label", field.label);
        const value = make("dd", "story-artifact-field-value");
        if (field.hot && hotspots[field.hot]) {
          const button = makeButton("story-hotspot story-hotspot-field", field.value);
          button.setAttribute("aria-pressed", "false");
          wireHotspot(button, field.hot);
          value.append(button);
        } else {
          value.textContent = field.value;
        }
        fieldList.append(label, value);
      });
      card.append(fieldList);
    }

    const body = Array.isArray(artifact.body) ? artifact.body : [];
    if (body.length > 0) {
      const bodyBox = make("div", "story-artifact-body");
      body.forEach((entry) => {
        if (typeof entry === "string") {
          bodyBox.append(make("p", "story-artifact-line", entry));
          return;
        }
        const line = make("p", "story-artifact-line");
        const button = makeButton("story-hotspot", entry.text);
        button.setAttribute("aria-pressed", "false");
        wireHotspot(button, entry.hot);
        line.append(button);
        bodyBox.append(line);
      });
      card.append(bodyBox);
    }

    frameRef.body.append(counter, card);
    frameRef.say(
      `Click any part that looks wrong. Find ${needed} clue${needed === 1 ? "" : "s"} to continue.`,
      "info",
    );

    continueButton = addContinue(
      frameRef,
      "Continue",
      () => {
        grantOnce(scene, { correct: true });
        goTo(scene.next);
      },
      false,
    );
    refresh();

    return frameRef;
  }

  /**
   * @param {string | undefined} kind
   * @returns {string}
   */
  function artifactLabel(kind) {
    if (kind === "log") {
      return "Server log";
    }
    if (kind === "headers") {
      return "Message Headers";
    }
    if (kind === "posting") {
      return "Job Posting";
    }
    if (kind === "statement") {
      return "Account Statement";
    }
    if (kind === "plan") {
      return "Retirement Plan";
    }
    if (kind === "report") {
      return "Research Write-up";
    }
    if (kind === "recovery") {
      return "Recovery Plan";
    }
    if (kind === "assessment") {
      return "Founder Doc";
    }
    return "Email";
  }

  /* ---------------- 6. sort ---------------- */

  /**
   * @param {Scene} scene
   * @returns {SceneFrame}
   */
  function renderSort(scene) {
    const frameRef = makeSceneFrame(scene, scene.title ?? "Sort the Items");
    if (scene.prompt) {
      frameRef.body.append(make("p", "story-prompt", scene.prompt));
    }

    const wrap = make("div", "story-sort");
    const tray = make("div", "story-sort-items");
    tray.setAttribute("role", "group");
    tray.setAttribute("aria-label", "Items to Sort");
    const bucketRow = make("div", "story-buckets");
    wrap.append(tray, bucketRow);
    frameRef.body.append(wrap);

    const status = make("p", "story-sort-status", "");
    status.setAttribute("aria-live", "polite");
    frameRef.body.append(status);

    const items = Array.isArray(scene.items) ? scene.items : [];
    const buckets = Array.isArray(scene.buckets) ? scene.buckets : [];

    /** @type {Map<string, HTMLElement>} */
    const dropZones = new Map();
    /** @type {HTMLButtonElement | null} */
    let selected = null;
    let placed = 0;
    let continueButton = /** @type {HTMLButtonElement | null} */ (null);

    /**
     * @param {HTMLButtonElement | null} button
     * @returns {void}
     */
    function select(button) {
      if (selected) {
        selected.classList.remove("story-sort-item-selected");
        selected.setAttribute("aria-pressed", "false");
      }
      selected = button;
      if (button) {
        button.classList.add("story-sort-item-selected");
        button.setAttribute("aria-pressed", "true");
        status.textContent = `Selected "${button.dataset.label ?? ""}". Now choose a group.`;
      }
    }

    /**
     * @param {string} itemId
     * @param {string} bucketId
     * @returns {void}
     */
    function place(itemId, bucketId) {
      const item = items.find((candidate) => candidate.id === itemId);
      const button = /** @type {HTMLButtonElement | null} */ (
        tray.querySelector(`[data-item-id="${itemId}"]`) ??
          wrap.querySelector(`[data-item-id="${itemId}"]`)
      );
      if (!item || !button || button.disabled) {
        return;
      }
      const zone = dropZones.get(bucketId);
      if (!zone) {
        return;
      }
      if (item.bucket !== bucketId) {
        button.classList.add("story-sort-item-wrong");
        frameRef.say(
          item.explain ? `Not that group. ${item.explain}` : "Not that group, try again.",
          "bad",
        );
        status.textContent = `"${item.label}" belongs in another group.`;
        later(() => button.classList.remove("story-sort-item-wrong"), 600);
        select(null);
        button.focus({ preventScroll: true });
        return;
      }

      button.classList.remove("story-sort-item-selected");
      button.classList.add("story-sort-item-placed");
      button.setAttribute("aria-pressed", "false");
      button.disabled = true;
      button.draggable = false;
      zone.append(button);
      placed += 1;
      selected = null;
      frameRef.say(item.explain ?? "Correct.", "good");
      status.textContent = `${placed} of ${items.length} sorted.`;
      if (placed >= items.length && continueButton) {
        continueButton.disabled = false;
        continueButton.focus({ preventScroll: true });
      }
    }

    items.forEach((item) => {
      const button = makeButton("story-sort-item", item.label);
      button.dataset.itemId = item.id;
      button.dataset.label = item.label;
      button.draggable = true;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        if (button.disabled) {
          return;
        }
        select(selected === button ? null : button);
      });
      button.addEventListener("dragstart", (event) => {
        const drag = /** @type {DragEvent} */ (event);
        if (drag.dataTransfer) {
          drag.dataTransfer.setData("text/plain", item.id);
          drag.dataTransfer.effectAllowed = "move";
        }
        select(button);
      });
      tray.append(button);
    });

    buckets.forEach((bucket) => {
      const box = make("div", "story-bucket");
      const header = makeButton("story-bucket-button", "");
      header.append(make("span", "story-bucket-label", bucket.label));
      if (bucket.hint) {
        header.append(make("span", "story-bucket-hint", bucket.hint));
      }
      header.addEventListener("click", () => {
        if (!selected) {
          status.textContent = "Pick an item, then choose a group.";
          return;
        }
        place(selected.dataset.itemId ?? "", bucket.id);
      });

      const zone = make("div", "story-bucket-items");
      dropZones.set(bucket.id, zone);

      box.addEventListener("dragover", (event) => {
        event.preventDefault();
        box.classList.add("story-bucket-drop");
      });
      box.addEventListener("dragleave", () => {
        box.classList.remove("story-bucket-drop");
      });
      box.addEventListener("drop", (event) => {
        event.preventDefault();
        box.classList.remove("story-bucket-drop");
        const drag = /** @type {DragEvent} */ (event);
        const id = drag.dataTransfer ? drag.dataTransfer.getData("text/plain") : "";
        place(id || (selected ? selected.dataset.itemId ?? "" : ""), bucket.id);
      });

      box.append(header, zone);
      bucketRow.append(box);
    });

    frameRef.say("Pick an item, then choose a group. You can also drag items.", "info");
    continueButton = addContinue(
      frameRef,
      "Continue",
      () => {
        grantOnce(scene, { correct: true });
        goTo(scene.next);
      },
      items.length === 0,
    );

    return frameRef;
  }

  /* ---------------- 7. terminal ---------------- */

  /**
   * @param {Scene} scene
   * @returns {SceneFrame}
   */
  function renderTerminal(scene) {
    const frameRef = makeSceneFrame(scene, scene.title ?? "ORACLE terminal");
    if (scene.prompt) {
      frameRef.body.append(make("p", "story-prompt", scene.prompt));
    }

    const host = scene.host ?? "analyst@techinance-soc";
    const terminal = make("div", "story-terminal");
    const bar = make("div", "story-terminal-bar");
    const dots = make("span", "story-terminal-dots");
    dots.setAttribute("aria-hidden", "true");
    dots.append(
      make("span", "story-terminal-dot"),
      make("span", "story-terminal-dot"),
      make("span", "story-terminal-dot"),
    );
    bar.append(dots, make("span", "story-terminal-host", host));
    const screen = make("div", "story-terminal-screen");
    screen.setAttribute("role", "log");
    screen.setAttribute("aria-live", "polite");
    screen.setAttribute("tabindex", "0");
    screen.setAttribute("aria-label", "Terminal output");
    const cursor = make("span", "story-terminal-cursor", "█");
    cursor.setAttribute("aria-hidden", "true");
    terminal.append(bar, screen);

    const commandRow = make("div", "story-commands");
    commandRow.setAttribute("role", "group");
    commandRow.setAttribute("aria-label", "Available Commands");
    frameRef.body.append(terminal, commandRow);

    const commands = Array.isArray(scene.commands) ? scene.commands : [];
    const required = commands.filter((command) => command.required === true);
    /** @type {Set<string>} */
    const ran = new Set();
    /** @type {HTMLButtonElement[]} */
    const commandButtons = [];
    let busy = false;
    let continueButton = /** @type {HTMLButtonElement | null} */ (null);

    /**
     * @returns {void}
     */
    function refresh() {
      const done = required.filter((command) => ran.has(command.id)).length;
      if (continueButton) {
        continueButton.disabled = done < required.length;
      }
    }

    /**
     * @param {boolean} value
     * @returns {void}
     */
    function setBusy(value) {
      busy = value;
      commandRow.classList.toggle("story-commands-busy", value);
      commandButtons.forEach((button, index) => {
        // A command that has already run stays spent, so clearing `busy` must not
        // hand it back, or the console reads as if nothing was ever executed.
        button.disabled = value || ran.has(commands[index].id);
      });
    }

    /**
     * @param {HTMLElement} node
     * @param {string} text
     * @param {() => void} done
     * @returns {void}
     */
    function typeInto(node, text, done) {
      if (prefersReducedMotion() || text.length === 0) {
        node.textContent = text;
        screen.scrollTop = screen.scrollHeight;
        later(done, 40);
        return;
      }
      const step = Math.max(1, Math.ceil(text.length / 30));
      let index = 0;

      /**
       * @returns {void}
       */
      function tick() {
        index = Math.min(text.length, index + step);
        node.textContent = text.slice(0, index);
        screen.scrollTop = screen.scrollHeight;
        if (index < text.length) {
          later(tick, TYPE_SPEED_MS);
        } else {
          done();
        }
      }

      tick();
    }

    /**
     * @param {StoryCommand} command
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    function run(command, button) {
      if (busy) {
        return;
      }
      setBusy(true);
      cursor.remove();

      const line = make("p", "story-terminal-line story-terminal-cmd");
      const promptSpan = make("span", "story-terminal-prompt", `${host}:~$ `);
      const cmdText = make("span", "story-terminal-cmd-text", "");
      line.append(promptSpan, cmdText);
      screen.append(line);

      const outputs = asStringList(command.output);
      let outputIndex = 0;

      /**
       * @returns {void}
       */
      function nextOutput() {
        if (outputIndex >= outputs.length) {
          screen.append(cursor);
          screen.scrollTop = screen.scrollHeight;
          setBusy(false);
          ran.add(command.id);
          button.classList.add("story-command-run");
          button.disabled = true;
          refresh();
          if (continueButton && !continueButton.disabled) {
            frameRef.say("All required commands have run. You can continue.", "good");
          }
          return;
        }
        const text = outputs[outputIndex];
        outputIndex += 1;
        const outLine = make("p", "story-terminal-line story-terminal-out", "");
        screen.append(outLine);
        typeInto(outLine, text, () => later(nextOutput, 90));
      }

      typeInto(cmdText, command.cmd, () => later(nextOutput, 140));
    }

    commands.forEach((command) => {
      const button = makeButton("story-command", "");
      button.append(make("span", "story-command-text", command.cmd));
      if (command.required === true) {
        button.classList.add("story-command-required");
        button.append(make("span", "story-command-flag", "required"));
      }
      button.addEventListener("click", () => run(command, button));
      commandButtons.push(button);
      commandRow.append(button);
    });

    screen.append(cursor);
    frameRef.say(
      required.length > 0
        ? `Run the ${required.length} required command${required.length === 1 ? "" : "s"} to continue.`
        : "Run any command, or continue when you're ready.",
      "info",
    );

    continueButton = addContinue(
      frameRef,
      "Continue",
      () => {
        grantOnce(scene, { correct: true });
        goTo(scene.next);
      },
      required.length === 0,
    );
    refresh();

    return frameRef;
  }

  /* ---------------- 8. dossier ---------------- */

  /**
   * @param {Scene} scene
   * @returns {SceneFrame}
   */
  function renderDossier(scene) {
    const frameRef = makeSceneFrame(scene, scene.title ?? "Field Dossier");
    const cards = make("div", "story-cards");
    frameRef.body.append(cards);

    const terms = Array.isArray(scene.terms) ? scene.terms : [];

    terms.forEach((term) => {
      const card = makeButton("story-card", "");
      card.setAttribute("aria-expanded", "false");
      const inner = make("span", "story-card-inner");
      const front = make("span", "story-card-face story-card-front");
      front.append(
        make("span", "story-card-term", term.term),
        make("span", "story-card-hint", "Tap to reveal"),
      );
      const back = make("span", "story-card-face story-card-back");
      back.append(make("span", "story-card-def", term.definition));
      inner.append(front, back);
      card.append(inner);

      card.addEventListener("click", () => {
        const isFlipped = card.classList.toggle("story-card-flipped");
        card.setAttribute("aria-expanded", String(isFlipped));
        if (isFlipped) {
          frameRef.say(`${term.term}: ${term.definition}`, "info");
        }
      });

      cards.append(card);
    });

    frameRef.say("Flip each card to read the definition.", "info");

    addContinue(frameRef, "Continue", () => {
      grantOnce(scene, { correct: true });
      goTo(scene.next);
    });

    return frameRef;
  }

  /* ---------------- 9. ending ---------------- */

  /**
   * @param {Scene} scene
   * @returns {SceneFrame}
   */
  function renderEnding(scene) {
    grantOnce(scene, { correct: true });
    completeEpisode(userId, episodeId);
    updateHud(scene.id);

    // Automatically trigger certificate generation & email dispatch if course completed
    import("./certificate-generator.js").then((certMod) => {
      certMod.handleAutoCertificateOnCompletion(userId, episodeId);
    }).catch(() => {
      // The certificate offer is a bonus on top of finishing; if the module
      // fails to load, the ending still renders.
    });

    const frameRef = makeSceneFrame(scene, scene.title ?? "Episode Complete");
    frameRef.section.classList.add("story-ending");

    const crest = make("p", "story-ending-crest");
    crest.setAttribute("aria-hidden", "true");
    crest.append(icon("medal", { size: 54 }));
    frameRef.body.append(crest);

    const summary = make("div", "story-ending-summary");
    const xpStat = make("div", "story-ending-stat");
    xpStat.append(
      make("span", "story-ending-stat-value", String(episodeXp())),
      make("span", "story-ending-stat-label", "XP earned this episode"),
    );
    const totalStat = make("div", "story-ending-stat");
    totalStat.append(
      make("span", "story-ending-stat-value", String(asNumber(readProgress().xp))),
      make("span", "story-ending-stat-label", "XP total"),
    );
    summary.append(xpStat, totalStat);
    frameRef.body.append(summary);

    const earned = earnedBadgeIds();
    const badges = (episode?.badges ?? []).filter((badge) => earned.includes(badge.id));
    const badgeBox = make("div", "story-ending-badges");
    if (badges.length > 0) {
      badges.forEach((badge) => {
        const item = make("div", "story-ending-badge");
        const badgeIcon = make("span", "story-ending-badge-icon");
        badgeIcon.append(icon(badge.icon ?? "award", { size: 30 }));
        item.append(
          badgeIcon,
          make("span", "story-ending-badge-name", badge.name ?? badge.id),
          make("span", "story-ending-badge-desc", badge.description ?? ""),
        );
        badgeBox.append(item);
      });
    } else {
      badgeBox.append(
        make("p", "story-ending-badge-empty", "No badges this time. Replay the episode to earn them."),
      );
    }
    frameRef.body.append(badgeBox);

    if (scene.teaser) {
      const teaser = make("div", "story-ending-teaser");
      teaser.append(
        make("p", "story-ending-teaser-label", "Next Up"),
        make("p", "story-ending-teaser-text", scene.teaser),
      );
      frameRef.body.append(teaser);
    }

    const actions = make("div", "story-ending-actions");

    // Only show Claim Certificate button if user has completed 100% of all units in this course
    import("./certificate-generator.js").then((certMod) => {
      const info = certMod.checkCourseCompletion(userId, episodeId);
      if (info && info.isCourseCompleted) {
        const certBtn = makeButton("story-button story-button-primary", "🎓 Claim Certificate");
        certBtn.addEventListener("click", () => {
          certMod.showCertificateModal({
            studentName: user?.name || "Learner",
            courseId: info.courseId,
            courseTitle: info.courseTitle,
          });
        });
        actions.prepend(certBtn);
      }
    });

    const back = makeButton("story-button story-button-secondary", "Back to my learning");
    back.addEventListener("click", () => {
      clearPending();
      exit();
    });
    const replay = makeButton("story-button story-button-secondary", "Replay episode");
    replay.addEventListener("click", () => {
      resetEpisode(userId, episodeId);
      updateHud(episode.startScene);
      goTo(episode.startScene);
    });
    actions.append(back, replay);
    frameRef.foot.append(actions);

    return frameRef;
  }

  /* ---------------- resume gate ---------------- */

  /**
   * @returns {string | null}
   */
  function readCheckpoint() {
    try {
      return getCheckpoint(userId, episodeId);
    } catch {
      return null;
    }
  }

  /**
   * @returns {void}
   */
  function start() {
    if (!episode || !episode.scenes || !episode.startScene) {
      updateHud("");
      renderError("This episode couldn't load.");
      return;
    }

    const checkpoint = readCheckpoint();
    const resumable =
      typeof checkpoint === "string" &&
      checkpoint !== "" &&
      checkpoint !== episode.startScene &&
      Boolean(asRecord(episode.scenes)[checkpoint]);

    if (!resumable) {
      updateHud(episode.startScene);
      goTo(episode.startScene);
      return;
    }

    const target = /** @type {string} */ (checkpoint);
    updateHud(target);

    const panel = make("section", "story-resume");
    const title = make("h2", "story-resume-title", "Episode in Progress");
    title.tabIndex = -1;
    const who = user && user.name ? `, ${user.name}` : "";
    panel.append(
      title,
      make(
        "p",
        "story-resume-text",
        `You've already started this episode${who}. Resume from where you stopped, or start over from the beginning.`,
      ),
    );
    const actions = make("div", "story-resume-actions");
    const resume = makeButton("story-button story-button-primary", "Resume");
    resume.addEventListener("click", () => goTo(target));
    const restart = makeButton("story-button story-button-secondary", "Start over");
    restart.addEventListener("click", () => {
      resetEpisode(userId, episodeId);
      updateHud(episode.startScene);
      goTo(episode.startScene);
    });
    actions.append(resume, restart);
    panel.append(actions);
    stage.replaceChildren(panel);
    title.focus({ preventScroll: true });
    firstRender = false;
  }

  start();
}
