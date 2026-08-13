import assert from "node:assert/strict";
import test from "node:test";

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
  // fin-u3 & fin-u4 are NOT completed!

  const result = checkCourseCompletion(userId, "fin-u2");
  assert.equal(result, null);
});

test("checkCourseCompletion returns course completion info ONLY when ALL episodes are finished", () => {
  const userId = "complete_user_" + Date.now();
  completeEpisode(userId, "fin-u1", { earnedXp: 50, sceneId: "fin-u1-end" });
  completeEpisode(userId, "fin-u2", { earnedXp: 50, sceneId: "fin-u2-end" });
  completeEpisode(userId, "fin-u3", { earnedXp: 50, sceneId: "fin-u3-end" });
  completeEpisode(userId, "fin-u4", { earnedXp: 50, sceneId: "fin-u4-end" });

  const result = checkCourseCompletion(userId, "fin-u4");
  assert.notEqual(result, null);
  assert.equal(result.isCourseCompleted, true);
  assert.equal(result.courseId, "financial-literacy");
});
