import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import test from "node:test";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function buildSite() {
  execFileSync("npm", ["run", "build"], {
    cwd: projectRoot,
    stdio: "pipe",
  });
}

function readPublishedFile(path) {
  return readFileSync(new URL(`../dist/${path}`, import.meta.url), "utf8");
}

test("publishes the current student reach consistently", () => {
  buildSite();

  const homepage = readPublishedFile("index.html");

  assert.match(homepage, /<p class="stats__value">1,250\+<\/p>/);
  assert.doesNotMatch(homepage, /(?:1,?050\+|More than 1,050 students)/);
});

test("publishes crawler discovery files for the public site", () => {
  buildSite();

  const robots = readPublishedFile("robots.txt");
  const sitemap = readPublishedFile("sitemap.xml");

  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Sitemap: https:\/\/sav-krish\.github\.io\/techinance\/sitemap\.xml$/m);
  assert.match(sitemap, /<loc>https:\/\/sav-krish\.github\.io\/techinance\/<\/loc>/);
  assert.match(sitemap, /<lastmod>2026-09-20<\/lastmod>/);
});
