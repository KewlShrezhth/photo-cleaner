import sharp from 'sharp';
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} from '@huggingface/transformers';

// Free, local steps: group photos by what they show (CLIP), score sharpness and exposure (sharp).
// Claude is only asked about close calls (see index.js).

const MODEL = 'Xenova/clip-vit-base-patch32';
const SAME_SITUATION = Number(process.env.SAME_SITUATION ?? 0.72); // cosine similarity needed to join a group
const NEAR_DUPLICATE = 0.96;

// Zero-shot names for each group; the best match for the group's average picture wins.
const LABELS = [
  'people posing for a photo', 'a selfie', 'a group of friends', 'a baby or child', 'a dog', 'a cat', 'a pet',
  'food on a plate', 'a drink', 'a beach', 'mountains and a lake', 'a forest', 'a sunset', 'a city street',
  'a building', 'a car', 'a flower', 'an indoor room', 'a night scene', 'a concert or event',
  'a screenshot or document', 'a sports activity', 'a landscape',
];

let loading;
function models() {
  loading ??= (async () => {
    const processor = await AutoProcessor.from_pretrained(MODEL);
    const vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' });
    const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
    const text = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'q8' });
    const { text_embeds } = await text(tokenizer(LABELS.map((l) => `a photo of ${l}`), { padding: true, truncation: true }));
    return { processor, vision, labelVecs: text_embeds.normalize(2, -1).tolist() };
  })();
  return loading;
}
export const warmUp = () => models();

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const mean = (vs) => {
  const m = vs[0].map((_, i) => vs.reduce((s, v) => s + v[i], 0) / vs.length);
  const n = Math.hypot(...m);
  return m.map((x) => x / n);
};

async function embed(buf, m) {
  const image = await RawImage.fromBlob(new Blob([buf]));
  const { image_embeds } = await m.vision(await m.processor(image));
  return image_embeds.normalize(2, -1).tolist()[0];
}

// Sharpness = spread of an edge filter (Laplacian); exposure = share of crushed shadows or blown highlights.
async function quality(buf) {
  const gray = sharp(buf).rotate().resize({ width: 256 }).grayscale();
  const edges = await gray.clone().convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], scale: 1, offset: 128 }).stats();
  const { data } = await gray.clone().raw().toBuffer({ resolveWithObject: true });
  let dark = 0, bright = 0, sum = 0;
  for (const v of data) { if (v < 12) dark++; else if (v > 243) bright++; sum += v; }
  return { sharp: edges.channels[0].stdev, dark: dark / data.length, bright: bright / data.length, lum: sum / data.length };
}

// Average-linkage grouping: keep merging the two most similar groups while they still look like the same situation.
function cluster(vecs) {
  let groups = vecs.map((v, i) => ({ members: [i], vec: v }));
  for (;;) {
    let best = -1, bi = 0, bj = 0;
    for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        const s = dot(groups[i].vec, groups[j].vec);
        if (s > best) { best = s; bi = i; bj = j; }
      }
    if (best < SAME_SITUATION) return groups.map((g) => g.members);
    const members = [...groups[bi].members, ...groups[bj].members];
    const merged = { members, vec: mean(members.map((k) => vecs[k])) };
    groups = groups.filter((_, k) => k !== bi && k !== bj).concat(merged);
  }
}

// Bigger situations keep more: under 15 photos keep 1, 15 to 29 keep 2, 30 or more keep 3.
export const keepFor = (n) => Math.min(3, 1 + Math.floor(n / 15));

function note(q, relSharp) {
  if (q.lum < 50 || q.dark > 0.4) return 'Too dark';
  if (q.lum > 215 || q.bright > 0.3) return 'Too bright';
  if (relSharp < 0.45) return 'Soft or blurry';
  return relSharp > 0.9 ? 'Sharp' : 'OK';
}

export async function analyze(buffers) {
  const m = await models();
  const vecs = [];
  const quals = [];
  for (const b of buffers) {
    vecs.push(await embed(b, m));
    quals.push(await quality(b));
  }

  const groups = [];
  const leftovers = [];
  for (const members of cluster(vecs)) {
    if (members.length === 1) { leftovers.push(members[0]); continue; }
    const topSharp = Math.max(...members.map((k) => quals[k].sharp));
    const score = {};
    const notes = {};
    for (const k of members) {
      const rel = quals[k].sharp / topSharp;
      const expo = 1 - Math.min(1, (quals[k].dark + quals[k].bright) * 2) - (quals[k].lum < 50 || quals[k].lum > 215 ? 0.25 : 0);
      score[k] = 0.75 * rel + 0.25 * Math.max(0, expo);
      notes[k] = note(quals[k], rel);
    }
    // Drop near-identical shots that are clearly worse than a twin, so the finalists are different pictures.
    const ranked = [...members].sort((a, b) => score[b] - score[a]);
    const finalists = [];
    for (const k of ranked) if (!finalists.some((f) => dot(vecs[f], vecs[k]) > NEAR_DUPLICATE)) finalists.push(k);
    const centroid = mean(members.map((k) => vecs[k]));
    const label = LABELS[m.labelVecs.map((l) => dot(l, centroid)).reduce((bi, s, i, a) => (s > a[bi] ? i : bi), 0)];
    groups.push({ label: label.replace(/^(a|an) /, ''), members, ranked, finalists, score, notes, keepCount: keepFor(members.length) });
  }
  return { groups, leftovers };
}
