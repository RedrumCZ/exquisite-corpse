// gameConfig.js
// Single source of truth for all game content.
// 5 phases each, structured for grammatical correctness in both languages.

export const gameConfig = {
  cs: {
    // ── 5 phases, Czech nominative-first model ────────────────────────────
    // Result shape: [Podmět] + [Předmět] + [Sloveso] + [Místo] + [Doplněk]
    // Example: "Babička" + "s Elonem Muskem" + "tancovali tango" + "v jaderné elektrárně" + "protože pršelo"
    phases: [
      "Kdo / Co?",           // 1. Podmět (nominativ) — "Babička", "Robot"
      "S kým / S čím?",      // 2. Předmět (instrumentál) — "s Elonem Muskem", "s vysavačem"
      "Co dělali?",          // 3. Sloveso — "tancovali tango", "jedli guláš"
      "Kde?",                // 4. Místo — "v jaderné elektrárně", "na záchodě"
      "Proč / Kdy?",         // 5. Doplněk — "protože pršelo", "o půlnoci"
    ],
    fallbacks: [
      ["Babička", "Robot", "Karel Gott", "Prezident", "Mimozemšťan"],
      ["s Elonem Muskem", "s vysavačem", "s medvědem", "s duchy předků", "s pokladním v Lidlu"],
      ["tancovali tango", "jedli guláš", "opravovali traktor", "hráli šachy", "sledovali telenovelu"],
      ["v jaderné elektrárně", "na záchodě", "v Ikea", "na Pražském hradě", "ve výtahu"],
      ["protože pršelo", "o půlnoci", "kvůli daňovým únikům", "protože jim došlo pivo", "ve snu"],
    ],

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
      teasers: [
        "A kdo to vlastně byl?",
        "S kým? Tohle jste nečekali...",
        "Co dělali? Připravte se...",
        "Kde? Tohle místo nikdo nečekal...",
        "Proč nebo kdy? Filozofická otázka věků...",
      ],
    },
  },

  en: {
    // ── 5 phases, English strict S-V-O syntax ─────────────────────────────
    // Result shape: [Subject] + [met Object] + [Where] + [What they did] + [Consequence]
    // Example: "A ghost" + "met a tired programmer" + "at a crowded bus stop"
    //        + "they started a revolution" + "and the world changed forever"
    phases: [
      "Who?",                        // 1. Subject — "A ghost", "Batman"
      "Met whom?",                   // 2. Object — "met a tired programmer", "met the Pope"
      "Where?",                      // 3. Location — "at a crowded bus stop", "in a Lidl"
      "What did they do?",           // 4. Action — "they started a revolution", "they filed for divorce"
      "And the consequence was…",    // 5. Result — "and the world changed forever"
    ],
    fallbacks: [
      ["A ghost", "Batman", "Gordon Ramsay", "The Pope", "A crying accountant"],
      ["met a tired programmer", "met a ninja", "met the postman", "met a seagull named Dave", "met their landlord"],
      ["at a crowded bus stop", "in an Ikea ball pit", "on the moon", "at a Lidl self-checkout", "in a broken lift"],
      ["they started a revolution", "they filed for divorce", "they argued about cheese", "they did the worm", "they wrote a strongly-worded email"],
      ["and the world changed forever", "and nobody spoke of it again", "and it went viral for the wrong reasons", "and everyone got a fine", "and somehow it was on the news"],
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
        "I've translated airport menus that made more sense.",
      ],
      unanimous: [
        "Unanimous! Either genius or equally confused — both apply.",
        "Everyone voted the same. Democracy at its finest.",
        "Full agreement. The hive mind has spoken.",
      ],
      teasers: [
        "And so... who was it?",
        "Met who? You won't see this coming...",
        "Where? Nobody expected this location...",
        "What did they do? Brace yourselves...",
        "And the consequence? The universe weeps...",
      ],
    },
  },
};

// ─── Commentary selector ──────────────────────────────────────────────────────

export function pickCommentary(lang, avgScore, allVotesSame) {
  const c = gameConfig[lang]?.commentary ?? gameConfig.en.commentary;
  let pool;
  if (allVotesSame)    pool = c.unanimous;
  else if (avgScore >= 2.8) pool = c.flawless;
  else if (avgScore >= 2.0) pool = c.great;
  else if (avgScore >= 1.3) pool = c.meh;
  else                 pool = c.rough;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickTeaser(lang, phaseIndex) {
  const teasers = gameConfig[lang]?.commentary?.teasers ?? [];
  return teasers[phaseIndex] ?? null;
}
