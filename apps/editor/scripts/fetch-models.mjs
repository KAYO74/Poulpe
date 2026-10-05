// Télécharge le modèle d'IA du détourage (U²-Net « silueta », 44 Mo) dans public/models/, une seule
// fois. Il n'est pas gardé dans le dépôt Git ; il est embarqué dans l'appli et le site compilés, et
// le détourage fonctionne ensuite sans connexion. Sans réseau, la compilation continue : le
// détourage affiche alors un message.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODELS = [
  {
    file: 'silueta.onnx',
    // Version figée du modèle publié par le projet rembg (licence MIT), dérivé de U²-Net (Apache 2.0).
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/silueta.onnx',
    sha256: '75da6c8d2f8096ec743d071951be73b4a8bc7b3e51d9a6625d63644f90ffeedb',
  },
];

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');
mkdirSync(dir, { recursive: true });
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

for (const m of MODELS) {
  const path = join(dir, m.file);
  if (existsSync(path) && sha(readFileSync(path)) === m.sha256) continue;
  try {
    console.log(`Téléchargement du modèle ${m.file}…`);
    const res = await fetch(m.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (sha(buf) !== m.sha256) throw new Error('empreinte SHA-256 inattendue');
    writeFileSync(path, buf);
  } catch (e) {
    console.warn(`Modèle ${m.file} indisponible (${e.message}) : le détourage automatique sera désactivé.`);
    if (process.env.POULPE_REQUIRE_MODELS) process.exit(1);
  }
}
