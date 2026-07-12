/**
 * Sound Library Scanner
 *
 * Scans the configured sound library directories and generates:
 *   1. public/sounds/index.json — searchable manifest of all samples
 *   2. Copies/symlinks audio files into public/sounds/{library}/
 *
 * Run: node scripts/scanSoundLibraries.js
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { readdir, stat, symlink, copyFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_SOUNDS = path.join(ROOT, 'public', 'sounds');

// Sound library sources (relative paths from project root)
const LIBRARY_PATHS = {
  bass: [
    'sound libraries/bass/p bass',
    'sound libraries/bass/musicradar-extreme-bass-samples',
    'sound libraries/bass/Lyrical Distortion - `72 Jazz Bass Direct',
    'Deterministic Engine Soundbank/Bass',
  ],
  drums: [
    'Deterministic Engine Soundbank/drum kit 1',
    'Deterministic Engine Soundbank/drum kit 2',
  ],
  keys: [
    'sound libraries/FRONTLINE_VINTAGE_KEYS_2/VK2_CHORDS_AND_HITS',
  ],
  strings: [
    'sound libraries/Pulsed Records - World Series Gadulka Strings',
    'sound libraries/Wavesfactory.W.Acoustic.12.Strings.Pick.KONTAKT',
  ],
  xylophone: [
    'sound libraries/Wavesfactory.W-Xylophone.KONTAKT',
  ],
};

// Artist/collection name overrides for cleaner browsing
const COLLECTION_NAMES = {
  'p bass': 'Precision Bass (Pick) by timkahn',
  'musicradar-extreme-bass-samples': 'MusicRadar Extreme Bass',
  "Lyrical Distortion - `72 Jazz Bass Direct": "Lyrical Distortion '72 Jazz Bass",
  'Bass': 'Ample P-Bass (Deterministic)',
  'drum kit 1': 'Deterministic Drum Kit 1',
  'drum kit 2': 'Deterministic Drum Kit 2',
  'FRONTLINE_VINTAGE_KEYS_2': 'Frontline Vintage Keys 2',
  'Pulsed Records - World Series Gadulka Strings': 'Gadulka Strings',
  'Wavesfactory.W.Acoustic.12.Strings.Pick.KONTAKT': 'Acoustic 12 Strings (Pick)',
  'Wavesfactory.W-Xylophone.KONTAKT': 'Wavesfactory Xylophone',
};

async function scanDir(dirPath, relativeBase) {
  const entries = [];
  try {
    const items = await readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.join(relativeBase, item.name);
      if (item.isDirectory()) {
        if (!item.name.startsWith('.') && !item.name.startsWith('__')) {
          const sub = await scanDir(fullPath, relativePath);
          entries.push(...sub);
        }
      } else if (/\.(wav|mp3|aiff?|flac|ogg)$/i.test(item.name)) {
        const s = await stat(fullPath);
        entries.push({
          name: item.name,
          path: relativePath.replace(/\\/g, '/'),
          fullPath,
          size: s.size,
          modified: s.mtime.toISOString(),
        });
      }
    }
  } catch (e) {
    console.warn(`  [warn] Cannot scan ${dirPath}: ${e.message}`);
  }
  return entries;
}

async function main() {
  console.log('Sound Library Scanner\n');

  const index = [];

  for (const [type, folders] of Object.entries(LIBRARY_PATHS)) {
    for (const folderPath of folders) {
      const absPath = path.resolve(ROOT, folderPath);
      const folderName = path.basename(folderPath);
      const collectionName = COLLECTION_NAMES[folderName] || folderName;

      if (!existsSync(absPath)) {
        console.warn(`  [skip] ${folderPath} — not found`);
        continue;
      }

      console.log(`  Scanning ${type}: ${collectionName}...`);
      const files = await scanDir(absPath, folderPath);
      console.log(`    Found ${files.length} audio files`);

      for (const file of files) {
        index.push({
          id: `${type}_${index.length}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          filename: file.name,
          path: file.path,
          library: folderName,
          collection: collectionName,
          folder: path.dirname(file.path).replace(/\\/g, '/'),
          type,
          size: file.size,
          modified: file.modified,
        });
      }
    }
  }

  // Write index with original paths (no copying - desktop app reads from source)
  const indexPath = path.join(PUBLIC_SOUNDS, 'index.json');
  if (!existsSync(PUBLIC_SOUNDS)) mkdirSync(PUBLIC_SOUNDS, { recursive: true });
  
  // Add absolute path field for desktop app file access
  const desktopIndex = index.map(entry => ({
    ...entry,
    absolutePath: path.resolve(ROOT, entry.path).replace(/\\/g, '/'),
  }));
  
  writeFileSync(indexPath, JSON.stringify(desktopIndex, null, 2));
  console.log(`\n  Wrote index: ${indexPath}`);
  console.log(`  Total samples indexed: ${index.length}`);
  console.log(`  Note: Files remain in original locations (no copies).`);
  console.log(`  For Vite dev server, files are served via custom middleware.`);
  console.log(`  For desktop app, use absolutePath field to read files.`);
}

main().catch(console.error);
