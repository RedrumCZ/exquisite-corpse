// app/layout.js
// viewport must be a SEPARATE export from metadata in Next.js 14+

export const metadata = {
  title: "Kdo s kým · Consequences",
  description: "A bilingual absurdist party game for mobile browsers.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1a1a2e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Bangers&family=Lobster&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,700;1,700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎲</text></svg>"
        />
      </head>
      <body style={bodyStyle}>{children}</body>
    </html>
  );
}

const bodyStyle = {
  margin: 0,
  padding: 0,
  minHeight: "100vh",
  background: "#1a1a2e",
  color: "#eee",
  fontFamily: "system-ui, sans-serif",
  overscrollBehavior: "none",
  WebkitFontSmoothing: "antialiased",
};
