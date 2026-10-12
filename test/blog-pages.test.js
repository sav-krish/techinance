import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(name) {
  return readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
}

test("ships a public archive, article reader, and editor console", () => {
  const index = source("blogs.html");
  const article = source("blog.html");
  const admin = source("blog-admin.html");

  assert.match(index, /data-blog-list/);
  assert.match(index, /data-blog-status/);
  assert.match(article, /data-blog-article/);
  assert.match(article, /data-blog-status/);
  assert.match(admin, /data-blog-admin/);
  assert.match(admin, /data-blog-form/);
  for (const page of [index, article, admin]) {
    assert.match(page, /blog\.js/);
    assert.match(page, /blogs\.css/);
  }
});

test("keeps the editor allowlist on the server and uses text nodes for visitor content", () => {
  const controller = source("blog.js");

  assert.match(controller, /checkBlogEditor/);
  assert.match(controller, /textContent/);
  assert.doesNotMatch(controller, /sav\.krish01@gmail\.com/i);
  assert.doesNotMatch(controller, /nabambaezi@gmail\.com/i);
  assert.doesNotMatch(controller, /\binnerHTML\b/);
  assert.doesNotMatch(controller, /\binsertAdjacentHTML\b/);
});

test("build configuration includes every blog entry point", () => {
  const vite = source("vite.config.js");
  for (const entry of ["blogs: \"blogs.html\"", "blog: \"blog.html\"", "blogAdmin: \"blog-admin.html\""]) {
    assert.ok(vite.includes(entry));
  }
});

test("does not reveal the editor form while access is being checked or denied", () => {
  const css = source("blogs.css");
  assert.match(css, /\.blog-admin__panel\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});
