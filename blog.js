// @ts-check

import { getUser, whenAuthReady } from "./auth.js";
import { mergeBlogPosts, normalizeBlogDraft } from "./blog-data.js";
import {
  checkBlogEditor,
  deleteBlogPost,
  fetchEditableBlogPosts,
  fetchPublishedBlogPosts,
  saveBlogPost,
} from "./blog-repository.js";
import { findBlogPost, toArticleBlocks } from "./blog-view.js";
import { supabase } from "./supabase.js";

const db = supabase();

/**
 * @typedef {object} BlogDatabasePost
 * @property {string} id
 * @property {string} title
 * @property {string} slug
 * @property {string} author_name
 * @property {string} author_role
 * @property {string} excerpt
 * @property {string} body
 * @property {string | null} published_at
 * @property {string} updated_at
 */

/** @param {string} selector @param {ParentNode} [scope] */
function element(selector, scope = document) {
  const found = scope.querySelector(selector);
  return found instanceof HTMLElement ? found : null;
}

/** @param {string} selector @param {ParentNode} [scope] */
function input(selector, scope = document) {
  const found = scope.querySelector(selector);
  return found instanceof HTMLInputElement || found instanceof HTMLTextAreaElement ? found : null;
}

/** @param {string} value */
function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Undated";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/** @param {string | null | undefined} value */
function toInputDate(value) {
  const parsed = new Date(value ?? "");
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

/** @param {HTMLElement | null} status @param {string} message */
function setStatus(status, message) {
  if (status) {
    status.textContent = message;
  }
}

/** @param {import("./blog-data.js").BlogPost} post */
function postUrl(post) {
  return `blog.html?post=${encodeURIComponent(post.slug)}`;
}

/** @param {import("./blog-data.js").BlogPost} post */
function createPostCard(post) {
  const card = document.createElement("article");
  card.className = "blog-card";
  const link = document.createElement("a");
  link.className = "blog-card__link";
  link.href = postUrl(post);
  const date = document.createElement("p");
  date.className = "blog-card__date";
  date.textContent = formatDate(post.publishedAt);
  const title = document.createElement("h3");
  title.textContent = post.title;
  const excerpt = document.createElement("p");
  excerpt.className = "blog-card__excerpt";
  excerpt.textContent = post.excerpt;
  const byline = document.createElement("p");
  byline.className = "blog-card__byline";
  byline.textContent = "By ";
  const author = document.createElement("span");
  author.textContent = post.authorName;
  byline.append(author);
  link.append(date, title, excerpt, byline);
  card.append(link);
  return card;
}

/** @returns {Promise<{ posts: import("./blog-data.js").BlogPost[], remoteAvailable: boolean }>} */
async function loadPublicPosts() {
  const result = await fetchPublishedBlogPosts(db);
  return {
    posts: mergeBlogPosts(result.ok ? result.posts : []),
    remoteAvailable: result.ok,
  };
}

async function renderBlogIndex() {
  const list = element("[data-blog-list]");
  if (!list) {
    return;
  }
  const status = element("[data-blog-status]");
  const { posts, remoteAvailable } = await loadPublicPosts();
  list.replaceChildren();
  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "blog-empty";
    empty.textContent = "New articles are on their way.";
    list.append(empty);
    setStatus(status, "");
    return;
  }
  list.append(...posts.map(createPostCard));
  setStatus(status, remoteAvailable ? "" : "");
}

/** @param {HTMLElement} root @param {import("./blog-data.js").BlogPost} post */
function renderArticle(root, post) {
  const inner = document.createElement("div");
  inner.className = "blog-article__inner";
  const back = document.createElement("a");
  back.className = "blog-back";
  back.href = "blogs.html";
  back.textContent = "← All articles";
  const header = document.createElement("header");
  header.className = "blog-article__header";
  const date = document.createElement("p");
  date.className = "blog-article__date";
  date.textContent = formatDate(post.publishedAt);
  const title = document.createElement("h1");
  title.className = "blog-article__title";
  title.textContent = post.title;
  const byline = document.createElement("p");
  byline.className = "blog-article__byline";
  const by = document.createElement("strong");
  by.textContent = `By ${post.authorName}`;
  byline.append(by);
  if (post.authorRole) {
    byline.append(` · ${post.authorRole}`);
  }
  header.append(date, title, byline);
  const body = document.createElement("div");
  body.className = "blog-article__body";
  for (const block of toArticleBlocks(post.content)) {
    const node = document.createElement(block.type === "heading" ? `h${Math.min(block.level + 1, 4)}` : "p");
    node.textContent = block.text;
    body.append(node);
  }
  inner.append(back, header, body);
  root.replaceChildren(inner);
}

async function renderBlogArticle() {
  const root = element("[data-blog-article]");
  if (!root) {
    return;
  }
  const status = element("[data-blog-status]", root);
  const requestedSlug = new URLSearchParams(window.location.search).get("post");
  const { posts } = await loadPublicPosts();
  const post = findBlogPost(posts, requestedSlug);
  if (!post) {
    root.setAttribute("aria-busy", "false");
    const inner = document.createElement("div");
    inner.className = "blog-article__inner";
    const back = document.createElement("a");
    back.className = "blog-back";
    back.href = "blogs.html";
    back.textContent = "← All articles";
    const title = document.createElement("h1");
    title.className = "blog-article__title";
    title.textContent = "We couldn't find that article.";
    const note = document.createElement("p");
    note.className = "blog-status";
    note.textContent = "Try browsing the full Techinance journal instead.";
    inner.append(back, title, note);
    root.replaceChildren(inner);
    return;
  }
  document.title = `${post.title} | Techinance`;
  root.setAttribute("aria-busy", "false");
  renderArticle(root, post);
  setStatus(status, "");
}

/** @param {HTMLElement} list @param {Array<any>} posts @param {(post: any) => void} onEdit @param {(post: any) => void} onDelete */
function renderAdminPosts(list, posts, onEdit, onDelete) {
  list.replaceChildren();
  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "blog-empty";
    empty.textContent = "No posts have been saved in the editor yet.";
    list.append(empty);
    return;
  }
  for (const post of posts) {
    const card = document.createElement("article");
    card.className = "blog-admin-card";
    const badge = document.createElement("p");
    badge.className = `blog-admin-card__status${post.published_at ? "" : " blog-admin-card__status--draft"}`;
    badge.textContent = post.published_at ? "Published" : "Draft";
    const title = document.createElement("h3");
    title.textContent = post.title;
    const date = document.createElement("p");
    date.className = "blog-admin-card__date";
    date.textContent = post.published_at ? formatDate(post.published_at) : "Not published";
    const actions = document.createElement("div");
    actions.className = "blog-admin-card__actions";
    const edit = document.createElement("button");
    edit.className = "blog-admin-card__button";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => onEdit(post));
    const remove = document.createElement("button");
    remove.className = "blog-admin-card__button blog-admin-card__button--delete";
    remove.type = "button";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => onDelete(post));
    actions.append(edit, remove);
    card.append(badge, title, date, actions);
    list.append(card);
  }
}

async function startBlogAdmin() {
  const root = element("[data-blog-admin]");
  if (!root) {
    return;
  }
  const status = element("[data-blog-admin-status]", root);
  const signedOut = element("[data-blog-admin-signed-out]", root);
  const denied = element("[data-blog-admin-denied]", root);
  const panel = element("[data-blog-admin-panel]", root);
  const form = root.querySelector("[data-blog-form]");
  const list = element("[data-blog-admin-list]", root);
  const titleInput = input("[data-blog-title]", root);
  const authorInput = input("[data-blog-author]", root);
  const authorRoleInput = input("[data-blog-author-role]", root);
  const bodyInput = input("[data-blog-body]", root);
  const publishedInput = input("[data-blog-published-at]", root);
  const publishInput = root.querySelector("[data-blog-publish]");
  const formStatus = element("[data-blog-form-status]", root);
  const formTitle = element("[data-blog-form-title]", root);
  const cancel = root.querySelector("[data-blog-cancel-edit]");
  const submit = root.querySelector("[data-blog-submit]");
  if (!(form instanceof HTMLFormElement) || !list || !titleInput || !authorInput || !authorRoleInput || !bodyInput || !publishedInput || !(publishInput instanceof HTMLInputElement) || !(cancel instanceof HTMLButtonElement) || !(submit instanceof HTMLButtonElement)) {
    return;
  }

  await whenAuthReady();
  const user = getUser();
  if (!user) {
    setStatus(status, "");
    if (signedOut) signedOut.hidden = false;
    return;
  }
  const access = await checkBlogEditor(db);
  if (!access.ok) {
    setStatus(status, access.error);
    if (denied) denied.hidden = false;
    return;
  }
  if (!access.isEditor) {
    setStatus(status, "");
    if (denied) denied.hidden = false;
    return;
  }

  setStatus(status, "");
  if (panel) panel.hidden = false;
  let editingId = "";
  /** @type {BlogDatabasePost[]} */
  let currentPosts = [];

  const resetForm = () => {
    editingId = "";
    form.reset();
    authorInput.value = user.name || "Techinance";
    publishedInput.value = new Date().toISOString().slice(0, 10);
    publishInput.checked = true;
    if (formTitle) formTitle.textContent = "Write an article";
    submit.textContent = "Publish post";
    cancel.hidden = true;
    setStatus(formStatus, "");
  };

  /** @param {BlogDatabasePost} post */
  const editPost = (post) => {
    editingId = post.id;
    titleInput.value = post.title ?? "";
    authorInput.value = post.author_name ?? "Techinance";
    authorRoleInput.value = post.author_role ?? "";
    bodyInput.value = post.body ?? "";
    publishedInput.value = toInputDate(post.published_at ?? post.updated_at);
    publishInput.checked = Boolean(post.published_at);
    if (formTitle) formTitle.textContent = "Edit article";
    submit.textContent = publishInput.checked ? "Update post" : "Save draft";
    cancel.hidden = false;
    setStatus(formStatus, "");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const refreshPosts = async () => {
    const result = await fetchEditableBlogPosts(db);
    if (!result.ok) {
      setStatus(formStatus, result.error);
      return;
    }
    currentPosts = /** @type {BlogDatabasePost[]} */ (result.posts);
    renderAdminPosts(list, currentPosts, editPost, async (post) => {
      if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) {
        return;
      }
      const result = await deleteBlogPost(db, post.id);
      setStatus(formStatus, result.ok ? "Post deleted." : result.error);
      if (result.ok) {
        if (editingId === post.id) resetForm();
        await refreshPosts();
      }
    });
  };

  resetForm();
  await refreshPosts();
  publishInput.addEventListener("change", () => {
    submit.textContent = publishInput.checked ? (editingId ? "Update post" : "Publish post") : "Save draft";
  });
  cancel.addEventListener("click", resetForm);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const normalized = normalizeBlogDraft({
      title: titleInput.value,
      authorName: authorInput.value,
      authorRole: authorRoleInput.value,
      body: bodyInput.value,
      publishedAt: publishedInput.value,
    });
    if (!normalized.ok) {
      setStatus(formStatus, normalized.error);
      return;
    }
    submit.disabled = true;
    setStatus(formStatus, editingId ? "Saving changes…" : "Saving post…");
    const result = await saveBlogPost(db, normalized.value, { id: editingId || undefined, publish: publishInput.checked });
    submit.disabled = false;
    if (!result.ok) {
      setStatus(formStatus, result.error);
      return;
    }
    const message = publishInput.checked ? "Your post is live." : "Your draft is saved privately.";
    resetForm();
    setStatus(formStatus, message);
    await refreshPosts();
  });
}

void renderBlogIndex();
void renderBlogArticle();
void startBlogAdmin();
