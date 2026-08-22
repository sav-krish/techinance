// @ts-check

/**
 * Financial Literacy, Unit 3, Act 2: "Deductions, Credits, and the Refund Myth"
 *
 * Source material: "Taxes and Deductions", transcribed at
 * content/sources/finance-unit3-taxes-interest-insurance.md.
 *
 * TWO CORRECTIONS to the source, both deliberate:
 *
 *   1. The source lists IRA contributions, HSA contributions, student loan
 *      interest and business use of a car or home as "common standard
 *      deductions". They are adjustments to income, taken on top of whichever
 *      of standard or itemised you choose. The standard deduction is a single
 *      fixed amount. Teaching the source's version would leave a learner
 *      thinking the standard deduction is a list they assemble, which is the
 *      opposite of what it is.
 *
 *   2. The source lists "gains from the sale of your home" as an itemised
 *      deduction. A gain is income. There is an exclusion on gains from selling
 *      a main home, which is a different mechanism, so it is omitted here
 *      rather than taught wrongly.
 *
 * Scene ids are namespaced `f3a2-*`. The last scene hands off to `f3a3-start`.
 */

/** Citations used by the fact-bearing scenes in this act. */
const SOURCES = {
  deductions: {
    label: "Standard vs itemized deductions (IRS)",
    url: "https://www.irs.gov/newsroom/deductions-for-individuals-the-difference-between-standard-and-itemized-deductions-and-what-they-mean",
  },
  credits: {
    label: "Tax credit, deduction, refund (Britannica Money)",
    url: "https://www.britannica.com/money/tax-credit-deduction-refund",
  },
  hsa: {
    label: "Health Savings Accounts (IRS Publication 969)",
    url: "https://www.irs.gov/publications/p969",
  },
};

/**
 * Badges the acts award are registered centrally in finance-unit3.js. This act
 * awards `deduction-sorter`.
 *
 * @type {{ id: string, name: string, description: string, icon: string }[]}
 */
export const act2Badges = [];

export const act2 = {
  entry: "f3a2-start",
  scenes: {
    /* ---------------- 1. the two levers ---------------- */
    "f3a2-start": {
      id: "f3a2-start",
      type: "narrative",
      speaker: "Nia Barros",
      avatar: "compass",
      location: "Riverbend Credit Union, 16:30",
      text: [
        "\"There are two ways to owe less, and people use the words for them interchangeably, which is why they get the maths wrong,\" Nia says.",
        "\"A deduction lowers the income you get taxed on. A credit lowers the tax itself, after it has been worked out. They are not the same size, and one of them is worth a lot more per dollar.\"",
      ],
      source: SOURCES.credits,
      xp: 10,
      next: "f3a2-levers-terminal",
    },

    "f3a2-levers-terminal": {
      id: "f3a2-levers-terminal",
      type: "terminal",
      title: "LEDGER: deduction against credit",
      speaker: "LEDGER",
      avatar: "terminal",
      location: "Coaching desk 2",
      text: [
        "\"Watch where each one lands in the order of operations,\" Nia says.",
      ],
      prompt: "Run the compare command on LEDGER.",
      host: "member@riverbend-cu",
      commands: [
        {
          id: "compare",
          cmd: "tax --compare deduction credit",
          output: [
            "DEDUCTION",
            "  Subtracts from the income you are taxed on, before the tax is",
            "  worked out. A $1,000 deduction saves you $1,000 times your",
            "  marginal rate. In the 12% band that is $120.",
            "",
            "CREDIT",
            "  Subtracts from the tax itself, after it is worked out. A $1,000",
            "  credit saves you $1,000. Full stop, whatever your rate.",
            "",
            "  REFUNDABLE     : pays out even when you owe nothing.",
            "  NONREFUNDABLE  : can reduce your bill to zero but no further.",
            "                   Owe $100 with a $200 credit and you claim $100.",
            "                   Some carry the unused part into next year.",
          ],
          required: true,
        },
      ],
      source: SOURCES.credits,
      xp: 25,
      next: "f3a2-credit-quiz",
    },

    "f3a2-credit-quiz": {
      id: "f3a2-credit-quiz",
      type: "quiz",
      title: "Knowledge check: which is worth more",
      speaker: "Marcus Ellery",
      avatar: "user",
      location: "Riverbend Credit Union",
      text: [
        "\"So if someone offered me a $1,000 deduction or a $1,000 credit,\" Marcus says, \"they'd be about the same?\"",
      ],
      question: "You are in the 12% bracket. Which saves you more, a $1,000 deduction or a $1,000 credit?",
      options: [
        {
          label: "The credit, by a wide margin: $1,000 against $120",
          correct: true,
          feedback:
            "Correct. The deduction removes $1,000 from your taxable income, and at 12% that is worth $120. The credit comes off the tax bill itself, so it is worth the whole $1,000. Roughly eight times as much, and the gap is bigger the lower your bracket.",
        },
        {
          label: "They are the same, both worth $1,000",
          correct: false,
          feedback:
            "This is the mix-up worth undoing. A deduction is worth its size multiplied by your rate; only a credit is worth its face value.",
        },
        {
          label: "The deduction, because it applies before the tax is calculated",
          correct: false,
          feedback:
            "Applying earlier doesn't make it larger. Coming off income rather than off tax is exactly why it's worth less.",
        },
        {
          label: "It depends on whether you itemise",
          correct: false,
          feedback:
            "Itemising changes which deductions you can take, not the arithmetic that makes a credit worth more per dollar than a deduction.",
        },
      ],
      source: SOURCES.credits,
      xp: 30,
      next: "f3a2-standard-terminal",
    },

    /* ---------------- 2. standard against itemised ---------------- */
    "f3a2-standard-terminal": {
      id: "f3a2-standard-terminal",
      type: "terminal",
      title: "LEDGER: standard, itemised, and adjustments",
      speaker: "LEDGER",
      avatar: "terminal",
      location: "Coaching desk 2",
      text: [
        "\"Three things people lump together,\" Nia says. \"The first two are a choice between. The third is neither, and you can have it either way.\"",
      ],
      prompt: "Run the deductions command on LEDGER.",
      host: "member@riverbend-cu",
      commands: [
        {
          id: "deductions",
          cmd: "tax --deductions",
          output: [
            "STANDARD DEDUCTION",
            "  One fixed amount, set by the IRS, decided by your filing status:",
            "  your age, and whether you are single, married, or head of the",
            "  household. You take it as-is. No receipts, no list.",
            "",
            "ITEMISED DEDUCTIONS",
            "  Add up specific qualifying expenses instead. Worth doing only if",
            "  the total beats the standard deduction, or if you are not",
            "  entitled to the standard one.",
            "    donations to charity",
            "    home mortgage interest",
            "    losses from disasters and theft",
            "    medical expenses above 7.5% of your income",
            "",
            "ADJUSTMENTS TO INCOME",
            "  Neither of the above, and not a choice between. These come off",
            "  your income whichever route you take:",
            "    money into an IRA",
            "    money into a health savings account (HSA, MSA, FSA, HRA)",
            "    student loan interest",
            "    business use of your car or home",
          ],
          required: true,
        },
      ],
      source: SOURCES.deductions,
      xp: 30,
      next: "f3a2-choose-quiz",
    },

    "f3a2-choose-quiz": {
      id: "f3a2-choose-quiz",
      type: "quiz",
      title: "Knowledge check: standard or itemised",
      speaker: "Nia Barros",
      avatar: "compass",
      location: "Riverbend Credit Union",
      text: [
        "\"Most first-time filers never itemise, and that is the right call,\" Nia says. \"Here is the test for when it stops being.\"",
      ],
      question: "When is it worth itemising instead of taking the standard deduction?",
      options: [
        {
          label: "When your qualifying expenses add up to more than the standard deduction",
          correct: true,
          feedback:
            "Correct. It is a straight comparison: whichever is larger. For most people starting out, with no mortgage interest and modest charitable giving, the standard deduction wins comfortably and itemising is paperwork for nothing.",
        },
        {
          label: "Whenever you have any expense on the itemised list",
          correct: false,
          feedback:
            "Having one qualifying expense doesn't help unless the total beats the standard deduction. A $200 donation against a $14,600 standard deduction is not a reason to itemise.",
        },
        {
          label: "When you want to also claim adjustments like student loan interest",
          correct: false,
          feedback:
            "Adjustments to income aren't tied to that choice. You can take student loan interest or an IRA contribution while still taking the standard deduction.",
        },
        {
          label: "Once you earn above the 22% bracket",
          correct: false,
          feedback:
            "Your bracket doesn't decide it. Someone in a high bracket who rents and gives nothing away may still be better off with the standard deduction.",
        },
      ],
      source: SOURCES.deductions,
      xp: 25,
      next: "f3a2-deduction-sort",
    },

    "f3a2-deduction-sort": {
      id: "f3a2-deduction-sort",
      type: "sort",
      title: "Sort the tax breaks",
      speaker: "Nia Barros",
      avatar: "wallet",
      location: "Riverbend Credit Union",
      text: [
        "\"Six things people claim,\" Nia says. \"Put each one where it actually belongs. Two of these get mixed up constantly.\"",
      ],
      prompt: "Drag each item to what it really is.",
      buckets: [
        { id: "itemised", label: "Itemised deduction", hint: "Only if the total beats the standard" },
        { id: "adjustment", label: "Adjustment to income", hint: "Take it either way" },
        { id: "credit", label: "Tax credit", hint: "Comes off the tax itself" },
      ],
      items: [
        {
          id: "mortgage",
          label: "Interest paid on a home mortgage",
          bucket: "itemised",
          explain: "An itemised deduction. Often the single largest one, and the usual reason a household itemises at all.",
        },
        {
          id: "charity",
          label: "Donations to charity",
          bucket: "itemised",
          explain: "An itemised deduction, and only useful if your itemised total clears the standard deduction.",
        },
        {
          id: "hsa",
          label: "Money paid into a health savings account",
          bucket: "adjustment",
          explain: "An adjustment to income. It comes off whether you take the standard deduction or itemise, which is what makes it worth doing for almost anyone eligible.",
        },
        {
          id: "studentloan",
          label: "Interest paid on a student loan",
          bucket: "adjustment",
          explain: "An adjustment to income, not an itemised deduction. You keep the standard deduction and still get this.",
        },
        {
          id: "refundable",
          label: "A credit that pays out even when you owe no tax",
          bucket: "credit",
          explain: "A refundable credit. It reduces the tax to zero and then pays the remainder to you.",
        },
        {
          id: "nonrefundable",
          label: "A credit that can zero your bill but never pay you",
          bucket: "credit",
          explain: "A nonrefundable credit. Owe $100 against a $200 credit and you claim $100. Some kinds carry the unused half into next year.",
        },
      ],
      source: SOURCES.deductions,
      xp: 35,
      badge: "deduction-sorter",
      next: "f3a2-refund-reveal",
    },

    /* ---------------- 3. the refund myth ---------------- */
    "f3a2-refund-reveal": {
      id: "f3a2-refund-reveal",
      type: "reveal",
      title: "What a big refund actually is",
      speaker: "Nia Barros",
      avatar: "compass",
      location: "Riverbend Credit Union",
      text: [
        "\"Every spring somebody tells me they're getting three thousand back and they say it like they won something,\" Nia says.",
        "\"Withholding is an estimate. It doesn't know your deductions or your credits. So a refund isn't a prize. Have a guess at what it is.\"",
      ],
      question: "Where does a large tax refund come from?",
      options: [
        "A reward for filing early",
        "Money you overpaid during the year, returned to you",
        "A government credit for low earners",
        "Interest earned on your withheld tax",
      ],
      answerIndex: 1,
      value: "Your own money, back",
      caption: "Withholding is an estimate, so overpaying it produces a refund.",
      explain:
        "It is your own money coming back after sitting with the government for up to a year, earning you nothing. The same money in a compounding high-yield savings account would have earned interest the whole time. Aiming for a big refund means deliberately lending your wages out at zero percent. The goal is to get the withholding roughly right, not to maximise the rebate.",
      source: SOURCES.credits,
      xp: 30,
      next: "f3a2-forms-dossier",
    },

    /* ---------------- 4. the paperwork ---------------- */
    "f3a2-forms-dossier": {
      id: "f3a2-forms-dossier",
      type: "dossier",
      title: "Coaching card: the forms and the words",
      speaker: "Nia Barros",
      avatar: "file-text",
      location: "Riverbend Credit Union",
      text: [
        "\"These are the words on every tax screen you'll ever open,\" Nia says. \"Learn them now and nobody gets to talk over your head in April.\"",
      ],
      terms: [
        {
          term: "W-2",
          definition:
            "The standard form an employer gives you, in January or February, reporting what you earned and what was withheld from your pay during the calendar year.",
        },
        {
          term: "1099",
          definition:
            "The form used when you earn outside normal employment, including app-based work like Uber or Lyft. Nothing is withheld for you, so the tax on that income is yours to set aside.",
        },
        {
          term: "Filing status",
          definition:
            "Single, married, or head of household, together with your age. It sets your standard deduction and which bracket table applies to you.",
        },
        {
          term: "Marginal rate",
          definition:
            "The rate charged on your next dollar of income. The bracket you say you are 'in'.",
        },
        {
          term: "Effective rate",
          definition:
            "What you actually pay across your whole income, once every band has been applied. Always lower than your marginal rate.",
        },
        {
          term: "Withholding",
          definition:
            "Tax your employer removes from each paycheck and sends on your behalf. An estimate, not a calculation from your real deductions and credits.",
        },
      ],
      source: SOURCES.deductions,
      xp: 25,
      next: "f3a2-filing-choice",
    },

    "f3a2-filing-choice": {
      id: "f3a2-filing-choice",
      type: "choice",
      title: "How to actually file it",
      speaker: "Marcus Ellery",
      avatar: "user",
      location: "Riverbend Credit Union",
      text: [
        "\"Fine, I'm convinced,\" Marcus says. \"One W-2, no mortgage, no dependants. What do I actually do in April?\"",
      ],
      prompt: "Pick what fits Marcus.",
      options: [
        {
          label: "Use a reputable filing service and take the standard deduction.",
          next: "f3a2-handoff",
          xp: 25,
          tone: "good",
          feedback:
            "Right for his situation. Services like Credit Karma, H&R Block or TurboTax walk a single W-2 through in well under an hour. Filing directly with the IRS is possible and free, but the process is genuinely fiddly, and with nothing to itemise there is nothing a preparer would find that the software won't.",
        },
        {
          label: "Pay for a tax planner who advertises maximum refunds.",
          next: "f3a2-handoff",
          xp: 5,
          tone: "bad",
          feedback:
            "For one W-2 and no dependants there is nothing to plan, and a big refund is a sign of overpaying rather than a service worth buying. The fee would likely exceed anything they could find.",
        },
        {
          label: "Skip it. One job, tax already withheld, nothing left to settle.",
          next: "f3a2-handoff",
          xp: 5,
          tone: "bad",
          feedback:
            "Withholding is an estimate, so it is almost never exactly right. Skipping the return means either missing a refund you are owed or missing a bill that grows penalties.",
        },
      ],
      source: SOURCES.hsa,
    },

    "f3a2-handoff": {
      id: "f3a2-handoff",
      type: "narrative",
      speaker: "Nia Barros",
      avatar: "compass",
      location: "Riverbend Credit Union, 16:55",
      text: [
        "\"Tax is the part of this unit people dread, and you have it,\" Nia says. \"Deduction lowers income, credit lowers tax, refund means you overpaid.\"",
        "\"Last stretch is the two things that quietly decide what money costs you and what protects you when something goes wrong. Interest, and insurance.\"",
      ],
      xp: 15,
      next: "f3a3-start",
    },
  },
};

export default act2;
