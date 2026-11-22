// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Replace with the real domain before launch. Badge links and share links are built from it.
  site: 'https://whistle.example',
  trailingSlash: 'ignore',
  // Hide Astro's dev toolbar (Menu / Inspect / Audit / Settings). The dev server is
  // exposed publicly via the Cloudflare Tunnel, so visitors would otherwise see it.
  devToolbar: { enabled: false },
  server: {
    // Bind to all interfaces (IPv4 + IPv6) so localhost/127.0.0.1 both work —
    // cloudflared's `http://localhost:PORT` ingress resolves to either.
    host: '0.0.0.0',
  },
  vite: {
    server: {
      // Vite's dev server rejects requests whose Host header isn't recognized.
      // Traffic arrives here via the whistle.ing Cloudflare Tunnel, so allow it.
      allowedHosts: ['whistle.ing', 'www.whistle.ing'],
    },
  },
});
