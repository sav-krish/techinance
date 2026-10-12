import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { findBlogPost, toArticleBlocks } from "../blog-view.js";

test("turns a plain-text article into semantic, DOM-independent blocks", () => {
  const blocks = toArticleBlocks(`A first paragraph with a line break
that should remain part of the same thought.

## What comes next

<script>alert("not executable")</script> is still article text.`);

  assert.deepEqual(blocks, [
    {
      type: "paragraph",
      text: "A first paragraph with a line break that should remain part of the same thought.",
    },
    {
      type: "heading",
      level: 2,
      text: "What comes next",
    },
    {
      type: "paragraph",
      text: '<script>alert("not executable")</script> is still article text.',
    },
  ]);
});

test("keeps source-style paragraphs and short title-case section labels readable", () => {
  const blocks = toArticleBlocks(`A first source paragraph ends here.
Another paragraph starts on its own line.
What Is a Cookie, Really?
This section begins with an explanation.
Sources:
One last citation.`);

  assert.deepEqual(blocks, [
    { type: "paragraph", text: "A first source paragraph ends here." },
    { type: "paragraph", text: "Another paragraph starts on its own line." },
    { type: "heading", level: 2, text: "What Is a Cookie, Really?" },
    { type: "paragraph", text: "This section begins with an explanation." },
    { type: "heading", level: 2, text: "Sources:" },
    { type: "paragraph", text: "One last citation." },
  ]);
});

test("keeps submitted markup as literal text instead of returning HTML", () => {
  const blocks = toArticleBlocks("<img src=x onerror=alert(1)>\n\n<a href=javascript:alert(2)>Read</a>");

  assert.deepEqual(blocks, [
    { type: "paragraph", text: "<img src=x onerror=alert(1)>" },
    { type: "paragraph", text: "<a href=javascript:alert(2)>Read</a>" },
  ]);
  for (const block of blocks) {
    assert.deepEqual(Object.keys(block).sort(),
      block.type === "heading" ? ["level", "text", "type"] : ["text", "type"]);
    assert.equal("html" in block, false);
  }
});

test("handles empty or non-string article content without manufacturing nodes", () => {
  assert.deepEqual(toArticleBlocks(" \n\n  \r\n"), []);
  assert.deepEqual(toArticleBlocks(null), []);
  assert.deepEqual(toArticleBlocks({ body: "nope" }), []);
});

test("looks up an article only by its normalized slug", () => {
  const posts = [
    { slug: "history-repeats", title: "History Repeats" },
    { slug: "safe-post", title: "Safe post" },
  ];

  assert.equal(findBlogPost(posts, "safe-post"), posts[1]);
  assert.equal(findBlogPost(posts, "  SAFE post  "), posts[1]);
  assert.equal(findBlogPost(posts, "<script>alert(1)</script>"), null);
  assert.equal(findBlogPost(posts, "missing-post"), null);
  assert.equal(findBlogPost(null, "safe-post"), null);
});

test("keeps the rendering utility free of HTML injection APIs", () => {
  const source = readFileSync(new URL("../blog-view.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\binnerHTML\b/);
  assert.doesNotMatch(source, /\binsertAdjacentHTML\b/);
  assert.doesNotMatch(source, /\bdocument\b/);
});
