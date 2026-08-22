// @ts-check

/**
 * Financial Literacy, Unit 3, Act 1: "What Tax Day Actually Asks Of You"
 *
 * Source material: "Taxes and Deductions", transcribed at
 * content/sources/finance-unit3-taxes-interest-insurance.md.
 *
 * The 2024 single-filer bracket table is quoted from that document and must
 * stay exact.
 *
 * FILING THRESHOLD: the source says $12,200, which was the 2019 single-filer
 * standard deduction. The same document quotes 2024 brackets, so the figure
 * that belongs beside them is $14,600. This act uses $14,600 and says out loud
 * that the number moves every year, so nobody carries a stale one away. See the
 * accuracy note at the top of the source file.
 *
 * Scene ids are namespaced `f3a1-*`. The last scene hands off to `f3a2-start`.
 */

/** Citations used by the fact-bearing scenes in this act. */
const SOURCES = {
  brackets: {
    label: "Federal income tax rates and brackets (IRS)",
    url: "https://www.irs.gov/filing/federal-income-tax-rates-and-brackets",
  },
  filing: {
    label: "Do I need to file a tax return? (IRS)",
    url: "https://www.irs.gov/help/ita/do-i-need-to-file-a-tax-return",
  },
  planning: {
    label: "Taxes (Yale Financial Literacy)",
    url: "https://finlit.yale.edu/planning/taxes",
  },
};

/**
 * Badges the acts award are registered centrally in finance-unit3.js. This act
 * awards `bracket-reader`.
 *
 * @type {{ id: string, name: string, description: string, icon: string }[]}
 */
export const act1Badges = [];

export const act1 = {
  entry: "f3a1-start",
  scenes: {
    /* ---------------- 1. orientation ---------------- */
    "f3a1-start": {
      id: "f3a1-start",
      type: "narrative",
      speaker: "Nia Barros",
      avatar: "compass",
      location: "Riverbend Credit Union, 16:00",
      text: [
        "\"Your first W-2 turned up and you brought it in unopened,\" Nia says. \"That's fine. Most people's first instinct with tax paperwork is to put it somewhere safe and never look at it again.\"",
        "\"Tax is a mandatory payment to the government that funds public services. If you earned money from a job, a scholarship, or a grant, some of it is taxable. The part worth learning is not the arithmetic, it's what the arithmetic actually does.\"",
      ],
      source: SOURCES.planning,
      xp: 10,
      next: "f3a1-basics-terminal",
    },

    /* ---------------- 2. the calendar and the threshold ---------------- */
    "f3a1-basics-terminal": {
      id: "f3a1-basics-terminal",
      type: "terminal",
      title: "LEDGER: the dates and the threshold",
      speaker: "LEDGER",
      avatar: "terminal",
      location: "Coaching desk 2",
      text: [
        "\"Two facts to start,\" Nia says. \"One date, and one number that decides whether the date is your problem.\"",
      ],
      prompt: "Run the filing command on LEDGER.",
      host: "member@riverbend-cu",
      commands: [
        {
          id: "filing",
          cmd: "tax --filing-basics",
          output: [
            "TAX DAY",
            "  April 15. The deadline to file on everything you earned during",
            "  the previous calendar year.",
            "",
            "WHO HAS TO FILE",
            "  Above the standard deduction for your filing status you are",
            "  legally required to file. For a single filer in 2024 that is",
            "  $14,600. The figure moves every year, so check the current one",
            "  rather than trusting a number you read once.",
            "",
            "WHO SHOULD FILE ANYWAY",
            "  Below the threshold you are not required to. But if your",
            "  employer withheld income tax from your pay during the year,",
            "  that money is sitting with the government and filing is how you",
            "  get it back. Check your payslip for tax withheld.",
          ],
          required: true,
        },
      ],
      source: SOURCES.filing,
      xp: 25,
      next: "f3a1-threshold-quiz",
    },

    "f3a1-threshold-quiz": {
      id: "f3a1-threshold-quiz",
      type: "quiz",
      title: "Knowledge check: below the threshold",
      speaker: "Marcus Ellery",
      avatar: "user",
      location: "Riverbend Credit Union",
      text: [
        "\"I earned about nine thousand last year,\" Marcus says. \"So I don't have to file. That means there's no reason to, right?\"",
      ],
      question:
        "You earned under the filing threshold, and your employer withheld income tax from every paycheck. What should you do?",
      options: [
        {
          label: "File anyway. The withheld money is yours and filing is how you get it back",
          correct: true,
          feedback:
            "Correct. Withholding is an estimate taken before anyone knows what you actually owe. Under the threshold you likely owe nothing, so most or all of it comes back as a refund, but only if you file. Skipping it means leaving your own money with the government.",
        },
        {
          label: "Do nothing. Under the threshold there is nothing to claim",
          correct: false,
          feedback:
            "The threshold decides whether filing is *required*, not whether it's worthwhile. Money already withheld from your pay only comes back if you file for it.",
        },
        {
          label: "Ask your employer to refund the withheld tax directly",
          correct: false,
          feedback:
            "They can't. Once it's withheld it has gone to the government, and the tax return is the mechanism for settling up.",
        },
        {
          label: "Wait until you earn above the threshold, then claim both years at once",
          correct: false,
          feedback:
            "Each year is filed on its own, and there are time limits on claiming a refund. Waiting risks losing it.",
        },
      ],
      source: SOURCES.filing,
      xp: 25,
      next: "f3a1-brackets-terminal",
    },

    /* ---------------- 3. the bracket table ---------------- */
    "f3a1-brackets-terminal": {
      id: "f3a1-brackets-terminal",
      type: "terminal",
      title: "LEDGER: 2024 brackets, single filer",
      speaker: "LEDGER",
      avatar: "terminal",
      location: "Coaching desk 2",
      text: [
        "\"How much you pay depends on how much you earned,\" Nia says. \"These bands are called brackets. Read the table before I ask you what it means, because almost everybody gets that part wrong.\"",
      ],
      prompt: "Run the brackets command on LEDGER.",
      host: "member@riverbend-cu",
      commands: [
        {
          id: "brackets",
          cmd: "tax --brackets 2024 --single",
          output: [
            "RATE   TAXABLE INCOME",
            "  10%    $0 to $11,600",
            "  12%    $11,600 to $47,150",
            "  22%    $47,150 to $100,525",
            "  24%    $100,526 to $191,950",
            "  32%    $191,950 to $243,725",
            "  35%    $243,725 to $609,350",
            "  37%    $609,350 and above",
            "",
            "These are 2024 figures for a single filer. Brackets are adjusted",
            "every year, and they differ for married and head-of-household",
            "filers.",
          ],
          required: true,
        },
      ],
      source: SOURCES.brackets,
      xp: 25,
      next: "f3a1-marginal-quiz",
    },

    /* ---------------- 4. the misconception ---------------- */
    "f3a1-marginal-quiz": {
      id: "f3a1-marginal-quiz",
      type: "quiz",
      title: "Knowledge check: the raise that moves you up a bracket",
      speaker: "Marcus Ellery",
      avatar: "user",
      location: "Riverbend Credit Union",
      text: [
        "\"My manager offered me a raise from $46,000 to $49,000,\" Marcus says. \"My cousin told me to turn it down. He says it pushes me from the 12% bracket into 22% and I'd take home less.\"",
        "\"Is he right?\"",
      ],
      question: "A raise moves part of your income into a higher bracket. What gets taxed at the higher rate?",
      options: [
        {
          label: "Only the part of your income above the bracket line",
          correct: true,
          feedback:
            "Correct, and this is the single most misunderstood thing about tax. Moving up a bracket never lowers your take-home pay. On $49,000, the first $11,600 is still taxed at 10%, the next chunk up to $47,150 at 12%, and only the last $1,850 at 22%. Marcus should take the raise.",
        },
        {
          label: "Your entire income, at the new higher rate",
          correct: false,
          feedback:
            "This is the belief that makes people turn down raises, and it costs them real money. The higher rate applies only to the income sitting inside the higher band.",
        },
        {
          label: "Your entire income, at an average of the two rates",
          correct: false,
          feedback:
            "There is an average rate, and it's a useful number, but it's the *result* of the band-by-band calculation rather than how the tax is worked out.",
        },
        {
          label: "Nothing changes until your whole income clears the next bracket",
          correct: false,
          feedback:
            "The higher rate starts applying the moment income crosses the line, but only to the amount past it. There's no waiting period.",
        },
      ],
      source: SOURCES.brackets,
      xp: 30,
      next: "f3a1-math-reveal",
    },

    /* ---------------- 5. work it through ---------------- */
    "f3a1-math-reveal": {
      id: "f3a1-math-reveal",
      type: "reveal",
      title: "What Marcus actually owes on $49,000",
      speaker: "Nia Barros",
      avatar: "compass",
      location: "Riverbend Credit Union",
      text: [
        "\"Let's do it band by band so the shape of it sticks,\" Nia says. \"Ten percent of the first $11,600 is $1,160. Twelve percent of the next $35,550 is $4,266. Twenty-two percent of the last $1,850 is $407.\"",
        "\"Add them up. Then guess what share of his $49,000 that actually is.\"",
      ],
      question: "Marcus is 'in the 22% bracket'. What share of his income does he really pay?",
      options: ["About 12%", "About 16%", "About 22%", "About 27%"],
      answerIndex: 1,
      value: "About 12%",
      caption: "$1,160 + $4,266 + $407 = $5,833 on $49,000.",
      explain:
        "$5,833 on $49,000 is close to 12%, not 22%. The bracket you are 'in' is your marginal rate, the rate on your next dollar. What you actually pay across the whole income is your effective rate, and it is always lower. Anyone quoting their bracket as what they pay is overstating it, usually by a lot.",
      source: SOURCES.brackets,
      xp: 30,
      next: "f3a1-brackets-sort",
    },

    /* ---------------- 6. read the table ---------------- */
    "f3a1-brackets-sort": {
      id: "f3a1-brackets-sort",
      type: "sort",
      title: "Which bracket does the next dollar fall in?",
      speaker: "Nia Barros",
      avatar: "wallet",
      location: "Riverbend Credit Union",
      text: [
        "\"Six single filers, six taxable incomes,\" Nia says. \"Put each one in the band their next dollar would be taxed at. Not their whole income, just the next dollar.\"",
      ],
      prompt: "Drag each income to the bracket its next dollar falls in.",
      buckets: [
        { id: "ten", label: "10%", hint: "$0 to $11,600" },
        { id: "twelve", label: "12%", hint: "$11,600 to $47,150" },
        { id: "twentytwo", label: "22%", hint: "$47,150 to $100,525" },
      ],
      items: [
        {
          id: "summer",
          label: "$8,400 from a summer job",
          bucket: "ten",
          explain: "Under $11,600, so every dollar sits in the 10% band and the next one does too.",
        },
        {
          id: "parttime",
          label: "$11,200 working part-time through college",
          bucket: "ten",
          explain: "Still under $11,600. Close to the line, but the next dollar is taxed at 10%.",
        },
        {
          id: "first",
          label: "$32,000 in a first full-time year",
          bucket: "twelve",
          explain: "Between $11,600 and $47,150, so the next dollar is taxed at 12%. The first $11,600 was still taxed at 10%.",
        },
        {
          id: "marcus",
          label: "$46,000, just under the line",
          bucket: "twelve",
          explain: "Still inside the 12% band, which tops out at $47,150. This is Marcus before the raise.",
        },
        {
          id: "raised",
          label: "$49,000 after a raise",
          bucket: "twentytwo",
          explain: "Past $47,150, so the next dollar is taxed at 22%. Only the $1,850 above the line is, though, which is why the raise is still worth taking.",
        },
        {
          id: "senior",
          label: "$88,000 in a senior role",
          bucket: "twentytwo",
          explain: "Comfortably inside the 22% band, which runs to $100,525. The income below each line is still taxed at the lower rates.",
        },
      ],
      source: SOURCES.brackets,
      xp: 35,
      badge: "bracket-reader",
      next: "f3a1-handoff",
    },

    /* ---------------- 7. handoff ---------------- */
    "f3a1-handoff": {
      id: "f3a1-handoff",
      type: "narrative",
      speaker: "Nia Barros",
      avatar: "compass",
      location: "Riverbend Credit Union, 16:25",
      text: [
        "\"You can read the table now, and you know a raise never costs you money,\" Nia says. \"That already puts you ahead of most adults I sit down with.\"",
        "\"Next is the part that changes what you owe rather than just describing it. Deductions, credits, and why chasing a big refund is a worse plan than it sounds.\"",
      ],
      xp: 15,
      next: "f3a2-start",
    },
  },
};

export default act1;
