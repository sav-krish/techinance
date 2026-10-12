// @ts-check

import { slugifyBlogTitle } from "./blog-data.js";

/** @param {string} value */
function looksLikeSourceHeading(value) {
  const text = value.trim();
  if (!text || text.length > 90) {
    return false;
  }
  if (text.endsWith(":")) {
    return true;
  }
  const words = text
    .replace(/[?!.:]+$/g, "")
    .split(/\s+/)
    .map((word) => word.replace(/^[“"'([{]*|[,”"')\]}]+$/g, ""))
    .filter(Boolean);
  if (words.length < 2 || words.length > 12) {
    return false;
  }
  const connectors = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "vs", "with"]);
  return words.every((word) => connectors.has(word.toLowerCase()) || /^[A-Z0-9]/.test(word));
}

/** @param {string} value */
function endsSentence(value) {
  return /[.!?][”"')\]}]*$/.test(value.trim());
}

/**
 * Turns an article's plain text into semantic pieces for a page to render with
 * textContent. It deliberately does not parse or return HTML.
 *
 * @param {unknown} content
 * @returns {Array<{ type: "paragraph", text: string } | { type: "heading", level: number, text: string }>}
 */
export function toArticleBlocks(content) {
  if (typeof content !== "string") {
    return [];
  }
  const sections = content
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n[\t ]*\n+/)
    .map((section) => section.trim())
    .filter(Boolean);

  /** @type {Array<{ type: "paragraph", text: string } | { type: "heading", level: number, text: string }>} */
  const blocks = [];
  for (const section of sections) {
    /** @type {string[]} */
    let paragraph = [];
    const flushParagraph = () => {
      const text = paragraph.join(" ").trim();
      if (text) {
        blocks.push({ type: "paragraph", text });
      }
      paragraph = [];
    };
    for (const rawLine of section.split("\n")) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        continue;
      }
      const markdownHeading = /^(#{1,3})[\t ]+(.+)$/.exec(line);
      if (markdownHeading) {
        flushParagraph();
        const text = markdownHeading[2].trim();
        if (text) {
          blocks.push({ type: "heading", level: markdownHeading[1].length, text });
        }
        continue;
      }
      if (looksLikeSourceHeading(line)) {
        flushParagraph();
        blocks.push({ type: "heading", level: 2, text: line });
        continue;
      }
      if (paragraph.length && endsSentence(paragraph.at(-1) ?? "") && /^[A-Z0-9“"'([]/.test(line)) {
        flushParagraph();
      }
      paragraph.push(line);
    }
    flushParagraph();
  }
  return blocks;
}

/**
 * @template {{ slug?: unknown }} T
 * @param {T[] | null | undefined} posts
 * @param {unknown} requestedSlug
 * @returns {T | null}
 */
export function findBlogPost(posts, requestedSlug) {
  if (!Array.isArray(posts)) {
    return null;
  }
  const requested = slugifyBlogTitle(typeof requestedSlug === "string" ? requestedSlug : "");
  if (!requested) {
    return null;
  }
  return posts.find((post) => slugifyBlogTitle(String(post?.slug ?? "")) === requested) ?? null;
}
