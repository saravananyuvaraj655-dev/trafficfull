// app/layout.js
import "leaflet/dist/leaflet.css";

export const metadata = {
  title: "Coimbatore Traffic Prediction",
  description: "AI-based Traffic & Route Navigation System",
  manifest: "/manifest.json",
  themeColor: "#1976d2",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1976d2" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          width: "100%",
          height: "100%",
        }}
      >
        {children}
      </body>
    </html>
  );
}
