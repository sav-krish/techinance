# Story Mode

Interactive, role-play course episodes for the Techinance site. Learners sign in,
step into a role, and play through a unit instead of reading slides.

All four courses have episodes written.

**Cybersecurity.** Four units, all playable. The learner plays an analyst in a
Security Operations Centre alongside Ravi Mehta, Dana Okoye and the ORACLE
terminal.

| Unit | Title | Scenes | Acts | Badges | Approx |
|---|---|---|---|---|---|
| 1 | The Cost of Cybercrime | 45 | 3 | 5 | 40 min |
| 2 | Digital Footprint and Defense | 28 | 3 | 3 | 30 min |
| 3 | Careers, Skills, and Certifications | 29 | 3 | 3 | 30 min |
| 4 | Programming for Cybersecurity | 32 | 3 | 4 | 30 min |

**Financial Literacy.** Units 1, 2 and 4 playable. The learner is a First-Year Earner
at a credit union with Nia Barros, Marcus Ellery and the LEDGER terminal. The cast
is deliberately separate: no character or terminal is shared between courses, so
the two don't read as reskins of each other. A third course should get its own cast
again. Within a course the cast carries over, and Marcus's situation moves on
between units.

| Unit | Title | Scenes | Acts | Badges | Approx |
|---|---|---|---|---|---|
| 1 | Budgeting and Smart Spending | 32 | 3 | 3 | 30 min |
| 2 | Debt and Credit Management | 26 | 3 | 3 | 30 min |
| 3 | not written (taxes) | | | | |
| 4 | Investing, Savings, and Retirement | 32 | 3 | 3 | 35 min |

**Neuroscience.** All four units playable. The learner is a Research Assistant at the
Ashgrove Cognitive Lab with Dr. Imani Reyes, Theo Lindqvist and the ATLAS
terminal. Third course, third cast: nobody crosses over.

| Unit | Title | Scenes | Acts | Badges | Approx |
|---|---|---|---|---|---|
| 1 | How Your Brain Processes Reality | 31 | 3 | 3 | 35 min |
| 2 | The Neuroscience Behind Emotions | 30 | 3 | 3 | 35 min |
| 3 | Hacking Reward Systems | 29 | 3 | 3 | 35 min |
| 4 | Understanding Neurological Disorders | 28 | 3 | 3 | 40 min |

Neuroscience has **one quiz per unit**, like Cybersecurity. All four units match
their forms 10/10, enforced by `test/neuro-quiz.test.js`.

Units 4's content covers real conditions that a learner or their family may have.
The act files carry a TONE note: state mechanisms plainly, never frame a disorder
as a weakness or a puzzle, and be honest in both directions about what treatment
achieves (CBT helps 40-60%, which means it does not help everyone).

The unit 3 and 4 forms are transcribed with the answers marked; five errors were
found across the four forms while transcribing (a duplicated question stem, a
form titled with the wrong unit, a misspelling, and two options that have lost
their letters). Those are recorded at the bottom of each transcription and are
worth fixing in the forms themselves.

Financial Literacy has **one quiz for the whole course**, not one per unit
(`content/sources/finance-final-quiz.md`, 20 questions). Units 1, 2 and 4 cover
15 of them verbatim. The remaining 5 are all taxes: filing thresholds and
deadlines, deductions, W-2s, and marginal tax brackets. That's what Unit 3 has to
be, and no source document for it exists yet.

`test/finance-quiz.test.js` holds the whole form and checks every written
question against it. Its `UNWRITTEN` set lists the 5 remaining gaps; delete
entries from that set as units land and the tests will start demanding them.

The unit list lives in two places and both must agree: the episode cards in
`learn.html` and `COURSES` in `profile.js`. A new episode also has to be
registered in three consumers: `story.js` (the EPISODES map), `learn.js` and
`profile.js` (both `loadEpisodeMeta`). Adding an episode without touching
`learn.html` and `profile.js` leaves it playable only by typing its URL.

A new **course** needs four more things: a `data-season="<slug>"` section in
`learn.html` holding its episode cards, its rail card flipped from
`learn-course--soon` to `--live`, an entry in `COURSES` in `profile.js` (and
removal from `OTHER_COURSES`), and a slug that `COURSE_ALIASES` in `learn.js`
resolves, so `learn.html?course=<slug>` focuses the right season.

Units 3 and 4 have no official quiz checked in yet. When one exists, save it as
`content/sources/unit<N>-quiz-questions.md` and bring the episode to 10/10 the
way units 1 and 2 are. Unit 3's source documents ("Overview of Cybersecurity
Careers" and "Skills and Certifications") aren't in `content/sources/` either,
so its figures can't be re-checked against the originals.

**How 2 Build a Start Up.** Module 1 playable, of six. The learner is a Student
Founder in a student founder programme with Sofia Okonkwo, Devin Cho and the
RUNWAY terminal. Fourth course, fourth cast.

| Module | Title | Scenes | Acts | Badges | Approx |
|---|---|---|---|---|---|
| 1 | What Is a Startup, Really? | 24 | 3 | 3 | 45 min |
| 2 | Finding a Real Problem Worth Solving | not written | | | |
| 3 | From Idea to MVP | not written | | | |
| 4 | Y Combinator and Accelerators | not written | | | |
| 5 | Funding, Grants and Competitions | not written | | | |
| 6 | Wrap-Up and Founder Portfolio | not written | | | |

This course's lessons are **public Netlify slide decks**, not Google Docs. All
six deck URLs and the extraction recipe are in
`content/sources/startup-modules/README.md`. Every deck follows the same twelve
slide shape, which maps cleanly onto three acts.

Its quizzes are 5-question Google Forms and are **not transcribed yet**, so this
is the one course with no verbatim quiz match enforced. Transcribe them into
`content/sources/startup-modules/` and add a test alongside
`test/neuro-quiz.test.js` to bring it to the same bar as the others.

## Pages

| Page | Purpose |
|---|---|
| `learn.html` | The hub: sign in, course rail, episode list, XP and badges |
| `story.html?episode=cyber-u1` | The player. Redirects to `learn.html` when signed out |

The old **Donate** button is gone from all seven marketing pages. In its place the
header carries an auth control (`Sign in`, which becomes an avatar menu once you're
in), the mobile menu links to **My Learning**, and the footer's Work with Us column
links to **Story Mode**.

## Turning on Google Sign-In

Sign-in works today in **guest mode** with no configuration. To enable Google:

1. Follow the steps documented at the top of `auth-config.js`.
2. Paste the client ID into `GOOGLE_CLIENT_ID`.

Nothing else changes. With an empty client ID the Google button is replaced by a
short "not configured" note, and guest mode carries on working.

> **This is identity, not security.** Sign-in happens entirely in the browser: the
> Google ID token is decoded client-side and never verified by a server, and progress
> lives in `localStorage`. That's the right trade-off for gating free learning content
> and remembering where someone left off. Don't put anything behind it that actually
> needs protecting, because anyone can edit `localStorage`.

Guest progress is stored under the user id `guest`; Google users get `google-<sub>`,
so the two never collide on a shared device.

## Architecture

```
auth.js          Google Identity Services + guest fallback + header control
auth-config.js   GOOGLE_CLIENT_ID (public by design; never a client *secret*)
progress.js      localStorage XP / badges / per-scene state / checkpoints
story-engine.js  Renders the nine scene types, HUD, resume gate
icon.js          Inline lucide SVG icons for dynamically built DOM
learn.js         Drives the hub
story.js         Reads ?episode=, requires a user, mounts the engine
learn.css        All new styling (styles.css is untouched)
content/
  cyber-unit1.js   Merges unit 1's acts, registers badges, validates ids
  unit1-act1.js    Act 1, What Cybercrime Costs       (scene ids a1-*)
  unit1-act2.js    Act 2, How Recent Breaches Happened (a2-*)
  unit1-act3.js    Act 3, Types of Cybercrime          (a3-*)
  cyber-unit2.js   Merges unit 2's acts
  unit2-act1.js    Act 1, Digital Footprint and Reputation  (u2a1-*)
  unit2-act2.js    Act 2, Active and Passive Footprints     (u2a2-*)
  unit2-act3.js    Act 3, Strategies for Protection         (u2a3-*)
  cyber-unit3.js   Merges unit 3's acts
  unit3-act1.js    Act 1, The Cybersecurity Job Market      (u3a1-*)
  unit3-act2.js    Act 2, Skills and Certifications         (u3a2-*)
  unit3-act3.js    Act 3, Planning Your Own Path            (u3a3-*)
  cyber-unit4.js   Merges unit 4's acts
  finance-unit1.js       Merges Financial Literacy unit 1's acts
  finance-unit1-act1.js  Act 1, Where Your Money Actually Goes  (f1a1-*)
  finance-unit1-act2.js  Act 2, Choosing a Budgeting Method     (f1a2-*)
  finance-unit1-act3.js  Act 3, Habits That Hold Up             (f1a3-*)
  finance-unit2.js       Merges Financial Literacy unit 2's acts
  finance-unit2-act1.js  Act 1, Types of Debt and How Loans Work  (f2a1-*)
  finance-unit2-act2.js  Act 2, Snowball vs Avalanche             (f2a2-*)
  finance-unit2-act3.js  Act 3, Staying Debt-Free                 (f2a3-*)
  finance-unit4.js       Merges Financial Literacy unit 4's acts
  finance-unit4-act1.js  Act 1, What You Can Put Money Into     (f4a1-*)
  finance-unit4-act2.js  Act 2, Risk, Time, and Compounding     (f4a2-*)
  finance-unit4-act3.js  Act 3, Retirement Accounts             (f4a3-*)
  unit4-act1.js    Act 1, Why Code Matters in Security      (u4a1-*)
  unit4-act2.js    Act 2, Reading Python and JavaScript     (u4a2-*)
  unit4-act3.js    Act 3, Building a Security Tool          (u4a3-*)
  sources/         Course material and the official quizzes each unit is built from
```

Content files are flat in `content/`, named `<course>-unit<N>.js` and
`<course>-unit<N>-act<n>.js`. Don't nest a unit in its own directory: the merger
and the three consumers (`learn.js`, `story.js`, `profile.js`) all resolve
`./content/<course>-unit<N>.js`, so a nested layout needs a re-export shim that
earns nothing.

Cybersecurity's act files predate the second course and are named `unit<N>-act<n>.js`
with no course prefix. Everything written since carries the prefix, because a
second course's unit 1 would otherwise collide with the first course's.

Scene ids and badge ids are global, not per-course: `progress.js` keeps one flat
list of each per user. Namespace both per unit (`f1a1-*`, `fin-unit1-certified`)
or two courses will unlock each other's badges. `pnpm test` checks this.

## Scene types

`narrative` · `choice` · `quiz` · `reveal` · `inspect` · `sort` · `terminal` ·
`dossier` · `ending`

Every scene can carry `xp`, `badge`, and `source` (a citation chip). XP and badges are
granted once each, tracked through `progress.js`.

## Writing a new episode

1. Add `content/<course>-unit<N>-act<n>.js` files exporting
   `{ entry, scenes }`. Scene ids must be prefixed per act so they cannot collide.
2. Merge them in a `content/<course>-unit<N>.js` modelled on `cyber-unit1.js`.
3. Register the episode in `learn.js` and add the page to `vite.config.js` if it needs
   its own HTML entry.

Rules that keep episodes teachable:

- Every statistic must be exact and carry a `source`. Never invent a figure.
- Figures that go stale (contribution limits, tax bands, benefit amounts) need the
  year attached and a line telling the learner to check the current number.
  Financial Literacy unit 4 does this for the 401(k) and IRA limits, because the
  source document's 2024 figures don't match the IRS ones for that year.
- Wrong answers must explain *why* they're wrong. The feedback is the lesson.
- Decoys matter. In the phishing scene three hotspots are deliberately innocent, and
  clicking them teaches that weak evidence isn't evidence.
- No dead ends: every `choice` option leads somewhere.
- Icons are kebab-case names resolved through `icon.js`, never emoji.
- A course gets at most 4 badges per unit, counted across the whole course rather
  than unit by unit, so the budget scales with how many units the course has and
  can be spent unevenly. Badges mark real milestones, not participation, so most
  scenes award none. Cybersecurity is at 15 of 16 (5 / 3 / 3 / 4), so a new badge
  there means retiring one. How 2 Build a Start Up runs 18 of 24 across six
  modules (3 each).
- Retiring a badge means deleting its `BADGE_REGISTRY` entry **and** the `badge:`
  field on the scene that awarded it. Drop only the registry entry and
  `fallbackBadge()` silently regenerates the badge from the scene. Change nothing
  else: an automated pass over these files once emptied the `commands` and
  `buckets` arrays of 17 terminal and sort scenes while trimming badges, which
  type-checks, lints and renders, but leaves those scenes unplayable. `validate`
  below catches it; a diff review catches it sooner.
- Outside the episodes themselves, keep copy short. Page ledes, card blurbs and
  panel text are one or two lines. The long-form writing belongs in the scenes.
- Every question on the unit's official quiz (`content/sources/unit<N>-quiz-questions.md`)
  must appear in the episode with the same wording, the same options in the same
  order, and the same correct answer. Distractors are usually real figures from the
  course, so their feedback should name what each one actually is.
- Quiz `question` text and option `label`s are quoted from the official form, so they
  are exempt from house style. Leave `NOT` capitalised and `it is` uncontracted if
  that is how the form writes it. Contractions and plain phrasing apply to narration
  and feedback, which we author. A style pass that rewrites a quoted question silently
  breaks the match with the form.
- Plain, factual prose. No scene-setting, metaphors, or dramatic beats. State the
  fact, then why it matters. Titles say what a scene covers rather than teasing it.
- Right answers open with `Correct.` Wrong answers go straight into the
  explanation: the engine already marks them with a cross, so an `Incorrect.`
  prefix just delays the teaching. No exclamation marks, no shouty capitals.
- Write `and`, not `&`, in any title that reaches the page.
- Watch apostrophes in single-quoted string literals. Contractions need
  escaping (`let\'s`) or the literal terminates early.

## Validating content

The scene graph is easy to break by hand-editing, and a broken episode still
type-checks, lints and renders. `test/episodes.test.js` covers every unit:

```bash
pnpm test
```

It fails on unreachable scenes, dangling `next` ids, dead ends, empty
`commands` / `buckets` / `hotspots` / `terms` / `options` arrays, a
`requiredFinds` higher than the number of suspicious hotspots, `sort` items
pointing at unknown buckets, hotspots that are defined but never rendered,
quizzes without exactly one correct answer, a `reveal` whose `answerIndex` is out
of range, badges awarded without a registry entry (or registered without a scene
awarding them), icon names that would silently fall back to `sparkles`, and a
course going over the badge cap.

Run it before shipping content. `tsc` and `eslint` will not catch any of it.
