// gameConfig.js
// Single source of truth for all game content.
// Commentary arrays are the "funny guide" hook — add/edit freely.

export const gameConfig = {
  cs: {
    phases: [
      "Kdo?",
      "S kým?",
      "Co dělali?",
      "Kde?",
      "Kdy?",
      "Proč?",
    ],
    fallbacks: [
      ["Karel Gott", "Babička", "Prezident"],
      ["s mimozemšťanem", "s medvědem", "se psem"],
      ["tancovali salsu", "jedli knedlíky", "opravovali traktor"],
      ["na Pražském hradě", "v lese", "v supermarketu"],
      ["o půlnoci", "v neděli ráno", "za bouřky"],
      ["kvůli daňovým únikům", "protože jim došlo pivo", "z čisté nudy"],
    ],

    // ── Commentary hook ───────────────────────────────────────────────────
    // Keys: "flawless" (avg ≥ 2.8), "great" (≥ 2.0), "meh" (≥ 1.3), "rough" (< 1.3)
    // "unanimous" fires when all votes are identical regardless of score.
    // Add as many strings as you want — one is picked at random each round.
    commentary: {
      flawless: [
        "Absolutní mistrovství. Toto se bude vyprávět vnukům.",
        "Pulitzerova cena za literaturu zamíří jinam. Toto je vyšší umění.",
        "Takový příběh se rodí jednou za generaci. Nebo za promile.",
        "Historicky přesné. Minimálně tři vteřiny to dávalo smysl.",
      ],
      great: [
        "Solidní práce. Máma by byla hrdá. Nebo vyděšená.",
        "Toto mělo hlavu i patu. Neobvyklé, ale oceňujeme.",
        "Někde tam byl zárodek smyslu. Vzácný jev.",
        "Lepší než polovina českých telenovel. A to není výsměch.",
      ],
      meh: [
        "Hmmm. Kreativní. To je ta slušná verze.",
        "Někde se to zvrtlo. Ale přesně v jakém momentě — to je otázka filozofická.",
        "Rozhodně originální. Jednoduché jako řešení na žádné jiné problémy.",
        "Soudní znalec by potřeboval přestávku na kávu.",
      ],
      rough: [
        "No… alespoň jste se snažili. Nebo ne? Těžko říct.",
        "Toto je důvod, proč existují redaktoři. A psychologové.",
        "AI by to napsala lépe. A to AI nemá prsty.",
        "Tohle přeložit nedokážu. Ani do češtiny.",
      ],
      unanimous: [
        "Jednohlasně! Buď geniální, nebo stejně zmatení — oba výsledky platí.",
        "Všichni hlasovali stejně. Skupinová psychóza potvrzena.",
        "Shoda panuje. Demokratický proces v plné kráse.",
      ],
      // ── Per-phase teasers shown BEFORE the answer is revealed ──────────
      // Shown during the 3-second "drumroll" before sentence appears.
      // Leave empty arrays to skip the drumroll line.
      teasers: [
        "A takže... kdo to vlastně byl?",
        "S kým? No tohle jste nečekali...",
        "Co dělali? Připravte se...",
        "Kde? Tohle místo nikdo nečekal...",
        "Kdy? Načasování je všechno...",
        "Proč? Filozofická otázka věků...",
      ],
    },
  },

  en: {
    phases: [
      "Who?",
      "Met Who?",
      "What did they do?",
      "Where?",
      "When?",
      "And the consequence was...",
    ],
    fallbacks: [
      ["Batman", "The Pope", "Gordon Ramsay"],
      ["a crying baby", "a ninja", "the postman"],
      ["argued about cheese", "did the worm", "filed for bankruptcy"],
      ["in an Ikea ball pit", "on the moon", "at a Lidl self-checkout"],
      ["at 3am on a Tuesday", "during a tax audit", "right after brunch"],
      [
        "everyone got a fine",
        "it went viral for the wrong reasons",
        "nobody spoke of it again",
      ],
    ],

    commentary: {
      flawless: [
        "Pulitzer committee, take notes. This is literature.",
        "Shakespeare is spinning in his grave — with envy.",
        "Historically accurate. For at least three seconds.",
        "This is the content the internet was built for.",
      ],
      great: [
        "Solid effort. Mum would be proud. Or concerned. Both valid.",
        "There was a beginning, middle, and end. Rare and appreciated.",
        "Better than half the films on Netflix. Not a high bar, but still.",
        "A coherent narrative almost emerged. Almost.",
      ],
      meh: [
        "Hmm. Bold choice. That's the polite version.",
        "Somewhere in there was a story. It didn't survive.",
        "Creative in the way a car crash is creative.",
        "A forensic linguist would need the afternoon off after this.",
      ],
      rough: [
        "Well... you tried. Probably. Hard to tell.",
        "This is why editors exist. And therapists.",
        "An AI would have done better. And AI has no soul.",
        "I've translated menus at airports that made more sense.",
      ],
      unanimous: [
        "Unanimous! Either genius or equally confused — both apply.",
        "Everyone voted the same. Democracy at its finest.",
        "Full agreement. The hive mind has spoken.",
      ],
      teasers: [
        "And so... who was it?",
        "Met who? You won't see this coming...",
        "What did they do? Brace yourselves...",
        "Where? Nobody expected this location...",
        "When? Timing is everything...",
        "And the consequence? The universe weeps...",
      ],
    },
  },
};

// ─── Commentary selector (used by server.js) ──────────────────────────────────
// Extend this function to add more sophisticated commentary logic later.
// e.g. you could check specific phrase content, add player-name call-outs, etc.

export function pickCommentary(lang, avgScore, allVotesSame) {
  const c = gameConfig[lang].commentary;

  let pool;
  if (allVotesSame) {
    pool = c.unanimous;
  } else if (avgScore >= 2.8) {
    pool = c.flawless;
  } else if (avgScore >= 2.0) {
    pool = c.great;
  } else if (avgScore >= 1.3) {
    pool = c.meh;
  } else {
    pool = c.rough;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickTeaser(lang, phaseIndex) {
  const teasers = gameConfig[lang].commentary.teasers;
  if (!teasers || !teasers[phaseIndex]) return null;
  return teasers[phaseIndex];
}
