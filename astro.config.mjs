import { defineConfig } from 'astro/config';

// Static site, deployed to GitHub Pages under the custom domain.
export default defineConfig({
  site: 'https://jiuhuweisi.me',
  output: 'static',
  compressHTML: true,
  build: {
    format: 'directory',
  },
});
