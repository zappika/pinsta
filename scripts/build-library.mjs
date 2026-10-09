import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Build public copies from the versioned originals; do not maintain a second set.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets/vicolo-library');
const output = path.join(root, 'public/vicolo-library');
await mkdir(output, { recursive: true });
await cp(path.join(root, 'assets/library-ui'), output, { recursive: true });
for (const group of ['objects', 'cities', 'menu-icons']) {
  await cp(path.join(source, group), path.join(output, 'assets', group), { recursive: true });
}
const title = (name) => name.replaceAll('-', ' ').replace(/^./, (c) => c.toUpperCase());
const manifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
const catalog = manifest.map((asset) => ({
  ...asset, name: title(asset.name), url: `assets/${asset.file}`, transparent: asset.background === 'transparent', variants: [],
}));
for (const name of (await readdir(path.join(source, 'menu-icons'))).sort()) {
  const base = `menu-icons/${name}/${name}`;
  const png = await readFile(path.join(source, `${base}-master.png`));
  catalog.push({ group: 'menu', name: title(name), city: '', url: `assets/${base}-master.png`,
    width: png.readUInt32BE(16), height: png.readUInt32BE(20), transparent: true,
    variants: [24, 48, 72].map((size) => ({ label: `${size}px`, url: `assets/${base}-${size}.png` })),
  });
}
// Fail the build on a missing original or download rendition.
for (const asset of catalog) {
  for (const url of [asset.url, ...asset.variants.map((v) => v.url)]) await readFile(path.join(output, url));
}
await writeFile(path.join(output, 'catalog.js'), `window.CATALOG = ${JSON.stringify(catalog)};\n`);
console.log(`Prepared ${catalog.length} Vicolo library assets.`);
