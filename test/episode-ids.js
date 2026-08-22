// @ts-check

/**
 * Every episode id the story engine can actually play.
 *
 * Kept here so other tests can assert that things which reference episodes, such
 * as the certificate requirements, only name ones that exist. A certificate that
 * requires an unwritten unit can never be earned.
 */

import { episode as unit1 } from "../content/cyber-unit1.js";
import { episode as unit2 } from "../content/cyber-unit2.js";
import { episode as unit3 } from "../content/cyber-unit3.js";
import { episode as unit4 } from "../content/cyber-unit4.js";
import { episode as finance1 } from "../content/finance-unit1.js";
import { episode as finance2 } from "../content/finance-unit2.js";
import { episode as finance3 } from "../content/finance-unit3.js";
import { episode as finance4 } from "../content/finance-unit4.js";
import { episode as neuro1 } from "../content/neuro-unit1.js";
import { episode as neuro2 } from "../content/neuro-unit2.js";
import { episode as neuro3 } from "../content/neuro-unit3.js";
import { episode as neuro4 } from "../content/neuro-unit4.js";
import { episode as startup1 } from "../content/startup-unit1.js";
import { episode as startup2 } from "../content/startup-unit2.js";
import { episode as startup3 } from "../content/startup-unit3.js";
import { episode as startup4 } from "../content/startup-unit4.js";
import { episode as startup5 } from "../content/startup-unit5.js";
import { episode as startup6 } from "../content/startup-unit6.js";

export const EPISODES = new Set(
  [unit1, unit2, unit3, unit4, finance1, finance2, finance3, finance4, neuro1, neuro2, neuro3, neuro4, startup1, startup2, startup3, startup4, startup5, startup6].map(
    (episode) => episode.id,
  ),
);
