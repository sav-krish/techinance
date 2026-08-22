// @ts-check

/**
 * Financial Literacy, Unit 3, Act 3: "Interest, and What Insurance Is For"
 *
 * Source material: "Interest and Insurance", transcribed at
 * content/sources/finance-unit3-taxes-interest-insurance.md.
 *
 * Figures quoted from that document and kept exact: the Fed's 2% inflation
 * target, the 7.5%-of-income floor on medical expenses referenced in act 2, and
 * the $4,000 claim with a $2,000 deductible worked through below.
 *
 * Scene ids are namespaced `f3a3-*`. The last scene ends the episode.
 */

/** Citations used by the fact-bearing scenes in this act. */
const SOURCES = {
  savings: {
    label: "How interest rates work on savings accounts (Investopedia)",
    url: "https://www.investopedia.com/articles/personal-finance/062315/how-interest-rates-work-savings-accounts.asp",
  },
  rates: {
    label: "How do interest rates affect investments? (U.S. Bank)",
    url: "https://www.usbank.com/financialiq/invest-your-money/investment-strategies/how-do-interest-rates-affect-investments.html",
  },
  insurance: {
    label: "Insurance (Investopedia)",
    url: "https://www.investopedia.com/terms/i/insurance.asp",
  },
};

/**
 * Badges the acts award are registered centrally in finance-unit3.js. This act
 * awards `fin-unit3-certified`.
 *
 * @type {{ id: string, name: string, description: string, icon: string }[]}
 */
export const act3Badges = [];

export const act3 = {
  entry: "f3a3-start",
  scenes: {
    /* ---------------- 1. interest, both directions ---------------- */
    "f3a3-start": {
      id: "f3a3-start",
      type: "narrative",
      speaker: "Nia Barros",
      avatar: "compass",
      location: "Riverbend Credit Union, 17:00",
      text: [
        "\"One number does two opposite jobs,\" Nia says. \"On a loan, the interest rate is what borrowing costs you. On a savings account, it's what your money earns.\"",
        "\"Same number, opposite sign. Which side of it you're standing on is the whole question.\"",
      ],
      source: SOURCES.savings,
      xp: 10,
      next: "f3a3-interest-terminal",
    },

    "f3a3-interest-terminal": {
      id: "f3a3-interest-terminal",
      type: "terminal",
      title: "LEDGER: simple against compound",
      speaker: "LEDGER",
      avatar: "terminal",
      location: "Coaching desk 2",
      text: [
        "\"Two ways to calculate it, and the difference only shows up with time,\" Nia says.",
      ],
      prompt: "Run the interest command on LEDGER.",
      host: "member@riverbend-cu",
      commands: [
        {
          id: "types",
          cmd: "interest --types",
          output: [
            "SIMPLE INTEREST",
            "  Calculated on the original amount only. You pay, or earn, the",
            "  same figure every period. $1,000 at 5% earns $50 this year and",
            "  $50 every year after.",
            "",
            "COMPOUND INTEREST",
            "  Last period's interest is added to the principal before the next",
            "  is calculated. $1,000 at 5% earns $50, then 5% of $1,050, then",
            "  5% of $1,102.50. The base keeps growing.",
            "",
            "  Working for you in a savings account. Working against you on a",
            "  balance you are carrying.",
            "",
            "FIXED RATE      : does not change over the life of the loan.",
            "VARIABLE RATE   : moves with economic conditions.",
            "CREDITWORTHINESS: your FICO score and banking history. A stronger",
            "                  record can qualify you for a lower rate.",
          ],
          required: true,
        },
      ],
      source: SOURCES.savings,
      xp: 25,
      next: "f3a3-rates-sort",
    },

    "f3a3-rates-sort": {
      id: "f3a3-rates-sort",
      type: "sort",
      title: "Fixed or variable?",
      speaker: "Nia Barros",
      avatar: "wallet",
      location: "Riverbend Credit Union",
      text: [
        "\"Whether a rate can move decides whether you can budget around it,\" Nia says. \"Sort these four.\"",
      ],
      prompt: "Drag each product to the kind of rate it usually carries.",
      buckets: [
        { id: "fixed", label: "Usually fixed", hint: "Does not move" },
        { id: "variable", label: "Usually variable", hint: "Moves with conditions" },
      ],
      items: [
        {
          id: "federalstudent",
          label: "A federal student loan",
          bucket: "fixed",
          explain: "Usually fixed, which is what makes the repayment predictable for years. Some private student loans are variable, so read those carefully.",
        },
        {
          id: "auto",
          label: "An auto loan",
          bucket: "fixed",
          explain: "Generally fixed. The payment you agree at signing is the payment for the term.",
        },
        {
          id: "creditcard",
          label: "A credit card balance",
          bucket: "variable",
          explain: "Usually variable, which is exactly what makes cards hard to budget around: the cost of carrying a balance can rise without you doing anything.",
        },
        {
          id: "arm",
          label: "An adjustable-rate mortgage",
          bucket: "variable",
          explain: "Variable by design, though most run at a fixed rate for an opening period before they start moving. A standard mortgage is fixed.",
        },
      ],
      source: SOURCES.savings,
      xp: 30,
      next: "f3a3-fed-terminal",
    },

    /* ---------------- 2. where rates come from ---------------- */
    "f3a3-fed-terminal": {
      id: "f3a3-fed-terminal",
      type: "terminal",
      title: "LEDGER: where the rate comes from",
      speaker: "LEDGER",
      avatar: "terminal",
      location: "Coaching desk 2",
      text: [
        "\"Your bank sets the rate you pay, but it doesn't set it in a vacuum,\" Nia says.",
      ],
      prompt: "Run the fed command on LEDGER.",
      host: "member@riverbend-cu",
      commands: [
        {
          id: "fed",
          cmd: "rates --source",
          output: [
            "THE FEDERAL RESERVE",
            "  Sets the target range for the federal funds rate (FFR), the rate",
            "  banks charge each other for short-term loans, and the discount",
            "  rate, what banks pay to borrow directly from the Fed.",
            "",
            "  Neither is the rate you pay your bank. Both influence it.",
            "",
            "RAISING RATES",
            "  When prices rise faster than the Fed's 2% inflation target,",
            "  spending power falls. Raising the FFR makes borrowing and",
            "  investing more expensive, which lowers demand and, in theory,",
            "  brings inflation back down.",
            "",
            "LOWERING RATES",
            "  When unemployment is high and spending is low, cheaper borrowing",
            "  encourages people and businesses to spend and invest, which",
            "  stimulates growth.",
          ],
          required: true,
        },
      ],
      source: SOURCES.rates,
      xp: 25,
      next: "f3a3-fed-quiz",
    },

    "f3a3-fed-quiz": {
      id: "f3a3-fed-quiz",
      type: "quiz",
      title: "Knowledge check: why rates go up",
      speaker: "Marcus Ellery",
      avatar: "user",
      location: "Riverbend Credit Union",
      text: [
        "\"Every time the news says the Fed raised rates, my savings account pays a bit more and my card gets worse,\" Marcus says. \"Why do they do it?\"",
      ],
      question: "Why would the Federal Reserve raise interest rates?",
      options: [
        {
          label: "Prices are rising faster than the 2% target, so making borrowing costlier lowers demand",
          correct: true,
          feedback:
            "Correct. Higher rates make borrowing and investing more expensive, so people and businesses do less of both. Less demand should slow price rises. It's a blunt instrument aimed at inflation, not at your credit card, though your card feels it.",
        },
        {
          label: "To increase the government's income from interest payments",
          correct: false,
          feedback:
            "The Fed isn't raising revenue. The FFR is a tool for balancing the economy and the money supply, not a charge levied for income.",
        },
        {
          label: "Unemployment is high and spending needs stimulating",
          correct: false,
          feedback:
            "That's the case for *lowering* rates. Cheaper borrowing encourages spending and investment when the economy needs stimulating.",
        },
        {
          label: "To make savings accounts more attractive to consumers",
          correct: false,
          feedback:
            "Better savings rates are a side effect rather than the aim. The target is inflation.",
        },
      ],
      source: SOURCES.rates,
      xp: 25,
      next: "f3a3-insurance-terminal",
    },

    /* ---------------- 3. insurance ---------------- */
    "f3a3-insurance-terminal": {
      id: "f3a3-insurance-terminal",
      type: "terminal",
      title: "LEDGER: the three parts of any policy",
      speaker: "LEDGER",
      avatar: "terminal",
      location: "Coaching desk 2",
      text: [
        "\"Health, auto, home, life, business. Different products, same three moving parts,\" Nia says. \"Learn the parts and you can read any of them.\"",
      ],
      prompt: "Run the policy command on LEDGER.",
      host: "member@riverbend-cu",
      commands: [
        {
          id: "policy",
          cmd: "insurance --anatomy",
          output: [
            "PREMIUM",
            "  Typically the monthly cost. Priced on the insurer's view of how",
            "  likely you are to claim. Auto weighs age, location, driving",
            "  history and creditworthiness. Home weighs property value,",
            "  belongings, location and claim history. Health weighs age, sex,",
            "  health status and coverage level. Life weighs age, sex, health,",
            "  tobacco use and coverage amount.",
            "  Insurers price the same policy differently. Compare.",
            "",
            "POLICY LIMIT",
            "  The most the insurer will pay: per year, per term, per loss, or",
            "  across the policy's lifetime. Higher limits, higher premium. For",
            "  life insurance this is the face value, paid to your beneficiary.",
            "",
            "DEDUCTIBLE",
            "  What you pay before the insurer pays anything. It exists to stop",
            "  a flood of small claims. Higher deductible, cheaper premium.",
          ],
          required: true,
        },
      ],
      source: SOURCES.insurance,
      xp: 30,
      next: "f3a3-deductible-reveal",
    },

    "f3a3-deductible-reveal": {
      id: "f3a3-deductible-reveal",
      type: "reveal",
      title: "The claim, worked through",
      speaker: "Nia Barros",
      avatar: "compass",
      location: "Riverbend Credit Union",
      text: [
        "\"You've had a wreck. The repair comes to $4,000 and your policy carries a $2,000 deductible,\" Nia says.",
        "\"Before anything else happens, how much of that is yours?\"",
      ],
      question: "$4,000 of damage, $2,000 deductible. What do you pay?",
      options: ["Nothing", "$1,000", "$2,000", "$4,000"],
      answerIndex: 2,
      value: "$2,000",
      caption: "You pay the deductible, then the insurer pays the remaining $2,000.",
      explain:
        "You pay the $2,000 deductible and the insurer covers the other $2,000. This is why a cheap premium with a very high deductible can be a trap: the monthly cost looks great right up until you have to find the deductible in one go. Pick a deductible you could actually produce on the day you need it.",
      source: SOURCES.insurance,
      xp: 30,
      next: "f3a3-cover-quiz",
    },

    "f3a3-cover-quiz": {
      id: "f3a3-cover-quiz",
      type: "quiz",
      title: "Knowledge check: what home insurance leaves out",
      speaker: "Nia Barros",
      avatar: "compass",
      location: "Riverbend Credit Union",
      text: [
        "\"Two disasters are missing from a standard home policy, and people find out at the worst possible moment,\" Nia says.",
      ],
      question: "Which of these is NOT covered by standard home insurance?",
      options: [
        {
          label: "Flood and earthquake damage",
          correct: true,
          feedback:
            "Correct, and it catches people out badly. Both need separate coverage. If you live somewhere either is plausible, that is a policy you buy on purpose, not one you assume you already have.",
        },
        {
          label: "Theft of your belongings",
          correct: false,
          feedback:
            "Theft is covered by a standard home policy, along with your property and personal belongings.",
        },
        {
          label: "Vandalism",
          correct: false,
          feedback:
            "Vandalism is covered. It's flood and earthquake that sit outside a standard policy.",
        },
        {
          label: "Damage from a storm",
          correct: false,
          feedback:
            "Storm damage is generally covered. Flooding is the exclusion, which is a distinction worth checking with your insurer.",
        },
      ],
      source: SOURCES.insurance,
      xp: 25,
      next: "f3a3-renters-choice",
    },

    "f3a3-renters-choice": {
      id: "f3a3-renters-choice",
      type: "choice",
      title: "The letter from the landlord",
      speaker: "Marcus Ellery",
      avatar: "user",
      location: "Riverbend Credit Union",
      text: [
        "\"My lease says I need renters insurance,\" Marcus says. \"It's about fifteen dollars a month and I don't own anything worth stealing. Can I just ignore it?\"",
      ],
      prompt: "Pick what you'd tell him.",
      options: [
        {
          label: "Buy it. If you don't, the landlord can buy cover and bill you for it.",
          next: "f3a3-ending",
          xp: 25,
          tone: "good",
          feedback:
            "Correct, and that's the part people miss. A landlord or mortgage lender can take out cover on your behalf and charge you, almost always at a worse price than you'd have found yourself. Shopping around for fifteen dollars a month beats being assigned a policy you didn't choose.",
        },
        {
          label: "Ignore it. Enforcing it would cost the landlord more than it's worth.",
          next: "f3a3-ending",
          xp: 5,
          tone: "bad",
          feedback:
            "They don't have to enforce it in court. They can simply buy the cover and add it to what you owe, at a price you had no say in.",
        },
        {
          label: "Skip it and put the fifteen a month into savings instead.",
          next: "f3a3-ending",
          xp: 5,
          tone: "bad",
          feedback:
            "Reasonable instinct, wrong here. It's a lease condition, so the choice isn't between insurance and savings, it's between a policy you picked and one picked for you and billed on.",
        },
      ],
      source: SOURCES.insurance,
    },

    /* ---------------- 4. close ---------------- */
    "f3a3-ending": {
      id: "f3a3-ending",
      type: "ending",
      title: "Unit 3 complete",
      speaker: "Nia Barros",
      avatar: "compass",
      location: "Riverbend Credit Union, 17:20",
      text: [
        "\"Three things to keep,\" Nia says. \"A higher bracket only taxes the dollars above the line, so take the raise. A credit beats a deduction of the same size, every time.\"",
        "\"And a big refund isn't a win, it's a year of lending your own wages out at nothing. Get the withholding close and keep the money where it earns.\"",
        "Nia signs your Unit 3 completion certificate. \"Taxes, interest, insurance. The unpleasant three, and you've done them.\"",
      ],
      xp: 20,
      badge: "fin-unit3-certified",
      next: null,
    },
  },
};

export default act3;
