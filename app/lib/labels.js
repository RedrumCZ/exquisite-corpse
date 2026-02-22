// app/lib/labels.js
// All UI text for both languages. Import with:
//   import { GAME_LABELS } from "../lib/labels";
//   const t = GAME_LABELS[lang];

export const GAME_LABELS = {
  en: {
    // ── Per-phase example hints shown below each prompt ───────────────────
    phaseHints: [
      'e.g. "A ghost", "Gordon Ramsay", "My neighbour"',
      'e.g. "met a tired programmer", "met the Pope"',
      'e.g. "at a crowded bus stop", "in an Ikea ball pit"',
      'e.g. "they started a revolution", "they filed for divorce"',
      'e.g. "and the world changed forever", "and nobody spoke of it again"',
    ],

    // ── Lobby ──────────────────────────────────────────────────────────────
    shareCode:        "Share this code with your friends 📱",
    waitingForHost:   "⏳ Waiting for host to start…",
    startGame:        "🚀 Start Game",
    waitingPlayers:   (n) => `Waiting for players… (${n}/2 min)`,
    needTwoPlayers:   "Need at least 2 players to start.",
    lang:             "🇬🇧 English",

    // ── Input phase ────────────────────────────────────────────────────────
    question:         (cur, total) => `Question ${cur} of ${total}`,
    hiddenHint:       "🔒 Other players can't see your answer",
    answerPlaceholder:"Type your answer…",
    lockIn:           "🔒 Lock In Answer",
    lockingIn:        "Locking in…",
    answerLocked:     "Answer locked!",
    waitingFor:       (n) => `Waiting for ${n} more player${n !== 1 ? "s" : ""}…`,

    // ── Review phase ───────────────────────────────────────────────────────
    story:            (cur, total) => `Story ${cur} / ${total}`,
    rateThis:         "Rate this story:",
    waitingVote:      (stars) => `You voted ${"⭐".repeat(stars)} — waiting for others…`,
    timesUp:          "Time's up! Tallying votes…",
    drumroll:         "🥁 …",
    getReady:         "⏳ Get ready…",
    votesCast:        (n) => `VOTES (${n} cast)`,
    average:          (n) => `Average: ${n} ⭐`,
    finalScores:      "FINAL SCORES",
    scoresSoFar:      "SCORES SO FAR",
    finalResults:     "🏆 Calculating final results…",
    nextStory:        "⏭ Next story coming up…",

    // ── Final results ──────────────────────────────────────────────────────
    winner:           "wins this round!",
    thatsYou:         "That's you! 🎉",
    finalLeaderboard: "FINAL LEADERBOARD",
    showStories:      "📖 Show all stories",
    hideStories:      "▲ Hide stories",
    playAgain:        "🔄 Next Round",
    backHome:         "🏠 Back to Home",
    you:              "(you)",
    waitingNextRound: "Waiting for host to start the next round…",

    // ── Connection ─────────────────────────────────────────────────────────
    connecting:       "⏳ Connecting to server… (first load may take ~30s)",
    connected:        "✅ Connected",
    notConnected:     "Not connected to server yet — please wait.",

    // ── Home screen ────────────────────────────────────────────────────────
    title:            "Consequences",
    subtitle:         "The absurdist party game",
    createRoom:       "🏠 Create Room",
    joinRoom:         "🚪 Join Room",
    createTitle:      "Create a Room",
    joinTitle:        "Join a Room",
    namePlaceholder:  "Your name",
    codePlaceholder:  "ROOM CODE",
    langLabel:        "Game language",
    startCreate:      "✅ Create Room",
    startJoin:        "🚀 Join Game",
    creating:         "Creating…",
    joining:          "Joining…",
    back:             "← Back",
    needName:         "Enter your name first.",
    needCode:         "Enter a 4-letter room code.",
    footer:           "Open on every player's phone · No app needed",
    loadingRoom:      "Loading room…",
  },

  cs: {
    // ── Per-phase example hints ────────────────────────────────────────────
    phaseHints: [
      'např. "Babička", "Robot", "Můj soused"',
      'např. "s Elonem Muskem", "s medvědem"',
      'např. "tancovali tango", "jedli guláš"',
      'např. "v jaderné elektrárně", "na záchodě"',
      'např. "protože pršelo", "o půlnoci"',
    ],

    // ── Lobby ──────────────────────────────────────────────────────────────
    shareCode:        "Pošli tento kód přátelům 📱",
    waitingForHost:   "⏳ Čekáme až hostitel spustí hru…",
    startGame:        "🚀 Spustit hru",
    waitingPlayers:   (n) => `Čekáme na hráče… (${n}/2 min)`,
    needTwoPlayers:   "Potřebujete alespoň 2 hráče.",
    lang:             "🇨🇿 Čeština",

    // ── Input phase ────────────────────────────────────────────────────────
    question:         (cur, total) => `Otázka ${cur} z ${total}`,
    hiddenHint:       "🔒 Ostatní tvoji odpověď neuvidí",
    answerPlaceholder:"Napiš svou odpověď…",
    lockIn:           "🔒 Potvrdit odpověď",
    lockingIn:        "Ukládám…",
    answerLocked:     "Odpověď uložena!",
    waitingFor:       (n) => `Čekáme na ${n} ${n === 1 ? "hráče" : "hráče"}…`,

    // ── Review phase ───────────────────────────────────────────────────────
    story:            (cur, total) => `Příběh ${cur} / ${total}`,
    rateThis:         "Ohodnoť tento příběh:",
    waitingVote:      (stars) => `Hlasoval/a jsi ${"⭐".repeat(stars)} — čekáme na ostatní…`,
    timesUp:          "Čas vypršel! Sčítáme hlasy…",
    drumroll:         "🥁 …",
    getReady:         "⏳ Připrav se…",
    votesCast:        (n) => `HLASY (${n} celkem)`,
    average:          (n) => `Průměr: ${n} ⭐`,
    finalScores:      "KONEČNÉ SKÓRE",
    scoresSoFar:      "SKÓRE ZATÍM",
    finalResults:     "🏆 Vyhodnocuji výsledky…",
    nextStory:        "⏭ Další příběh za chvíli…",

    // ── Final results ──────────────────────────────────────────────────────
    winner:           "vyhrává!",
    thatsYou:         "To jsi ty! 🎉",
    finalLeaderboard: "KONEČNÉ POŘADÍ",
    showStories:      "📖 Zobrazit všechny příběhy",
    hideStories:      "▲ Skrýt příběhy",
    playAgain:        "🔄 Další kolo",
    backHome:         "🏠 Zpět domů",
    you:              "(ty)",
    waitingNextRound: "Čekáme až hostitel spustí další kolo…",

    // ── Connection ─────────────────────────────────────────────────────────
    connecting:       "⏳ Připojuji se… (první start může trvat ~30s)",
    connected:        "✅ Připojeno",
    notConnected:     "Ještě nejsem připojen — chvíli počkej.",

    // ── Home screen ────────────────────────────────────────────────────────
    title:            "Kdo s kým",
    subtitle:         "Absurdní párty hra",
    createRoom:       "🏠 Vytvořit místnost",
    joinRoom:         "🚪 Připojit se",
    createTitle:      "Vytvořit místnost",
    joinTitle:        "Připojit se",
    namePlaceholder:  "Tvoje jméno",
    codePlaceholder:  "KÓD MÍSTNOSTI",
    langLabel:        "Jazyk hry",
    startCreate:      "✅ Vytvořit",
    startJoin:        "🚀 Připojit se",
    creating:         "Vytvářím…",
    joining:          "Připojuji…",
    back:             "← Zpět",
    needName:         "Nejdřív zadej jméno.",
    needCode:         "Zadej 4-písmenný kód místnosti.",
    footer:           "Otevři na každém telefonu · Žádná instalace",
    loadingRoom:      "Načítám místnost…",
  },
};
