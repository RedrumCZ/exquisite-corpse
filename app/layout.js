// app/layout.js
// Root layout — loads all Google Fonts needed by RansomNote.jsx and the game UI.
// Must be a Server Component (no "use client").

export const metadata = {
  title: "Kdo s kým · Consequences",
  description: "A bilingual absurdist party game for mobile browsers.",
  themeColor: "#1a1a2e",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* ── Preconnect for speed ── */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* ── All fonts used by RansomNote fragments + game UI ── */}
        <link
          href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Bangers&family=Lobster&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,700;1,700&display=swap"
          rel="stylesheet"
        />

        {/* ── Favicon placeholder ── */}
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎲</text></svg>" />
      </head>

      <body style={bodyStyle}>
        {children}
      </body>
    </html>
  );
}

// Inline style object so no external CSS file is required.
// CSS variables are defined here so every child component can use them.
const bodyStyle = {
  margin: 0,
  padding: 0,
  minHeight: "100vh",
  background: "#1a1a2e",
  color: "#eee",
  fontFamily: "system-ui, sans-serif",
  // Prevent iOS bounce scroll interfering with the game UI
  overscrollBehavior: "none",
  // Smooth font rendering on mobile
  WebkitFontSmoothing: "antialiased",
};
