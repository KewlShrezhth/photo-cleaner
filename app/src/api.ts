// Set EXPO_PUBLIC_API_URL to your computer's LAN address, e.g. http://192.168.1.20:8787
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8787'; // 10.0.2.2 = host from Android emulator

// Indexes refer to the photos in the order they were sent.
export type Analysis = {
  judged: boolean; // true when Claude settled the close calls, false when only the free scores were used
  leftovers: number[]; // one-off photos that fit no situation
  groups: { label: string; members: number[]; keep: number[]; notes: Record<string, string> }[];
};

export async function analyzePhotos(images: string[]): Promise<Analysis> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 120000); // never leave the spinner running forever
  try {
    const res = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-key': process.env.EXPO_PUBLIC_APP_KEY ?? '' },
      body: JSON.stringify({ images }),
      signal: abort.signal,
    });
    if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
    const r = await res.json();
    // Trust boundary: a malformed reply must not crash the results screen.
    const ok = (i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < images.length;
    const idx = (a: unknown) => Array.isArray(a) && a.every(ok);
    if (!idx(r?.leftovers) || !Array.isArray(r?.groups) || !r.groups.every((g: any) => idx(g?.members) && idx(g?.keep))) {
      throw new Error('The server sent an unexpected reply.');
    }
    return r;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('The server took too long. Try fewer photos.');
    // fetch throws TypeError when the server can't be reached at all (offline, server down, blocked http)
    if (e instanceof TypeError) throw new Error("Couldn't reach the Photo Cleaner server. Check your connection and try again.");
    throw new Error(e?.message);
  } finally {
    clearTimeout(timer);
  }
}
