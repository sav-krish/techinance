// @ts-check

import blogArchive from "./content/blog-archive.json" with { type: "json" };

/**
 * @typedef {object} BlogPost
 * @property {string} id
 * @property {string} slug
 * @property {string} title
 * @property {string} authorName
 * @property {string} authorRole
 * @property {string} content
 * @property {string} excerpt
 * @property {string} publishedAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} NormalizedBlogDraft
 * @property {string} title
 * @property {string} slug
 * @property {string} authorName
 * @property {string} authorRole
 * @property {string} body
 * @property {string} excerpt
 * @property {string} publishedAt
 */

/** @typedef {{ ok: true, value: NormalizedBlogDraft } | { ok: false, error: string }} BlogDraftResult */

/** @param {unknown} value */
function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** @param {string} value */
export function slugifyBlogTitle(value) {
  return asText(value)
    // A title is rendered as text, but its URL should describe its visible
    // words rather than markup someone may have typed around them.
    .replace(/<[^>]*>/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

/** @param {string} value */
function makeExcerpt(value) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= 220) {
    return compact;
  }
  return `${compact.slice(0, 217).trimEnd()}…`;
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function dateOnly(value, fallback) {
  const parsed = new Date(asText(value));
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed.toISOString().slice(0, 10);
}

/** @param {any} post */
function toBlogPost(post) {
  const title = asText(post?.title);
  const content = asText(post?.content ?? post?.body);
  const slug = slugifyBlogTitle(asText(post?.slug) || title);
  const publishedAt = dateOnly(post?.publishedAt ?? post?.published_at, "1970-01-01");
  return {
    id: asText(post?.id) || `seed-${slug}`,
    slug,
    title,
    authorName: asText(post?.authorName ?? post?.author_name),
    authorRole: asText(post?.authorRole ?? post?.author_role),
    content,
    excerpt: asText(post?.excerpt) || makeExcerpt(content),
    publishedAt,
    updatedAt: asText(post?.updatedAt ?? post?.updated_at) || `${publishedAt}T00:00:00.000Z`,
  };
}

/** @type {ReadonlyArray<BlogPost>} */
export const SEED_POSTS = Object.freeze(blogArchive.map(toBlogPost));

/**
 * Combines the shipped archive with published database rows. A live post wins
 * when it shares a slug with the archive, so admins can revise an imported post
 * without visitors seeing both copies.
 *
 * @param {unknown[]} remotePosts
 * @returns {BlogPost[]}
 */
export function mergeBlogPosts(remotePosts) {
  const bySlug = new Map();
  for (const seed of SEED_POSTS) {
    bySlug.set(seed.slug, seed);
  }
  for (const row of Array.isArray(remotePosts) ? remotePosts : []) {
    const post = toBlogPost(row);
    if (post.slug && post.title && post.content) {
      bySlug.set(post.slug, post);
    }
  }
  return Array.from(bySlug.values()).sort((a, b) => {
    // Modern Array#sort is stable, so a shared publication day retains the
    // editorial order supplied in the archive instead of being reshuffled by
    // its title.
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  });
}

/**
 * Validates a browser-submitted article. The page renders body text with
 * textContent, not innerHTML, so markup stays visible as text rather than
 * becoming executable content.
 *
 * @param {{ title?: unknown, authorName?: unknown, authorRole?: unknown, body?: unknown, publishedAt?: unknown }} draft
 * @returns {BlogDraftResult}
 */
export function normalizeBlogDraft(draft) {
  const title = asText(draft?.title);
  const authorName = asText(draft?.authorName);
  const authorRole = asText(draft?.authorRole);
  const body = asText(draft?.body);
  if (!title || !body) {
    return { ok: false, error: "Add both a title and article body." };
  }
  if (title.length > 160) {
    return { ok: false, error: "Keep the title under 160 characters." };
  }
  if (body.length > 50000) {
    return { ok: false, error: "Keep the article under 50,000 characters." };
  }
  const publishedAt = dateOnly(draft?.publishedAt, new Date().toISOString().slice(0, 10));
  const slug = slugifyBlogTitle(title);
  if (!slug) {
    return { ok: false, error: "Use a title with at least one letter or number." };
  }
  return {
    ok: true,
    value: {
      title,
      slug,
      authorName: authorName || "Techinance",
      authorRole,
      body,
      excerpt: makeExcerpt(body),
      publishedAt: `${publishedAt}T00:00:00.000Z`,
    },
  };
}
