"use strict";
/* Oustory — holy-day observance guides.
   For every holy day the published calendar can present, this gives the
   verses that explain the day and how the day is kept. The guides are
   keyed to the day's NAME as the calendar publishes it (Sabbath, New Moon,
   or a feast title from the published events list) — a guide only ever
   surfaces on a date the published calendar itself names. No date is
   computed or invented here; draft calendar projections are never read.
   Verse rows carry references and what the passage establishes — the
   reader's own text is one tap away, never paraphrased as a quote. */
(() => {
  const GUIDES = [
    {
      id: "sabbath",
      title: "Sabbath",
      names: ["Sabbath"],
      intro: "The seventh day from the new moon — lunar days 8, 15, 22 and 29 of every month. The day itself is the sign: rest, because the covenant rests on the count, not on a weekday.",
      verses: [
        { ref: "Exodus 20:8–11", book: "Exodus", chapter: 20, note: "The command itself — remember the Shabath day, keep it holy; six days of work, the seventh is rest." },
        { ref: "Exodus 31:13–17", book: "Exodus", chapter: 31, note: "The Shabath as the sign of the covenant between Yahawah and the children of Israel." },
        { ref: "Isaiah 58:13–14", book: "Isaiah", chapter: 58, note: "The day's own terms — turn your foot from your own pleasure and call the Shabath a delight." },
        { ref: "Psalm 92", book: "Psalms", chapter: 92, note: "A psalm for the Shabath day — the day's own song." }
      ],
      kept: [
        "No work — the week's labor is laid down from sunset to sunset",
        "The readings are forward: Exodus 20, Psalm 92, Isaiah 58",
        "Audio reads with Miles, chapter by chapter, as in the reader",
        "Study and Discover quiet down in the app until the day ends"
      ]
    },
    {
      id: "new-moon",
      title: "New Moon",
      names: ["New Moon"],
      intro: "Day 1 of the month. The count every Sabbath hangs on starts here — 8, 15, 22, 29 are all counted from this sighting.",
      verses: [
        { ref: "Psalm 81:3", book: "Psalms", chapter: 81, note: "Blow the trumpet at the new moon — the day is announced, not assumed." },
        { ref: "Numbers 10:10", book: "Numbers", chapter: 10, note: "The trumpets sound over the solemn days and the beginnings of months." },
        { ref: "Isaiah 66:23", book: "Isaiah", chapter: 66, note: "From one new moon to another, and from one Shabath to another — the reckoning endures." },
        { ref: "Numbers 28:11–15", book: "Numbers", chapter: 28, note: "The offerings appointed for the beginnings of the months." }
      ],
      kept: [
        "Mark the sighting — the new month begins, and the count resets",
        "Name the month's Sabbaths ahead: days 8, 15, 22, 29",
        "Read the trumpet passages; the day is a beginning, kept by counting from it"
      ]
    },
    {
      id: "passover",
      title: "Passover",
      names: ["Passover", "Pesach"],
      intro: "The memorial of the Exodus — the lamb, the bitter herbs, and unleavened bread, eaten in remembrance of the night Israel came out of Egypt.",
      verses: [
        { ref: "Exodus 12:1–20", book: "Exodus", chapter: 12, note: "The institution — the lamb chosen on the tenth day, eaten with bitter herbs and unleavened bread, nothing leavened in the houses." },
        { ref: "Exodus 12:8", book: "Exodus", chapter: 12, note: "The meal itself: roast flesh, unleavened bread, and bitter herbs, eaten that night." },
        { ref: "Leviticus 23:5", book: "Leviticus", chapter: 23, note: "The appointment — the fourteenth day of the first month, at evening." },
        { ref: "Deuteronomy 16:1–8", book: "Deuteronomy", chapter: 16, note: "Observe the month of Abib — eat unleavened bread with it, and remember the day you came out of Egypt all the days of your life." },
        { ref: "Numbers 9:2–14", book: "Numbers", chapter: 9, note: "The Passover kept in the wilderness, and the provision for the one who is unclean or on a journey." }
      ],
      kept: [
        "The lamb — roasted whole, not boiled; eaten the same night, none left to morning",
        "Bitter herbs on the plate — romaine, dill, and ginger among them, for the bitterness of Egypt",
        "Unleavened bread only — no leaven in the house",
        "Eaten in readiness, as a memorial — the story is told at the table"
      ],
      recipes: [
        {
          title: "Bitter herbs — the plate",
          lines: [
            "Romaine lettuce — the fresh leaf, served as it is; the classic bitter herb of the table",
            "Fresh dill — fronds laid with the herbs, and worked into the rubs below",
            "Fresh ginger — sliced or grated over the plate for heat and bitterness",
            "Exodus 12:8 names the pattern: the lamb, unleavened bread, and bitter herbs together"
          ]
        },
        {
          title: "Bitter-herb dry rub — for the lamb",
          lines: [
            "2 tbsp dried dill · 1 tbsp ground ginger · 2 tsp fine sea salt",
            "1 tsp black pepper · 1 tsp garlic powder · 1 tsp onion powder",
            "Stir the spices together. Pat the lamb dry, coat it on every side, and press the rub in",
            "Rest at least 1 hour — overnight is better — then roast as the chapter directs: with fire, not boiled"
          ]
        },
        {
          title: "Bitter-herb wet rub — for the lamb",
          lines: [
            "½ cup fresh dill, chopped fine · 2 tbsp fresh ginger, grated",
            "4 cloves garlic, crushed · 3 tbsp olive oil · 1 tbsp lemon juice · 2 tsp sea salt",
            "Work it all to a paste. Coat the lamb thickly and marinate 2 hours or more",
            "Roast, and serve with fresh romaine leaves on the side as the bitter herb"
          ]
        },
        {
          title: "Chapati — unleavened bread",
          lines: [
            "The Indian chapati is unleavened bread in its simplest form — flour, water, salt, fire",
            "2 cups whole wheat flour · ¾ cup warm water · ½ tsp salt · 1 tsp oil (optional)",
            "Knead 8–10 minutes to a soft dough. Rest 20 minutes, covered",
            "Divide into 8 balls, roll each thin and round",
            "Cook on a dry, hot skillet or tawa: bubbles rise, flip, and it puffs — press the edges gently. No yeast, no leaven, nothing to rise but steam"
          ]
        }
      ]
    },
    {
      id: "unleavened-bread",
      title: "Feast of Unleavened Bread",
      names: ["Unleavened"],
      intro: "Seven days joined to the Passover: leaven put out of the houses, and unleavened bread eaten every day — the bread of affliction, and of haste out of Egypt.",
      verses: [
        { ref: "Exodus 12:15–20", book: "Exodus", chapter: 12, note: "Seven days, no leaven found in the houses; unleavened bread eaten from the first day to the seventh." },
        { ref: "Leviticus 23:6–8", book: "Leviticus", chapter: 23, note: "The appointment — seven days of unleavened bread, with holy convocations on the first and seventh days." },
        { ref: "Deuteronomy 16:3–4", book: "Deuteronomy", chapter: 16, note: "The bread of affliction — eaten in remembrance of the flight from Egypt." }
      ],
      kept: [
        "Leaven is searched out and removed before the feast begins",
        "Unleavened bread at every meal for seven days — chapati serves here (see the Passover guide for the recipe)",
        "The first and seventh days are convocations — no servile work"
      ]
    },
    {
      id: "firstfruits",
      title: "Firstfruits",
      names: ["Firstfruits", "First Fruits"],
      intro: "The sheaf of the first harvest waved before Yahawah — the first of the ground given back before the rest is eaten.",
      verses: [
        { ref: "Leviticus 23:9–14", book: "Leviticus", chapter: 23, note: "The sheaf of the firstfruits waved on the morrow after the Shabath; no bread of the new harvest eaten until it is brought." },
        { ref: "Deuteronomy 26:1–11", book: "Deuteronomy", chapter: 26, note: "The basket of firstfruits brought with the confession — a Syrian ready to perish was my father." }
      ],
      kept: [
        "The first of the harvest is presented before any of it is eaten",
        "The count toward the Feast of Weeks begins from this day"
      ]
    },
    {
      id: "weeks",
      title: "Feast of Weeks",
      names: ["Weeks", "Shavuot", "Pentecost"],
      intro: "Fifty days counted from the Firstfruits sheaf — seven Sabbaths complete, then the feast of the harvest, and of the giving of the law.",
      verses: [
        { ref: "Leviticus 23:15–21", book: "Leviticus", chapter: 23, note: "The count itself — seven Sabbaths shall be complete, and the fiftieth day is the feast." },
        { ref: "Deuteronomy 16:9–12", book: "Deuteronomy", chapter: 16, note: "Seven weeks counted from the sickle in the corn; rejoice with your household, and remember you were a bondman in Egypt." },
        { ref: "Exodus 19–20", book: "Exodus", chapter: 19, note: "The mountain in the third month — the season of the feast is the season of the covenant words." }
      ],
      kept: [
        "Count the fifty days aloud, week by week, from the sheaf",
        "A freewill offering according to the blessing received",
        "Rejoice with the household — son, daughter, servant, Levite, stranger, fatherless, widow"
      ]
    },
    {
      id: "trumpets",
      title: "Feast of Trumpets",
      names: ["Trumpets", "Teruah"],
      intro: "The first day of the seventh month — a memorial of blowing of trumpets, a holy convocation, and the opening of the autumn feasts.",
      verses: [
        { ref: "Leviticus 23:23–25", book: "Leviticus", chapter: 23, note: "The appointment — a sabbath, a memorial of blowing of trumpets, no servile work." },
        { ref: "Numbers 29:1–6", book: "Numbers", chapter: 29, note: "The day of blowing the trumpets, and its offerings." },
        { ref: "Nehemiah 8:1–10", book: "Nehemiah", chapter: 8, note: "The first day of the seventh month kept with the reading of the law — this day is holy; mourn not, neither weep." }
      ],
      kept: [
        "The trumpets are blown — the month is announced aloud",
        "No servile work; a convocation",
        "The law is read to the assembly, as in Nehemiah's day"
      ]
    },
    {
      id: "atonement",
      title: "Day of Atonement",
      names: ["Atonement", "Kippur"],
      intro: "The tenth day of the seventh month — the most solemn day of the year. Souls are afflicted, no work is done in any form, and the sanctuary is cleansed.",
      verses: [
        { ref: "Leviticus 16", book: "Leviticus", chapter: 16, note: "The rite itself — the high priest, the two goats, and the cleansing of the sanctuary once a year." },
        { ref: "Leviticus 23:26–32", book: "Leviticus", chapter: 23, note: "The appointment — afflict your souls, do no work, from evening to evening." },
        { ref: "Numbers 29:7–11", book: "Numbers", chapter: 29, note: "The tenth day kept as a holy convocation, with its offerings." }
      ],
      kept: [
        "Afflict the soul — the day is kept with fasting",
        "No work at all — it is a Shabath of rest, evening to evening",
        "Read Leviticus 16 through; the day explains itself"
      ]
    },
    {
      id: "tabernacles",
      title: "Feast of Tabernacles",
      names: ["Tabernacles", "Sukkot", "Booths", "Ingathering"],
      intro: "Seven days from the fifteenth of the seventh month — Israel dwells in booths, remembering the wilderness, in the season of ingathering.",
      verses: [
        { ref: "Leviticus 23:33–43", book: "Leviticus", chapter: 23, note: "The appointment — seven days, booths made from the boughs of the land, 'that your generations may know that I made the children of Israel to dwell in booths.'" },
        { ref: "Deuteronomy 16:13–15", book: "Deuteronomy", chapter: 16, note: "Seven days after the gathering of the corn and wine — and you shall surely rejoice." },
        { ref: "Nehemiah 8:13–18", book: "Nehemiah", chapter: 8, note: "The booths built again in Jerusalem — on roofs, in courts, in the streets — for the first time since Joshua." }
      ],
      kept: [
        "Build the booth and dwell in it for the seven days",
        "The first day and the eighth day are convocations",
        "Rejoice with the whole household — the feast is commanded gladness"
      ]
    },
    {
      id: "purim",
      title: "Purim",
      names: ["Purim"],
      intro: "The days of Esther — the lot cast against Israel turned to deliverance, and the days of mourning made days of feasting and gladness.",
      verses: [
        { ref: "Esther 9:20–28", book: "Esther", chapter: 9, note: "The institution — Mordecai writes the days kept yearly, feasting and joy, sending portions and gifts to the poor." },
        { ref: "Esther 9:16–19", book: "Esther", chapter: 9, note: "The rest of the story — the day of rest after the victory, made a day of gladness and feasting." },
        { ref: "Esther 7", book: "Esther", chapter: 7, note: "Haman unmasked at the banquet — the turn of the whole book." }
      ],
      kept: [
        "Read the book of Esther through — the whole scroll, in assembly",
        "Send portions to one another, as the chapter appoints",
        "Gifts to the poor — Esther 9:22 names it as part of the day itself"
      ]
    }
  ];

  /* Match a published day's names to a guide. Feast titles match on any
     key word; Sabbath and New Moon match exactly. First match wins, in
     calendar name order. */
  function guideForNames(names) {
    for (const name of names || []) {
      for (const g of GUIDES) {
        if (g.names.some(k => name === k || name.includes(k))) return g;
      }
    }
    return null;
  }

  window.OustoryGuides = { list: GUIDES, guideForNames };
})();
