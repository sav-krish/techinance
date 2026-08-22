// @ts-check

import {
  calculateLockupLayout,
  countUpValue,
  formatStatValue,
  parseStatValue,
} from "./animation-math.js";

const HERO_TIMING = {
  openingBeat: 450,
  firstHop: 430,
  secondHop: 560,
  anticipation: 150,
  launch: 900,
  reveal: 520,
};
/** Fallback size only; live position sits flush against the stem top. */
const I_DOT_SIZE_EM = 0.036;
const I_DOT_SIZE_SCALE = 0.36;
/**
 * Finds the optical center/size of the i-dot, parked just above the live ı stem.
 *
 * @param {number} fontSize
 * @param {string} font
 * @param {DOMRect} iRect
 * @returns {{x: number, y: number, size: number}}
 */
function measureITittleInIBox(fontSize, font, iRect) {
  const canvas = document.createElement("canvas");
  const maybeContext = canvas.getContext("2d", { willReadFrequently: true });
  const fallbackSize = fontSize * I_DOT_SIZE_EM;
  if (!maybeContext) {
    return { x: iRect.width / 2, y: fontSize * 0.12, size: fallbackSize };
  }
  const context = maybeContext;

  const pad = Math.ceil(fontSize);
  canvas.width = Math.ceil(fontSize * 2) + pad * 2;
  canvas.height = Math.ceil(fontSize * 2) + pad * 2;
  context.font = font;
  context.textBaseline = "alphabetic";
  context.fillStyle = "#000";
  const canvasBaseline = pad + fontSize;

  /**
   * @param {string} glyph
   * @returns {Uint8ClampedArray}
   */
  function rasterize(glyph) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillText(glyph, pad, canvasBaseline);
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  }

  const dottedData = rasterize("i");
  const dotlessData = rasterize("ı");
  const metrics = context.measureText("ı");

  /** @type {number[]} */
  const tittleXs = [];
  /** @type {number[]} */
  const tittleYs = [];
  let stemTop = canvas.height;
  let stemLeft = canvas.width;
  let stemRight = 0;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4 + 3;
      const dottedAlpha = dottedData[index] ?? 0;
      const dotlessAlpha = dotlessData[index] ?? 0;
      if (dottedAlpha > 30 && dotlessAlpha < 20) {
        tittleXs.push(x);
        tittleYs.push(y);
      }
      if (dotlessAlpha > 30) {
        stemTop = Math.min(stemTop, y);
        stemLeft = Math.min(stemLeft, x);
        stemRight = Math.max(stemRight, x);
      }
    }
  }

  if (stemRight <= stemLeft) {
    return { x: iRect.width / 2, y: fontSize * 0.12, size: fallbackSize };
  }

  /**
   * @param {number[]} values
   * @returns {number}
   */
  const avg = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const stemWidth = stemRight - stemLeft;
  const stemCenterX = (stemLeft + stemRight) / 2;
  const tittleSize =
    tittleXs.length > 0
      ? Math.max(
          Math.max(...tittleXs) - Math.min(...tittleXs),
          Math.max(...tittleYs) - Math.min(...tittleYs),
        )
      : fallbackSize;
  const centerXCanvas = tittleXs.length > 0 ? avg(tittleXs) : stemCenterX;

  const textNode = [...dotlessI.childNodes].find(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").includes("ı"),
  );

  // Probe the live baseline, then step up by the glyph's actual stem ascent.
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "display:inline-block;width:0;height:0;overflow:hidden;vertical-align:baseline;";
  if (textNode) {
    dotlessI.insertBefore(probe, textNode);
  } else {
    dotlessI.insertBefore(probe, dotlessI.firstChild);
  }
  const baselineY = probe.getBoundingClientRect().top;
  probe.remove();

  const range = document.createRange();
  if (textNode) {
    range.selectNodeContents(textNode);
  } else {
    range.selectNodeContents(dotlessI);
  }
  const glyphRect = range.getBoundingClientRect();
  const scale = stemWidth > 0 ? glyphRect.width / stemWidth : 1;
  const size = Math.max(tittleSize * scale * I_DOT_SIZE_SCALE, fallbackSize * 0.85);

  const stemAscent =
    metrics.actualBoundingBoxAscent > 0
      ? metrics.actualBoundingBoxAscent
      : canvasBaseline - stemTop;
  const stemTopY = baselineY - iRect.top - stemAscent;
  // Park the dot above the stem with a clear breathing gap.
  const y = stemTopY - size / 2 - Math.max(4, fontSize * 0.07);

  return {
    x: glyphRect.left - iRect.left + (centerXCanvas - stemLeft) * scale,
    y,
    size,
  };
}

/**
 * @param {string} selector
 * @returns {HTMLElement}
 */
function getHtmlElement(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

/**
 * @param {string} selector
 * @returns {HTMLButtonElement}
 */
function getButtonElement(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing required button: ${selector}`);
  }
  return element;
}

const stage = getHtmlElement("[data-stage]");
const lockup = getHtmlElement("[data-lockup]");
const wordmark = getHtmlElement("[data-wordmark]");
const dotlessI = getHtmlElement("[data-i]");
const iDot = getHtmlElement("[data-i-dot]");
const logoSlot = getHtmlElement("[data-logo-slot]");
const flyer = getHtmlElement("[data-flyer]");
const flyerDot = getHtmlElement("[data-flyer-dot]");
const flyerLogo = getHtmlElement("[data-flyer-logo]");
const heroLogo = getButtonElement("[data-hero-logo]");
const heroContent = getHtmlElement("[data-hero-content]");
const stats = getHtmlElement("[data-stats]");
const header = getHtmlElement("[data-header]");

/** @typedef {{fontSize: number, logoSize: number, gap: number, dotScale: number, startX: number, startY: number, targetX: number, targetY: number, wordLeft: number, wordTop: number, finalLeft: number}} HeroGeometry */

/** @type {Animation[]} */
let activeAnimations = [];
let animationRun = 0;
let isAnimating = false;
let resizeTimer = 0;

/**
 * @param {number} x
 * @param {number} y
 * @param {number} scaleX
 * @param {number} scaleY
 * @param {number} rotation
 * @returns {string}
 */
function logoTransform(x, y, scaleX, scaleY, rotation) {
  return `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`;
}

/**
 * @param {Element} element
 * @param {Keyframe[]} keyframes
 * @param {KeyframeAnimationOptions} options
 * @returns {Promise<void>}
 */
async function animate(element, keyframes, options) {
  const animation = element.animate(keyframes, {
    fill: "forwards",
    ...options,
  });
  activeAnimations.push(animation);

  try {
    await animation.finished;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }
  }
}

/**
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

/**
 * @returns {HeroGeometry}
 */
function measureHero() {
  const stageRect = stage.getBoundingClientRect();
  const wordRect = wordmark.getBoundingClientRect();
  const iRect = dotlessI.getBoundingClientRect();
  const wordStyle = getComputedStyle(wordmark);
  const fontSize = Number.parseFloat(wordStyle.fontSize);
  const logoSize = fontSize * 0.58;
  const gap = fontSize * 0.18;
  const font = `${wordStyle.fontWeight} ${fontSize}px ${wordStyle.fontFamily}`;
  const tittle = measureITittleInIBox(fontSize, font, iRect);
  const layout = calculateLockupLayout({
    heroLeft: 0,
    heroWidth: stageRect.width,
    wordmarkWidth: wordRect.width,
    logoSize,
    gap,
  });

  document.documentElement.style.setProperty("--logo-size", `${logoSize}px`);
  document.documentElement.style.setProperty("--lockup-gap", `${gap}px`);
  iDot.style.left = `${tittle.x}px`;
  iDot.style.top = `${tittle.y}px`;
  iDot.style.width = `${tittle.size}px`;
  iDot.style.height = `${tittle.size}px`;

  const wordLeft = (stageRect.width - wordRect.width) / 2;
  const wordTop = (stageRect.height - wordRect.height) / 2;
  const iOffsetLeft = iRect.left - wordRect.left;
  const iOffsetTop = iRect.top - wordRect.top;

  return {
    fontSize,
    logoSize,
    gap,
    dotScale: tittle.size / logoSize,
    startX: wordLeft + iOffsetLeft + tittle.x,
    startY: wordTop + iOffsetTop + tittle.y,
    targetX: layout.logoCenterX,
    targetY: stageRect.height / 2,
    wordLeft,
    wordTop,
    finalLeft: layout.lockupLeft,
  };
}

/**
 * @param {HeroGeometry} geometry
 * @returns {void}
 */
function setIntroState(geometry) {
  document.documentElement.classList.add("is-loading");
  logoSlot.style.width = "0px";
  lockup.style.columnGap = "0px";
  lockup.style.left = `${geometry.wordLeft}px`;
  lockup.style.top = `${geometry.wordTop}px`;
  lockup.style.transform = "none";
  wordmark.style.transform = "none";
  iDot.style.transform = "translate(-50%, -50%) scale(0)";
  flyerDot.style.opacity = "1";
  flyerLogo.style.opacity = "0";
  flyer.style.display = "block";
  flyer.style.transform = logoTransform(
    geometry.startX - geometry.logoSize / 2,
    geometry.startY - geometry.logoSize / 2,
    geometry.dotScale,
    geometry.dotScale,
    0,
  );
  flyer.style.visibility = "visible";
  flyer.style.opacity = "1";
  heroLogo.style.opacity = "0";
  heroLogo.disabled = true;
  header.style.visibility = "hidden";
  heroContent.style.visibility = "hidden";
  stats.style.visibility = "hidden";
}

/**
 * @param {HeroGeometry} geometry
 * @returns {void}
 */
function setFinalState(geometry) {
  logoSlot.style.width = `${geometry.logoSize}px`;
  lockup.style.columnGap = `${geometry.gap}px`;
  lockup.style.left = `${geometry.finalLeft}px`;
  lockup.style.top = `${geometry.wordTop}px`;
  lockup.style.transform = "none";
  wordmark.style.transform = "none";
  iDot.style.transform = "translate(-50%, -50%) scale(1)";
  flyerDot.style.opacity = "0";
  flyerLogo.style.opacity = "1";
  flyer.style.display = "none";
  heroLogo.style.opacity = "1";
  heroLogo.disabled = false;
  header.style.removeProperty("visibility");
  header.style.removeProperty("transform");
  heroContent.style.removeProperty("visibility");
  heroContent.style.removeProperty("opacity");
  heroContent.style.removeProperty("transform");
  stats.style.removeProperty("visibility");
  stats.style.removeProperty("opacity");
  stats.style.removeProperty("transform");
  document.documentElement.classList.remove("is-loading");
}

/**
 * @param {HeroGeometry} geometry
 * @returns {Promise<void>}
 */
async function animateHops(geometry) {
  const baseX = geometry.startX - geometry.logoSize / 2;
  const baseY = geometry.startY - geometry.logoSize / 2;
  const scale = geometry.dotScale;

  await animate(
    flyer,
    [
      { offset: 0, transform: logoTransform(baseX, baseY, scale, scale, 0) },
      { offset: 0.12, transform: logoTransform(baseX, baseY, scale * 1.14, scale * 0.82, 0) },
      { offset: 0.48, transform: logoTransform(baseX, baseY - geometry.fontSize * 0.29, scale * 0.86, scale * 1.18, -2) },
      { offset: 0.7, transform: logoTransform(baseX, baseY - geometry.fontSize * 0.33, scale, scale, 1) },
      { offset: 0.9, transform: logoTransform(baseX, baseY, scale * 1.27, scale * 0.72, 0) },
      { offset: 1, transform: logoTransform(baseX, baseY, scale, scale, 0) },
    ],
    { duration: HERO_TIMING.firstHop, easing: "linear" },
  );

  await Promise.all([
    animate(
      flyer,
      [
        { offset: 0, transform: logoTransform(baseX, baseY, scale, scale, 0) },
        { offset: 0.1, transform: logoTransform(baseX, baseY, scale * 1.16, scale * 0.8, 0) },
        { offset: 0.46, transform: logoTransform(baseX, baseY - geometry.fontSize * 0.46, scale * 0.82, scale * 1.22, 3) },
        { offset: 0.67, transform: logoTransform(baseX, baseY - geometry.fontSize * 0.5, scale, scale, -1) },
        { offset: 0.88, transform: logoTransform(baseX, baseY, scale * 1.36, scale * 0.64, 0) },
        { offset: 1, transform: logoTransform(baseX, baseY, scale, scale, 0) },
      ],
      { duration: HERO_TIMING.secondHop, easing: "linear" },
    ),
    animate(
      wordmark,
      [
        { offset: 0, transform: "translateY(0)" },
        { offset: 0.82, transform: "translateY(0)" },
        { offset: 0.9, transform: "translateY(4px) scaleY(0.985)" },
        { offset: 1, transform: "translateY(0)" },
      ],
      { duration: HERO_TIMING.secondHop, easing: "ease-out" },
    ),
  ]);
}

/**
 * @param {HeroGeometry} geometry
 * @returns {Promise<void>}
 */
async function animateLaunch(geometry) {
  const baseX = geometry.startX - geometry.logoSize / 2;
  const baseY = geometry.startY - geometry.logoSize / 2;
  const targetX = geometry.targetX - geometry.logoSize / 2;
  const targetY = geometry.targetY - geometry.logoSize / 2;
  const scale = geometry.dotScale;
  const arcX = Math.min(baseX, targetX) - geometry.fontSize * 0.2;
  const arcY = Math.min(baseY, targetY) - geometry.fontSize * 1.1;

  await animate(
    flyer,
    [
      { transform: logoTransform(baseX, baseY, scale, scale, 0) },
      { transform: logoTransform(baseX, baseY + geometry.fontSize * 0.025, scale * 1.34, scale * 0.66, -1) },
    ],
    { duration: HERO_TIMING.anticipation, easing: "cubic-bezier(0.55, 0, 0.8, 0.35)" },
  );

  await Promise.all([
    animate(
      iDot,
      [
        { offset: 0, transform: "translate(-50%, -50%) scale(0)" },
        { offset: 0.28, transform: "translate(-50%, -50%) scale(0)" },
        { offset: 0.62, transform: "translate(-50%, -50%) scale(1.28)" },
        { offset: 0.82, transform: "translate(-50%, -50%) scale(0.9)" },
        { offset: 1, transform: "translate(-50%, -50%) scale(1)" },
      ],
      { duration: HERO_TIMING.launch, easing: "linear" },
    ),
    animate(
      flyerDot,
      [
        { offset: 0, opacity: 1 },
        { offset: 0.22, opacity: 1 },
        { offset: 0.5, opacity: 0 },
        { offset: 1, opacity: 0 },
      ],
      { duration: HERO_TIMING.launch, easing: "linear" },
    ),
    animate(
      flyerLogo,
      [
        { offset: 0, opacity: 0 },
        { offset: 0.22, opacity: 0 },
        { offset: 0.5, opacity: 1 },
        { offset: 1, opacity: 1 },
      ],
      { duration: HERO_TIMING.launch, easing: "linear" },
    ),
    animate(
      flyer,
      [
        { offset: 0, transform: logoTransform(baseX, baseY, scale * 1.34, scale * 0.66, -1) },
        { offset: 0.34, transform: logoTransform(arcX, arcY, 0.46, 0.62, -8) },
        { offset: 0.66, transform: logoTransform(targetX - geometry.fontSize * 0.13, targetY - geometry.fontSize * 0.62, 0.84, 0.98, 5) },
        { offset: 0.84, transform: logoTransform(targetX, targetY, 1.16, 0.78, 0) },
        { offset: 0.93, transform: logoTransform(targetX, targetY - geometry.fontSize * 0.035, 0.96, 1.06, 0) },
        { offset: 1, transform: logoTransform(targetX, targetY, 1, 1, 0) },
      ],
      { duration: HERO_TIMING.launch, easing: "linear" },
    ),
    animate(
      logoSlot,
      [{ width: "0px" }, { width: `${geometry.logoSize}px` }],
      {
        duration: HERO_TIMING.launch * 0.74,
        delay: HERO_TIMING.launch * 0.12,
        easing: "cubic-bezier(0.34, 1.45, 0.5, 1)",
      },
    ),
    animate(
      lockup,
      [
        { left: `${geometry.wordLeft}px`, columnGap: "0px" },
        { left: `${geometry.finalLeft - geometry.fontSize * 0.018}px`, columnGap: `${geometry.gap * 1.06}px`, offset: 0.84 },
        { left: `${geometry.finalLeft}px`, columnGap: `${geometry.gap}px` },
      ],
      {
        duration: HERO_TIMING.launch * 0.76,
        delay: HERO_TIMING.launch * 0.1,
        easing: "cubic-bezier(0.34, 1.45, 0.5, 1)",
      },
    ),
    animate(
      wordmark,
      [
        { offset: 0, transform: "rotate(0deg)" },
        { offset: 0.32, transform: "rotate(0deg)" },
        { offset: 0.55, transform: "rotate(0.7deg)" },
        { offset: 0.78, transform: "rotate(-0.4deg)" },
        { offset: 1, transform: "rotate(0deg)" },
      ],
      { duration: HERO_TIMING.launch, easing: "ease-out" },
    ),
  ]);
}

/**
 * @returns {Promise<void>}
 */
async function revealPage() {
  header.style.visibility = "visible";
  header.style.transform = "translateY(-100%)";
  heroContent.style.visibility = "visible";
  heroContent.style.opacity = "0";
  heroContent.style.transform = "translateY(18px)";
  stats.style.visibility = "visible";
  stats.style.opacity = "0";
  stats.style.transform = "translateY(18px)";
  document.documentElement.classList.remove("is-loading");

  // Counting runs alongside the fade-up, not after it, so there is no pause
  // between the hero landing and the numbers moving.
  startCounters();

  await Promise.all([
    animate(
      header,
      [{ transform: "translateY(-100%)" }, { transform: "translateY(0)" }],
      { duration: HERO_TIMING.reveal, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    ),
    animate(
      heroContent,
      [
        { opacity: 0, transform: "translateY(18px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: HERO_TIMING.reveal,
        delay: 90,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    ),
    animate(
      stats,
      [
        { opacity: 0, transform: "translateY(18px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: HERO_TIMING.reveal,
        delay: 160,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    ),
  ]);
}

/**
 * @returns {Promise<void>}
 */
async function playIntro() {
  animationRun += 1;
  const run = animationRun;
  isAnimating = true;
  // Replaying the intro re-reveals the stats row, so the counters should run
  // with it rather than sliding back in already finished.
  countersStarted = false;
  activeAnimations.forEach((animation) => animation.cancel());
  activeAnimations = [];
  const geometry = measureHero();
  setIntroState(geometry);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setFinalState(geometry);
    isAnimating = false;
    return;
  }

  // Zero the stats now, while the row is still hidden, so it fades in already
  // counting rather than showing the finished figures first.
  primeCounters();

  await wait(HERO_TIMING.openingBeat);
  if (run !== animationRun) return;
  await animateHops(geometry);
  if (run !== animationRun) return;
  await animateLaunch(geometry);
  if (run !== animationRun) return;

  logoSlot.style.width = `${geometry.logoSize}px`;
  lockup.style.left = `${geometry.finalLeft}px`;
  lockup.style.columnGap = `${geometry.gap}px`;
  flyer.style.display = "none";
  heroLogo.style.opacity = "1";
  heroLogo.disabled = false;
  await revealPage();
  isAnimating = false;
}

/* ------------------------------------------------------------------ *
 * Stat counters
 * ------------------------------------------------------------------ */

const COUNTER_DURATION = 1500;
const COUNTER_STAGGER = 110;

let countersStarted = false;

/**
 * @returns {HTMLElement[]}
 */
function statValues() {
  return /** @type {HTMLElement[]} */ ([...stats.querySelectorAll(".stats__value")]);
}

/**
 * Reads the authored figure, capturing it on the element the first time so a
 * replay cannot mistake a half-counted value for the target.
 *
 * @param {HTMLElement} element
 * @returns {ReturnType<typeof parseStatValue>}
 */
function statShape(element) {
  if (element.dataset.statTarget === undefined) {
    element.dataset.statTarget = element.textContent ?? "";
  }
  return parseStatValue(element.dataset.statTarget);
}

/**
 * Zeroes the counters while the stats row is still hidden.
 *
 * Without this the row fades in showing the finished figures and only then
 * snaps back to zero to count, which reads as the animation starting late.
 * Priming first means the numbers are already at zero the moment they appear.
 *
 * @returns {void}
 */
function primeCounters() {
  for (const element of statValues()) {
    const shape = statShape(element);
    if (!shape) {
      continue;
    }
    // Measured while the final figure is still rendered, so the locked width is
    // the widest the label will ever be.
    element.style.minWidth = `${element.getBoundingClientRect().width}px`;
    element.textContent = formatStatValue(0, shape);
  }
}

/**
 * Counts one stat up to the figure authored in the markup.
 *
 * @param {HTMLElement} element
 * @param {number} delay
 * @returns {void}
 */
function runCounter(element, delay) {
  const shape = statShape(element);
  if (!shape) {
    return;
  }

  // Bound after the null guard so the animation frame below, which is hoisted,
  // still sees a non-null shape.
  const stat = shape;
  const final = formatStatValue(stat.value, stat);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.textContent = final;
    element.style.removeProperty("min-width");
    return;
  }

  const start = performance.now() + delay;

  /**
   * @param {number} now
   * @returns {void}
   */
  function frame(now) {
    const elapsed = now - start;
    if (elapsed < 0) {
      requestAnimationFrame(frame);
      return;
    }

    const progress = Math.min(elapsed / COUNTER_DURATION, 1);
    element.textContent = formatStatValue(countUpValue(stat.value, progress), stat);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      element.textContent = final;
      element.style.removeProperty("min-width");
    }
  }

  requestAnimationFrame(frame);
}

/**
 * Runs the counters once, when the stats row is actually on screen.
 *
 * @returns {void}
 */
function startCounters() {
  if (countersStarted) {
    return;
  }
  countersStarted = true;

  const values = statValues();
  if (values.length === 0) {
    return;
  }

  const begin = () => {
    values.forEach((value, index) => runCounter(value, index * COUNTER_STAGGER));
  };

  if (typeof IntersectionObserver !== "function") {
    begin();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        begin();
      }
    },
    { threshold: 0.4 },
  );
  observer.observe(stats);
}

/* ------------------------------------------------------------------ *
 * Scroll story
 * ------------------------------------------------------------------ */

const scrollStory = document.querySelector("[data-scroll-story]");

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * @param {number} start
 * @param {number} end
 * @param {number} progress
 * @returns {number}
 */
function interpolate(start, end, progress) {
  return start + (end - start) * progress;
}

/**
 * Enables the sticky, scroll-driven home-page scene. The regular grid remains
 * visible when motion is reduced or JavaScript is unavailable.
 *
 * @returns {void}
 */
function setupScrollStory() {
  if (!(scrollStory instanceof HTMLElement)) {
    return;
  }
  if (
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !window.matchMedia("(min-width: 721px)").matches
  ) {
    return;
  }
  const story = scrollStory;

  let frame = 0;
  /** Cached end offset for the side cards, in px. Invalidated on resize. */
  let sideOffset = 0;
  /** Cached end drop for the bottom card. Invalidated on resize. */
  let drop = { offset: 0, scale: 1 };

  const PANEL_END_SCALE = 1.055;
  const CARD_END_ROTATION = 5;
  const NEURO_END_ROTATION = 2;

  /**
   * How far the two side cards travel from centre by the end of the scene.
   *
   * Derived from the measured widths rather than a fixed vw value: the panel is
   * `min(520px, 46vw)` and the cards `min(240px, 18vw)`, so their ratio changes
   * across breakpoints. A constant that clears the panel on a laptop either
   * overlaps it on a narrow window or flings the cards into the far corners on
   * a wide one.
   *
   * @returns {number}
   */
  function measureSideOffset() {
    const panel = story.querySelector(".scroll-story__panel");
    const card = story.querySelector(".scroll-story__orbit");
    if (!(panel instanceof HTMLElement) || !(card instanceof HTMLElement)) {
      return 0;
    }
    const radians = (CARD_END_ROTATION * Math.PI) / 180;
    const panelHalf = (panel.offsetWidth * PANEL_END_SCALE) / 2;
    // A rotated card covers more width than it measures.
    const cardHalf =
      (card.offsetWidth * Math.cos(radians) + card.offsetHeight * Math.sin(radians)) / 2;
    const gap = clamp(window.innerWidth * 0.03, 16, 56);
    // Never push a card past the viewport edge, even if that costs some gap.
    const room = window.innerWidth / 2 - cardHalf - 16;
    return Math.max(Math.min(panelHalf + cardHalf + gap, room), 0);
  }

  /**
   * Where the bottom card ends up, and how big it is when it gets there.
   *
   * Measured for the same reason as the side offset: the sticky scene is
   * 100svh, so a fixed vh value that leaves a decent margin on a tall window
   * runs the card into the bottom edge on a short one. This sits the card as
   * low as it can while keeping that margin, and the gap to the panel above is
   * whatever remains, which is the right trade when space runs short.
   *
   * @returns {{ offset: number, scale: number }}
   */
  function measureDrop() {
    const panel = story.querySelector(".scroll-story__panel");
    const card = story.querySelector(".scroll-story__orbit--neuroscience");
    const sticky = story.querySelector(".scroll-story__sticky");
    if (
      !(panel instanceof HTMLElement) ||
      !(card instanceof HTMLElement) ||
      !(sticky instanceof HTMLElement)
    ) {
      return { offset: 0, scale: 1 };
    }
    const scene = sticky.offsetHeight;
    const radians = (NEURO_END_ROTATION * Math.PI) / 180;
    // Rotated, so its height covers a little of its width too.
    const cardHeight =
      card.offsetHeight * Math.cos(radians) + card.offsetWidth * Math.sin(radians);
    // Where the panel's lower edge sits once it has grown and drifted upwards,
    // measured from the centre of the scene.
    const panelBottom = (panel.offsetHeight * PANEL_END_SCALE) / 2 - scene * 0.035;
    const gap = clamp(scene * 0.03, 16, 40);
    const margin = clamp(scene * 0.04, 20, 56);
    // Clearing the panel comes first. Whatever vertical room is left over after
    // that and the bottom margin is all the card gets, so on a short window it
    // shrinks rather than sliding back under the panel.
    const room = scene / 2 - margin - panelBottom - gap;
    const scale = clamp(room / cardHeight, 0.55, 1);
    // On a tall window there is room to spare. Splitting it evenly keeps the
    // card centred in its band instead of tucked under the panel.
    const spare = Math.max(room - cardHeight * scale, 0) / 2;
    return { offset: panelBottom + gap + spare + (cardHeight * scale) / 2, scale };
  }

  /**
   * @param {string} name
   * @param {number} x
   * @param {number} y
   * @param {number} rotation
   * @param {number} scale
   * @returns {void}
   */
  function setOrbit(name, x, y, rotation, scale) {
    story.style.setProperty(
      `--story-${name}-transform`,
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
    );
  }

  /**
   * @returns {void}
   */
  function update() {
    frame = 0;
    if (sideOffset === 0) {
      sideOffset = measureSideOffset();
      drop = measureDrop();
    }
    const viewport = window.innerHeight || 1;
    const bounds = story.getBoundingClientRect();
    const travel = Math.max(story.offsetHeight - viewport, 1);
    const progress = clamp(-bounds.top / travel, 0, 1);
    const eased = 1 - (1 - progress) ** 3;

    story.style.setProperty(
      "--story-panel-transform",
      `translate3d(0, ${interpolate(0, -3.5, eased).toFixed(2)}vh, 0) scale(${interpolate(1, 1.055, eased).toFixed(3)})`,
    );
    setOrbit(
      "tech",
      interpolate(0, -sideOffset, eased),
      interpolate(viewport * 0.14, viewport * -0.15, eased),
      interpolate(-3, -CARD_END_ROTATION, eased),
      interpolate(0.88, 1, eased),
    );
    setOrbit(
      "finance",
      interpolate(0, sideOffset, eased),
      interpolate(viewport * 0.14, viewport * -0.09, eased),
      interpolate(3, CARD_END_ROTATION, eased),
      interpolate(0.88, 1, eased),
    );
    setOrbit(
      "neuro",
      0,
      interpolate(viewport * 0.18, drop.offset, eased),
      interpolate(0, -NEURO_END_ROTATION, eased),
      interpolate(0.88 * drop.scale, drop.scale, eased),
    );
    story.style.setProperty("--story-tech-opacity", String(clamp(progress * 3.2, 0, 1)));
    story.style.setProperty("--story-finance-opacity", String(clamp((progress - 0.06) * 3.2, 0, 1)));
    story.style.setProperty("--story-neuro-opacity", String(clamp((progress - 0.12) * 3.2, 0, 1)));
  }

  /**
   * @returns {void}
   */
  function requestUpdate() {
    if (frame === 0) {
      frame = window.requestAnimationFrame(update);
    }
  }

  story.classList.add("scroll-story--enhanced");
  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", () => {
    sideOffset = 0;
    requestUpdate();
  });
}

setupScrollStory();

/* ------------------------------------------------------------------ *
 * Intro playback
 * ------------------------------------------------------------------ */

const INTRO_SEEN_KEY = "techinance.introSeen";

/**
 * The intro is a first-impression animation, so it plays once per visit. Moving
 * between pages reloads the document, which is why this needs storage rather
 * than a module-level flag. sessionStorage scopes it to the tab: navigate away
 * and back and it stays quiet, but a genuinely new visit gets it again.
 *
 * @returns {boolean}
 */
function shouldPlayIntro() {
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_KEY) !== "1";
  } catch {
    // Storage can be unavailable in private modes. Playing it is the safer
    // failure: an extra animation beats a broken-looking hero.
    return true;
  }
}

/**
 * @returns {void}
 */
function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Nothing to do. The intro simply plays again next navigation.
  }
}

heroLogo.addEventListener("click", () => {
  void playIntro();
});
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!isAnimating) setFinalState(measureHero());
  }, 120);
});

await document.fonts.ready;

if (shouldPlayIntro()) {
  markIntroSeen();
  await playIntro();
} else {
  // Returning to the home page mid-visit: no intro, and the stats stay on their
  // final figures rather than counting up again.
  setFinalState(measureHero());
}
