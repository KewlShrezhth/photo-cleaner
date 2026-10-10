import * as MediaLibrary from 'expo-media-library/legacy';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';

export const MAX_PHOTOS = 150; // thumbnails are ~25 KB each, so a day of photos stays a small upload

export type Photo = { id: string; uri: string; created: number; lat?: number; lon?: number };

export async function ensurePermission(): Promise<boolean> {
  const cur = await MediaLibrary.getPermissionsAsync();
  if (cur.granted) return true;
  return (await MediaLibrary.requestPermissionsAsync(false, ['photo'])).granted;
}

// Timestamps may come back in seconds or milliseconds depending on the platform.
const toMs = (t: number) => (t > 0 && t < 1e11 ? t * 1000 : t);

// The native date filter only matches photos that have a "date taken" value, which screenshots, downloads and
// edited photos often lack. So scan newest-modified first and filter here, using the modified date as a fallback.
export async function loadByDate(from: Date, to: Date): Promise<Photo[]> {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  const found: Photo[] = [];
  let after: string | undefined;
  for (let scanned = 0; scanned < 3000 && found.length < MAX_PHOTOS; scanned += 300) {
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: 'photo',
      sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
      first: 300,
      after,
    });
    for (const a of page.assets) {
      const when = toMs(a.creationTime) || toMs(a.modificationTime);
      if (when >= start.getTime() && when <= end.getTime() && found.length < MAX_PHOTOS) {
        found.push({ id: a.id, uri: a.uri, created: when });
      }
    }
    const oldest = page.assets[page.assets.length - 1];
    // Once even the modified date is older than the range, nothing further down can match.
    if (!page.hasNextPage || !oldest || toMs(oldest.modificationTime) < start.getTime()) break;
    after = page.endCursor;
  }
  return found.sort((a, b) => b.created - a.created);
}

// Place search: scan recent photos, reverse-geocode a sample of them, match on the typed text.
export async function loadByPlace(query: string): Promise<Photo[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const page = await MediaLibrary.getAssetsAsync({
    mediaType: 'photo',
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    first: 300,
  });
  const found: Photo[] = [];
  const cache = new Map<string, boolean>();
  for (const a of page.assets) {
    if (found.length >= MAX_PHOTOS) break;
    const info = await MediaLibrary.getAssetInfoAsync(a);
    const loc = info.location;
    if (!loc) continue;
    const key = `${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}`; // ~1km cell
    if (!cache.has(key)) {
      try {
        const [r] = await Location.reverseGeocodeAsync(loc);
        const text = [r?.name, r?.street, r?.district, r?.city, r?.region, r?.country]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        cache.set(key, text.includes(q));
      } catch {
        cache.set(key, false);
      }
    }
    if (cache.get(key)) {
      found.push({ id: a.id, uri: a.uri, created: a.creationTime, lat: loc.latitude, lon: loc.longitude });
    }
  }
  return found;
}

export async function toThumbnailBase64(uri: string): Promise<string> {
  const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
  ctx.resize({ width: 384 }); // ~260 image tokens each; enough to judge blur, eyes and framing
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ base64: true, compress: 0.5, format: ImageManipulator.SaveFormat.JPEG });
  return out.base64 ?? '';
}

// Archive, never delete: Android moves the files into a 'Photo Cleaner Archive' album; on iPhone the library cannot
// hide a photo, so they are added to that album and stay in your library too.
export async function archivePhotos(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const name = 'Photo Cleaner Archive';
  const album = await MediaLibrary.getAlbumAsync(name);
  if (album) {
    await MediaLibrary.addAssetsToAlbumAsync(ids, album, false);
  } else {
    const made = await MediaLibrary.createAlbumAsync(name, ids[0], false);
    if (ids.length > 1) await MediaLibrary.addAssetsToAlbumAsync(ids.slice(1), made, false);
  }
}
