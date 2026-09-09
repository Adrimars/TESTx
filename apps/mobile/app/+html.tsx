import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Customizes the root HTML document for the static web export (18.5) - this is expo-
 * router's documented extension point for it; there is no separate index.html template
 * to hand-edit. Only this file's own output ever reaches the browser before any React
 * code runs, so the manifest link, theme-color, and service worker registration all have
 * to live here rather than in a component.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="theme-color" content="#0B0B0E" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/icon-192.png" />
        {/* Gives a root ScrollView the full-height behaviour it has on native, which
            react-native-web does not set up on its own. */}
        <ScrollViewStyleReset />
        <script
          // Registered from the shell itself rather than app code, so a page that never
          // finishes hydrating (offline, a broken deploy) still gets a service worker.
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
