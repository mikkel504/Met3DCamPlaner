import { defineConfig } from 'vite';

// base muss exakt dem Repo-Namen auf GitHub entsprechen (Groß-/Kleinschreibung
// wie dort), sonst laufen die Assets auf GitHub Pages nicht.
// Siehe AGENTS.md Abschnitt 3.
export default defineConfig({
  base: '/Met3DCamPlaner/',
  build: {
    target: 'es2022',
  },
});
