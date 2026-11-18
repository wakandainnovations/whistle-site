// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Replace with the real domain before launch. Badge links and share links are built from it.
  site: 'https://whistle.example',
  trailingSlash: 'ignore',
});
