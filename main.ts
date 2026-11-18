// Astral Vanguard — program penyerahan (Node 22, pustaka standar saja).
//
// Game-nya adalah folder game/ di sebelah file ini: file statis polos yang dimuat
// browser desktop secara offline (game/index.html beserta modul ES-nya, tanpa
// pustaka dan tanpa satu pun permintaan jaringan). Program ini menyerahkan game
// itu: menyalin game/ dan screenshots/ ke direktori output lalu menulis
// dossier.json — ringkasan yang dibaca juri — lewat pustaka make.fun yang
// di-vendor di vendor/makefun-game.ts.
//
// Di luar kontainer grader, MAKEFUN_OUTPUT_DIR menggantikan /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// Batas milik scorer sendiri (reference/gate.json): hanya text_max_bytes yang
// membentuk byte dossier; batas lain menolak entri yang memang akan ditolak
// scorer (lebih dari 4 screenshot atau satu di atas 256 KiB; game/ lebih dari
// 993 entri atau 48 MiB, atau path di bawah game/ lebih dari 1000 byte).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
