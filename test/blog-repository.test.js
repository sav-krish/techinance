import assert from "node:assert/strict";
import test from "node:test";

import {
  checkBlogEditor,
  fetchPublishedBlogPosts,
  saveBlogPost,
} from "../blog-repository.js";

function createDatabaseStub({ rows = [], editor = false, error = null } = {}) {
  const calls = [];
  const query = {
    select(columns) {
      calls.push(["select", columns]);
      return this;
    },
    lte(column, value) {
      calls.push(["lte", column, value]);
      return this;
    },
    order(column, options) {
      calls.push(["order", column, options]);
      return Promise.resolve({ data: rows, error });
    },
    insert(value) {
      calls.push(["insert", value]);
      return this;
    },
    update(value) {
      calls.push(["update", value]);
      return this;
    },
    eq(column, value) {
      calls.push(["eq", column, value]);
      return this;
    },
    single() {
      return Promise.resolve({ data: rows[0] ?? null, error });
    },
  };
  return {
    calls,
    from(table) {
      calls.push(["from", table]);
      return query;
    },
    rpc(name) {
      calls.push(["rpc", name]);
      return Promise.resolve({ data: editor, error });
    },
  };
}

test("loads only already-published posts through the public repository path", async () => {
  const db = createDatabaseStub({ rows: [{ slug: "hello" }] });

  const result = await fetchPublishedBlogPosts(db, new Date("2026-10-11T12:00:00.000Z"));

  assert.deepEqual(result, { ok: true, posts: [{ slug: "hello" }], error: "" });
  assert.deepEqual(db.calls.slice(0, 4), [
    ["from", "blog_posts"],
    ["select", "id, slug, title, author_name, author_role, excerpt, body, published_at, updated_at"],
    ["lte", "published_at", "2026-10-11T12:00:00.000Z"],
    ["order", "published_at", { ascending: false }],
  ]);
});

test("asks the database, rather than the browser, whether the current account is an editor", async () => {
  const db = createDatabaseStub({ editor: true });

  const result = await checkBlogEditor(db);

  assert.deepEqual(result, { ok: true, isEditor: true, error: "" });
  assert.deepEqual(db.calls, [["rpc", "is_blog_editor"]]);
});

test("saves an explicit, allowlisted post shape and can save a draft", async () => {
  const db = createDatabaseStub({ rows: [{ id: "post-id", slug: "safe-post" }] });
  const draft = {
    title: "Safe post",
    slug: "safe-post",
    authorName: "Krish Sav",
    authorRole: "Editor",
    excerpt: "A concise preview.",
    body: "Plain article text.",
    publishedAt: "2026-10-11T00:00:00.000Z",
    ignored: "must not reach the database",
  };

  const result = await saveBlogPost(db, draft, { publish: false });

  assert.deepEqual(result, { ok: true, post: { id: "post-id", slug: "safe-post" }, error: "" });
  assert.deepEqual(db.calls.slice(0, 4), [
    ["from", "blog_posts"],
    ["insert", {
      title: "Safe post",
      slug: "safe-post",
      author_name: "Krish Sav",
      author_role: "Editor",
      excerpt: "A concise preview.",
      body: "Plain article text.",
      published_at: null,
    }],
    ["select", "id, slug, title, author_name, author_role, excerpt, body, published_at, updated_at"],
  ]);
});
