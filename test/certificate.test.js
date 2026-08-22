import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Mock minimal browser environment for Node unit test runner
if (typeof globalThis.window === "undefined") {
  globalThis.window = /** @type {any} */ ({
    location: { href: "http://localhost/", search: "" },
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}
if (typeof globalThis.document === "undefined") {
  globalThis.document = /** @type {any} */ ({
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      setAttribute: () => {},
      appendChild: () => {},
      addEventListener: () => {},
      style: {},
    }),
    addEventListener: () => {},
  });
}
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = /** @type {any} */ ({
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, val),
    removeItem: (key) => store.delete(key),
  });
}

const { COURSE_DEFINITIONS, checkCourseCompletion } = await import("../certificate-generator.js");
const { completeEpisode } = await import("../progress.js");

test("certificate module has valid course definitions", () => {
  assert.ok(COURSE_DEFINITIONS["financial-literacy"]);
  assert.equal(COURSE_DEFINITIONS["financial-literacy"].title, "Financial Literacy");
  assert.ok(Array.isArray(COURSE_DEFINITIONS["financial-literacy"].episodes));
  assert.ok(COURSE_DEFINITIONS["cybersecurity"]);
});

test("checkCourseCompletion returns null when progress store is empty", () => {
  const result = checkCourseCompletion("nonexistent_user", "fin-u1");
  assert.equal(result, null);
});

test("checkCourseCompletion returns null when course is only partially completed", () => {
  const userId = "partial_user_" + Date.now();
  completeEpisode(userId, "fin-u1", { earnedXp: 50, sceneId: "fin-u1-end" });
  completeEpisode(userId, "fin-u2", { earnedXp: 50, sceneId: "fin-u2-end" });
  // fin-u4 is NOT completed.

  const result = checkCourseCompletion(userId, "fin-u2");
  assert.equal(result, null);
});

test("checkCourseCompletion returns course completion info ONLY when ALL episodes are finished", () => {
  const userId = "complete_user_" + Date.now();
  completeEpisode(userId, "fin-u1", { earnedXp: 50, sceneId: "fin-u1-end" });
  completeEpisode(userId, "fin-u2", { earnedXp: 50, sceneId: "fin-u2-end" });
  completeEpisode(userId, "fin-u4", { earnedXp: 50, sceneId: "fin-u4-end" });

  const result = checkCourseCompletion(userId, "fin-u4");
  assert.notEqual(result, null);
  assert.equal(result.isCourseCompleted, true);
  assert.equal(result.courseId, "financial-literacy");
});

test("no course requires an episode that does not exist", async () => {
  // Requiring an unwritten unit makes its certificate unobtainable, which is
  // exactly what happened when financial-literacy listed fin-u3.
  const { EPISODES } = await import("./episode-ids.js");
  const missing = [];
  for (const [courseId, def] of Object.entries(COURSE_DEFINITIONS)) {
    for (const epId of def.episodes) {
      if (!EPISODES.has(epId)) {
        missing.push(`${courseId}: ${epId}`);
      }
    }
  }
  assert.deepEqual(missing, [], "certificate requirements naming episodes that do not exist");
});

test("the browser and the server agree on what each course requires", () => {
  // The server's list is authoritative. A mismatch means a learner is either
  // told they are finished and then refused, or never offered a claim they have
  // earned. Comments are stripped first so a course id mentioned in prose
  // cannot make this pass by accident.
  const source = readFileSync(
    new URL("../supabase/functions/generate-certificate/courses.ts", import.meta.url),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  /** @type {Record<string, string[]>} */
  const serverCourses = {};
  const blocks = source.matchAll(
    /["']?([a-z-]+)["']?\s*:\s*\{[^}]*?episodes:\s*\[([^\]]*)\]/g,
  );
  for (const [, courseId, list] of blocks) {
    serverCourses[courseId] = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }

  assert.deepEqual(
    Object.keys(serverCourses).sort(),
    Object.keys(COURSE_DEFINITIONS).sort(),
    "courses defined in the browser but not on the server, or the reverse",
  );

  for (const [courseId, def] of Object.entries(COURSE_DEFINITIONS)) {
    assert.deepEqual(
      [...def.episodes].sort(),
      [...serverCourses[courseId]].sort(),
      `${courseId} requires different episodes in the browser than on the server`,
    );
  }
});
