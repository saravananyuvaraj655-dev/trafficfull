import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme Color */}
        <meta name="theme-color" content="#0d47a1" />

        {/* App Name */}
        <meta name="application-name" content="Traffic Prediction System" />

        {/* Mobile Icons */}
        <link rel="apple-touch-icon" href="/icon-192.png" />

        {/* Mobile Support */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </Head>

      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}