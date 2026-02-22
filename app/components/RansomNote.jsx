// app/components/RansomNote.jsx
// Renders a single assembled sentence as a "ransom note" collage,
// captures it with html2canvas, and shares via the native Web Share API.
//
// Props:
//   sentence    — string[]   e.g. ["Batman", "met a ninja", "in an Ikea ball pit"]
//   phaseLabels — string[]   parallel array of phase names for tooltip/alt text
//   lang        — "cs" | "en"
"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import html2canvas from "html2canvas";

// ─── Design Tokens ────────────────────────────────────────────────────────────
// Each phase slot gets a pinned font + colour so the note looks consistent
// between the live review screen and the final shareable image.

const FONTS = [
  "'Abril Fatface', serif",
  "'Permanent Marker', cursive",
  "'Lobster', cursive",
  "'Pacifico', cursive",
  "'Playfair Display', serif",
  "'Bangers', cursive",
];

const COLORS = [
  "#c0392b", // deep red
  "#1a5276", // navy
  "#6c3483", // purple
  "#784212", // brown
  "#0e6655", // teal
  "#1e3799", // blue
];

// Slight random-ish rotation per slot (deterministic on index so it's stable)
function slotRotation(index) {
  const angles = [2, -1.5, 3, -2.5, 1, -3, 2.5, -1, 1.5, -2];
  return angles[index % angles.length];
}

function getSlotStyle(index) {
  return {
    fontFamily: FONTS[index % FONTS.length],
    color: COLORS[index % COLORS.length],
    fontSize: `${1.35 + (index % 3) * 0.22}rem`,
    display: "inline-block",
    padding: "0.1em 0.35em",
    lineHeight: 1.2,
    transform: `rotate(${slotRotation(index)}deg)`,
    verticalAlign: "middle",
    background: index % 4 === 0 ? "rgba(255,255,100,0.18)" : "transparent",
    borderRadius: "3px",
  };
}

// ─── Share State Labels ───────────────────────────────────────────────────────

const SHARE_LABELS = {
  en: {
    idle:      "📤 Share",
    capturing: "✏️ Rendering…",
    sharing:   "📡 Sharing…",
    done:      "✅ Shared!",
    error:     "❌ Try again",
    download:  "💾 Save image",
  },
  cs: {
    idle:      "📤 Sdílet",
    capturing: "✏️ Renderuji…",
    sharing:   "📡 Sdílím…",
    done:      "✅ Hotovo!",
    error:     "❌ Zkus znovu",
    download:  "💾 Uložit obrázek",
  },
};

const SHARE_TEXT = {
  en: { title: "Consequences 🎲", text: "Look what happened! 😂" },
  cs: { title: "Kdo s kým 🎲",    text: "Podívej co se stalo! 😂" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function RansomNote({ sentence, phaseLabels, lang = "en" }) {
  const noteRef  = useRef(null);
  const [status, setStatus]   = useState("idle");   // idle | capturing | sharing | done | error
  const [canShare, setCanShare] = useState(false);

  // Feature-detect Web Share API on mount (avoids SSR mismatch)
  useEffect(() => {
    setCanShare(
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    );
  }, []);

  const handleShare = useCallback(async () => {
    if (!noteRef.current || status === "capturing" || status === "sharing") return;

    setStatus("capturing");

    try {
      // 1. Wait for all Google Fonts to finish loading so html2canvas
      //    doesn't capture fallback system fonts.
      await document.fonts.ready;

      // 2. Render the DOM node to an offscreen canvas.
      const canvas = await html2canvas(noteRef.current, {
        backgroundColor: "#fdf6e3",
        scale: 2,           // retina quality
        useCORS: true,
        logging: false,
        // Ensure the rotated fragments aren't clipped
        windowWidth: noteRef.current.scrollWidth + 60,
      });

      // 3. Canvas → PNG Blob
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png"
        );
      });

      const file = new File([blob], "consequences.png", { type: "image/png" });
      const { title, text } = SHARE_TEXT[lang] ?? SHARE_TEXT.en;

      setStatus("sharing");

      // 4a. Web Share API (mobile — opens the native share sheet)
      if (canShare && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        setStatus("done");

      // 4b. Fallback — trigger a browser download
      } else {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href     = url;
        a.download = "consequences.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatus("done");
      }

    } catch (err) {
      // AbortError = user cancelled the share sheet — not a real error
      if (err?.name === "AbortError") {
        setStatus("idle");
      } else {
        console.error("[RansomNote] share error:", err);
        setStatus("error");
      }
    }
  }, [status, canShare, lang]);

  // Reset error state so user can retry
  function handleClick() {
    if (status === "error") setStatus("idle");
    else handleShare();
  }

  const labels = SHARE_LABELS[lang] ?? SHARE_LABELS.en;
  const btnLabel = labels[status] ?? labels.idle;
  const isBusy   = status === "capturing" || status === "sharing";

  return (
    <div style={wrapperStyle}>

      {/* ── The "paper" — this DOM node is what html2canvas captures ── */}
      <div ref={noteRef} style={paperStyle}>

        {/* Tiny header stamp */}
        <div style={stampStyle}>
          {lang === "cs" ? "Kdo s kým" : "Consequences"}
        </div>

        {/* Sentence fragments */}
        <div style={sentenceRowStyle}>
          {sentence.map((fragment, i) => (
            <span
              key={i}
              style={getSlotStyle(i)}
              title={phaseLabels?.[i] ?? ""}
            >
              {fragment}
            </span>
          ))}
        </div>

        {/* Phase label trail at the bottom */}
        {phaseLabels && (
          <div style={trailStyle}>
            {phaseLabels.join(" · ")}
          </div>
        )}

        {/* Watermark */}
        <div style={watermarkStyle}>🎲 kdo-s-kym.app</div>
      </div>

      {/* ── Share button — sits OUTSIDE the capture zone ── */}
      <button
        onClick={handleClick}
        disabled={isBusy}
        style={{ ...shareButtonStyle, opacity: isBusy ? 0.55 : 1 }}
        aria-live="polite"
        aria-label={btnLabel}
      >
        {btnLabel}
      </button>

    </div>
  );
}

// ─── Static Styles ────────────────────────────────────────────────────────────

const wrapperStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1rem",
  width: "100%",
};

const paperStyle = {
  background: "#fdf6e3",
  border: "2px solid #d9c9a8",
  borderRadius: "6px",
  boxShadow: "4px 6px 18px rgba(0,0,0,0.28), inset 0 0 40px rgba(0,0,0,0.04)",
  padding: "1.75rem 1.5rem 1.25rem",
  maxWidth: "600px",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1rem",
  // Slight paper tilt for character — html2canvas captures this correctly
  transform: "rotate(-0.6deg)",
  position: "relative",
  // Subtle paper grain via a repeating gradient
  backgroundImage:
    "linear-gradient(rgba(0,0,0,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.015) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  backgroundColor: "#fdf6e3",
};

const stampStyle = {
  fontFamily: "'Bangers', cursive",
  fontSize: "0.7rem",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "#bbb",
  alignSelf: "flex-start",
};

const sentenceRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.15rem",
  textAlign: "center",
  padding: "0.5rem 0",
};

const trailStyle = {
  fontFamily: "monospace",
  fontSize: "0.58rem",
  color: "#ccc",
  letterSpacing: "0.08em",
  textAlign: "center",
  marginTop: "0.25rem",
};

const watermarkStyle = {
  fontFamily: "monospace",
  fontSize: "0.58rem",
  color: "#d0c8b8",
  alignSelf: "flex-end",
};

const shareButtonStyle = {
  fontFamily: "'Bangers', cursive",
  fontSize: "1.25rem",
  letterSpacing: "0.06em",
  background: "#c0392b",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  padding: "0.65em 2em",
  cursor: "pointer",
  transition: "opacity 0.2s",
  boxShadow: "2px 3px 10px rgba(0,0,0,0.22)",
  maxWidth: "600px",
  width: "100%",
};
