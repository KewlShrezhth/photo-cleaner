import { Image } from 'react-native';
import type { Photo } from './photos';
import type { Analysis } from './api';

// Demo mode: 12 bundled photos (4 scenes x 3 shots) and a built-in ranking, so every screen can be
// tried without photo-library access or the AI server. The ranking is hand-assigned, NOT AI output.
// The sample photos are not in the repository. If assets/samples is missing, FILES stays empty and the demo is hidden.
const FILES: any[] = [];
try {
  FILES.push(
    require('../assets/samples/s00.jpg'),
    require('../assets/samples/s01.jpg'),
    require('../assets/samples/s02.jpg'),
    require('../assets/samples/s03.jpg'),
    require('../assets/samples/s04.jpg'),
    require('../assets/samples/s05.jpg'),
    require('../assets/samples/s06.jpg'),
    require('../assets/samples/s07.jpg'),
    require('../assets/samples/s08.jpg'),
    require('../assets/samples/s09.jpg'),
    require('../assets/samples/s10.jpg'),
    require('../assets/samples/s11.jpg'),
  );
} catch {}

// [score, note] per sample; scene = index / 3
const META: [number, string][] = [
  [9, 'Sharp, both smiling'], [5, 'One has eyes closed'], [4, 'Facing away'],
  [3, 'Phone in frame, not the dish'], [8, 'Sharp close-up'], [5, 'Hands in frame'],
  [9, 'Sharp, looking at camera'], [6, 'Looking away'], [7, 'Action shot, a bit soft'],
  [9, 'Great colors, reflection'], [5, 'Hazy, flat colors'], [3, 'Thumb in frame'],
];

export const sampleCount = FILES.length;

export function samplePhotos(): Photo[] {
  return FILES.map((f, i) => ({
    id: `sample-${i}`,
    uri: Image.resolveAssetSource(f).uri,
    created: Date.now() - i * 60000,
  }));
}

// Demo version of the server's answer: one situation per scene, best photo kept, the odd one out is a leftover.
export function sampleAnalyze(chosen: Photo[]): Analysis {
  const idx = (p: Photo) => Number(p.id.split('-')[1]);
  const LABELS = ['beach', 'food on a plate', 'dog', 'mountains and a lake'];
  const byScene = new Map<number, number[]>();
  chosen.forEach((p, i) => {
    const scene = Math.floor(idx(p) / 3);
    byScene.set(scene, [...(byScene.get(scene) ?? []), i]);
  });
  const leftovers: number[] = [];
  const groups: Analysis['groups'] = [];
  for (const [scene, all] of byScene) {
    const members = all.filter((i) => idx(chosen[i]) !== 2); // photo 2 is the one-off 'facing away' shot
    leftovers.push(...all.filter((i) => idx(chosen[i]) === 2));
    if (members.length < 2) { leftovers.push(...members); continue; }
    const best = [...members].sort((a, b) => META[idx(chosen[b])][0] - META[idx(chosen[a])][0])[0];
    groups.push({ label: LABELS[scene], members, keep: [best], notes: Object.fromEntries(members.map((i) => [String(i), META[idx(chosen[i])][1]])) });
  }
  return { judged: false, leftovers, groups };
}
