import assert from "node:assert/strict";
import test from "node:test";

import {
  SEED_POSTS,
  mergeBlogPosts,
  normalizeBlogDraft,
} from "../blog-data.js";

test("ships all eleven supplied articles as distinct public seed posts", () => {
  assert.equal(SEED_POSTS.length, 11);
  assert.equal(new Set(SEED_POSTS.map((post) => post.slug)).size, 11);
  assert.deepEqual(
    SEED_POSTS.slice(0, 3).map((post) => post.title),
    [
      "History Repeats Itself: Government’s Role in the Market",
      "“Accept All Cookies”: The World’s Most Frequently Signed Lie",
      "Lake America: US-Canada Trade War",
    ],
  );
  for (const post of SEED_POSTS) {
    assert.match(post.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(post.authorName.length > 0);
    assert.ok(post.content.length > 120);
  }
  assert.deepEqual(
    SEED_POSTS.map((post) => post.authorName),
    [
      "Viktoriia Dmitrieva",
      "Viktoriia Dmitrieva",
      "Viktoriia Dmitrieva",
      "Viktoriia Dmitrieva",
      "Viktoriia Dmitrieva",
      "Viktoriia Dmitrieva",
      "Viktoriia Dmitrieva",
      "Viktoriia Dmitrieva",
      "Viktoriia Dmitrieva",
      "Krish Sav",
      "Krish Sav",
    ],
  );
});

test("prefers a matching database post and sorts the merged public feed newest first", () => {
  const remote = [
    {
      id: "remote-cookies",
      slug: "accept-all-cookies",
      title: "Updated cookie post",
      author_name: "Viktoriia Dmitrieva",
      author_role: "",
      body: "A published replacement.",
      excerpt: "A revised excerpt.",
      published_at: "2026-10-01T12:00:00.000Z",
      updated_at: "2026-10-01T12:00:00.000Z",
    },
    {
      id: "remote-new",
      slug: "a-new-post",
      title: "A new post",
      author_name: "Krish Sav",
      author_role: "",
      body: "A fresh public post.",
      excerpt: "Fresh.",
      published_at: "2026-10-02T12:00:00.000Z",
      updated_at: "2026-10-02T12:00:00.000Z",
    },
  ];

  const merged = mergeBlogPosts(remote);

  assert.equal(merged.length, 12);
  assert.equal(merged[0].slug, "a-new-post");
  assert.equal(merged[1].slug, "accept-all-cookies");
  assert.equal(merged[1].title, "Updated cookie post");
});

test("preserves the supplied archive order for articles published on the same day", () => {
  const titles = mergeBlogPosts([])
    .filter((post) => post.publishedAt === "2026-09-06")
    .map((post) => post.title);

  assert.deepEqual(titles, [
    "The Difference Between You and a Cliff-Diver",
    "What’s Up with the Debt Crisis?",
    "The Future of AI: AI Agent",
  ]);
});

test("normalizes an admin draft without accepting markup as rendered HTML", () => {
  const result = normalizeBlogDraft({
    title: "  A safer <b>blog</b> post  ",
    authorName: "  Krish Sav ",
    body: "<script>alert('no')</script>\n\nThis remains plain article text.",
    publishedAt: "2026-10-11",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      title: "A safer <b>blog</b> post",
      slug: "a-safer-blog-post",
      authorName: "Krish Sav",
      authorRole: "",
      body: "<script>alert('no')</script>\n\nThis remains plain article text.",
      excerpt: "<script>alert('no')</script> This remains plain article text.",
      publishedAt: "2026-10-11T00:00:00.000Z",
    },
  });
});

test("refuses a draft that has no title or article body", () => {
  const result = normalizeBlogDraft({
    title: "  ",
    authorName: "Krish Sav",
    body: "",
    publishedAt: "2026-10-11",
  });

  assert.deepEqual(result, {
    ok: false,
    error: "Add both a title and article body.",
  });
});
