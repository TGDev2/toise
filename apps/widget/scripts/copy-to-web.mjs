// Copie le bundle construit vers apps/web/public, servi tel quel par Next.js
// en tant qu'asset statique — aucune route ni infrastructure supplémentaire.
// `fs.copyFileSync` plutôt qu'un `cp` shell : ce script tourne aussi sous
// Windows/PowerShell, où `cp` n'existe pas nativement.
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '..', 'dist', 'chiffreo-widget.js');
const destination = resolve(
  here,
  '..',
  '..',
  'web',
  'public',
  'chiffreo-widget.js',
);

copyFileSync(source, destination);
console.log(`chiffreo-widget.js copié vers ${destination}`);
