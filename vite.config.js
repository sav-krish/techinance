import { defineConfig } from "vite";

export default defineConfig({
  // Project site: https://sav-krish.github.io/techinance/
  base: "/techinance/",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        about: "about.html",
        courses: "courses.html",
        faqs: "faqs.html",
        contact: "contact.html",
        privacy: "privacy.html",
        terms: "terms.html",
        learn: "learn.html",
        story: "story.html",
        getInvolved: "get-involved.html",
        profile: "profile.html",
        leaderboard: "leaderboard.html",
      },
    },
  },
});
