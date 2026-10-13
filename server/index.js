import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { analyze, warmUp } from './analyze.js';

const MODEL = process.env.MODEL ?? 'claude-haiku-5-5';
const PORT = Number(process.env.PORT ?? 8787);
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null; // without a key the free scoring still works
const LETTERS = 'abcdefgh';

// Ask Claude to choose among the few finalists of each close call, in one small request.
async function judge(calls, buffers) {
  const content = [];
  for (const [g, c] of calls) {
    content.push({ type: 'text', text: `Group g${g} (${c.label}), choose ${c.keepCount}:` });
    c.finalists.forEach((k, i) => {
      content.push({ type: 'text', text: `g${g}-${LETTERS[i]}` });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: buffers[k].toString('base64') } });
    });
  }
  content.push({
    type: 'text',
    text: 'You are a photo editor. For each group pick the best photos on sharpness, exposure, composition, and faces (eyes open, good expression). Prefer variety if you must pick several. Reply with ONLY JSON like {"g0":["a"],"g1":["b","c"]}.',
  });
  const msg = await client.messages.create({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content }] });
  const text = msg.content.find((b) => b.type === 'text')?.text ?? '';
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

async function run(images) {
  const buffers = images.map((b) => Buffer.from(b, 'base64'));
  const { groups, leftovers } = await analyze(buffers);

  // Close calls only: a clear technical winner needs no model at all.
  const calls = new Map();
  groups.forEach((g, i) => {
    const top = g.finalists.slice(0, g.keepCount + 2);
    const gap = g.score[g.ranked[g.keepCount - 1]] - (g.score[g.ranked[g.keepCount]] ?? -1);
    if (top.length > g.keepCount && gap < 0.25) calls.set(i, { ...g, finalists: top });
  });

  let choices = {};
  let judged = false;
  if (client && calls.size) {
    try {
      choices = await judge(calls, buffers);
      judged = true;
    } catch (e) {
      console.error('Claude judging failed, using free scores:', e.message);
    }
  }

  return {
    judged,
    leftovers,
    groups: groups.map((g, i) => {
      const call = calls.get(i);
      const picked = judged && call && Array.isArray(choices[`g${i}`])
        ? choices[`g${i}`].map((l) => call.finalists[LETTERS.indexOf(l)]).filter((k) => k !== undefined)
        : [];
      // Fill up from the free ranking if Claude returned too few valid picks.
      const keep = [...new Set([...picked, ...g.finalists])].slice(0, g.keepCount);
      return { label: g.label, members: g.members, keep, notes: g.notes };
    }),
  };
}

// shortcut: the key ships inside the app, so it stops casual use, not a determined attacker; add real accounts before scaling.
const APP_KEY = process.env.APP_KEY;
const hits = new Map(); // ip -> recent request times
const LIMIT = 20; // requests per IP per 10 minutes, keeps a public demo cheap

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

http
  .createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200).end('ok'); // for the host's health check
      return;
    }
    if (req.method !== 'POST' || req.url !== '/analyze') {
      res.writeHead(404).end();
      return;
    }
    if (APP_KEY && req.headers['x-app-key'] !== APP_KEY) {
      res.writeHead(401).end('Unauthorized');
      return;
    }
    if (limited(req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket.remoteAddress)) {
      res.writeHead(429).end('Too many requests, try again in a few minutes');
      return;
    }
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 12_000_000) { // 200 thumbnails are about 6 MB; refuse anything much larger
          res.writeHead(413).end('Request too large');
          return;
        }
      }
      const { images } = JSON.parse(body);
      if (!Array.isArray(images) || images.length < 2 || images.length > 200 || !images.every((i) => typeof i === 'string')) {
        res.writeHead(400).end('Send 2-200 images as base64 strings');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(await run(images)));
    } catch (e) {
      console.error(e);
      res.writeHead(500).end(String(e?.message ?? e));
    }
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log(`Photo Cleaner server on :${PORT} (${client ? `judging with ${MODEL}` : 'no API key: free scoring only'})`);
    warmUp().then(() => console.log('Grouping model ready'));
  });
