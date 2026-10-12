import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261011_blog_posts.sql", import.meta.url),
  "utf8",
);

test("the blog migration uses a confirmed-email editor allowlist", () => {
  assert.match(migration, /create or replace function public\.is_blog_editor\(\)/i);
  assert.match(migration, /auth\.users/i);
  assert.match(migration, /u\.email_confirmed_at is not null/i);
  assert.match(migration, /sav\.krish01@gmail\.com/i);
  assert.match(migration, /nabambaezi@gmail\.com/i);
});

test("the blog migration lets anyone read live posts but limits mutations to editors", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /public reads published blog posts/i);
  assert.match(migration, /published_at is not null and published_at <= now\(\)/i);
  for (const verb of ["insert", "update", "delete"]) {
    assert.match(migration, new RegExp(`editors ${verb} blog posts`, "i"));
  }
  assert.match(migration, /with check \(public\.is_blog_editor\(\)\)/i);
});
