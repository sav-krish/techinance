// @ts-check

/**
 * Financial Literacy, Unit 3: "Taxes, Interest, and Insurance"
 *
 * Three acts, played in order:
 *   f3a1-* → "f3a2-start" → f3a2-* → "f3a3-start" → f3a3-* → ending
 *
 * Built from two lessons taught as one unit: "Taxes and Deductions" and
 * "Interest and Insurance", transcribed at
 * content/sources/finance-unit3-taxes-interest-insurance.md.
 *
 * THREE CORRECTIONS to the source, each explained where it is made: the filing
 * threshold ($12,200 is a 2019 figure beside 2024 brackets), the list of
 * "standard deductions" that are really adjustments to income, and gains from a
 * home sale listed as a deduction when a gain is income. The accuracy note at
 * the top of the source file records all three.
 *
 * Continues Unit 1's cast. Marcus Ellery's first W-2 has arrived, which is what
 * makes the unit's question live. Nia Barros coaches, LEDGER is the terminal.
 * Nobody from the Cybersecurity course appears in this one.
 *
 * This module merges the acts into the single `episode` object the story engine
 * consumes. See STORY-MODE.md for the scene schema.
 */

import { act1 } from "./finance-unit3-act1.js";
import { act2 } from "./finance-unit3-act2.js";
import { act3 } from "./finance-unit3-act3.js";

/**
 * @typedef {Object} Badge
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} icon
 */

/**
 * Badges the acts award, in display order. Ids are namespaced per unit because
 * progress.js stores earned badges in one flat list per user.
 *
 * Three badges, one per act, matching Unit 1. Financial Literacy is at 6 of its
 * 15-badge cap.
 */
const BADGE_REGISTRY = /** @type {Badge[]} */ ([
  {
    id: "bracket-reader",
    name: "Bracket Reader",
    description: "Placed six incomes in the bracket their next dollar is taxed at.",
    icon: "compass",
  },
  {
    id: "deduction-sorter",
    name: "Deduction Sorter",
    description: "Told itemised deductions, adjustments to income and credits apart.",
    icon: "file-text",
  },
  {
    id: "fin-unit3-certified",
    name: "Unit 3 Complete",
    description: "Completed Unit 3 of the Techinance financial literacy course.",
    icon: "medal",
  },
]);

const acts = [act1, act2, act3];

/** @type {Record<string, any>} */
const scenes = Object.create(null);

for (const act of acts) {
  for (const [id, scene] of Object.entries(act.scenes)) {
    if (id in scenes) {
      throw new Error(`Duplicate scene id across acts: ${id}`);
    }
    scenes[id] = scene;
  }
}

/**
 * Any badge an act awards but did not register still needs metadata, otherwise
 * the badge tray renders a blank tile. Derive a readable fallback rather than
 * dropping the award.
 *
 * @param {string} id
 * @returns {Badge}
 */
function fallbackBadge(id) {
  const name = id
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
  return { id, name, description: "Earned during Unit 3.", icon: "award" };
}

const badges = BADGE_REGISTRY.slice();
const known = new Set(badges.map((badge) => badge.id));

for (const scene of Object.values(scenes)) {
  const id = /** @type {{ badge?: string }} */ (scene).badge;
  if (typeof id === "string" && !known.has(id)) {
    known.add(id);
    badges.push(fallbackBadge(id));
  }
}

export const episode = {
  id: "fin-u3",
  course: "financial-literacy",
  courseTitle: "Financial Literacy",
  unit: 3,
  title: "Taxes, Interest, and Insurance",
  subtitle:
    "What Tax Day actually asks of you, why a raise never costs you money, and the two things that quietly decide what borrowing costs and what protects you when it goes wrong.",
  role: "First-Year Earner",
  estMinutes: 35,
  startScene: act1.entry,
  acts: [
    { id: "act1", title: "What Tax Day Actually Asks Of You", entry: act1.entry },
    { id: "act2", title: "Deductions, Credits, and the Refund Myth", entry: act2.entry },
    { id: "act3", title: "Interest, and What Insurance Is For", entry: act3.entry },
  ],
  badges,
  scenes,
};

export default episode;
