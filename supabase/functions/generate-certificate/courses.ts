/**
 * Which episodes a learner has to finish before a course certificate exists.
 *
 * This is the server's copy on purpose. The browser has its own list, but the
 * browser is the thing we are checking, so it does not get to define the bar.
 * If the two ever disagree, this one wins and the learner is told they are not
 * finished yet.
 */
export const COURSE_REQUIREMENTS: Record<
  string,
  { name: string; episodes: string[] }
> = {
  "financial-literacy": {
    name: "Financial Literacy",
    // Unit 3 (taxes) has never been written and is not playable, so requiring
    // it would make this certificate unobtainable. Add "fin-u3" here the day
    // that episode ships.
    episodes: ["fin-u1", "fin-u2", "fin-u4"],
  },
  cybersecurity: {
    name: "Cybersecurity",
    episodes: ["cyber-u1", "cyber-u2", "cyber-u3", "cyber-u4"],
  },
  neuroscience: {
    name: "Neuroscience",
    episodes: ["neuro-u1", "neuro-u2", "neuro-u3", "neuro-u4"],
  },
  startup: {
    name: "How to Build a Start Up",
    episodes: [
      "startup-u1",
      "startup-u2",
      "startup-u3",
      "startup-u4",
      "startup-u5",
      "startup-u6",
    ],
  },
};
