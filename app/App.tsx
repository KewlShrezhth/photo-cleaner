import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { isIOS, useTheme } from './src/theme';
import { BottomBar, Button, Segmented, hasGlass } from './src/ui';
import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { ensurePermission, loadByDate, loadByPlace, archivePhotos, toThumbnailBase64, Photo, MAX_PHOTOS } from './src/photos';
import { analyzePhotos, Analysis } from './src/api';
import { samplePhotos, sampleAnalyze, sampleCount } from './src/samples';
import { EmptyState, ExtendedFab, OutlinedField, StatusChip, useNotice } from './src/m3';

const GAP = 4;
const COLS = 3;
const SIZE = (Dimensions.get('window').width - GAP * (COLS + 1)) / COLS;

type Mode = 'date' | 'place';
type Group = { label: string; photos: Photo[]; keepIds: Set<string>; notes: Record<string, string> };
type Result = { judged: boolean; groups: Group[]; leftovers: Photo[] };
type Screen = 'pick' | 'working' | 'result';

function DateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  min?: Date;
  max?: Date;
}) {
  const t = useTheme();
  return (
    <View style={styles.dateRow}>
      <Text style={{ color: t.text, flex: 1 }}>{label}</Text>
      {isIOS ? (
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          minimumDate={min}
          maximumDate={max}
          onValueChange={(_, d) => onChange(d)}
        />
      ) : (
        <Pressable
          onPress={() =>
            DateTimePickerAndroid.open({
              value,
              mode: 'date',
              design: 'material',
              title: label === 'From' ? 'Start date' : 'End date',
              minimumDate: min,
              maximumDate: max,
              onValueChange: (_, d) => onChange(d),
            })
          }
        >
          <Text style={{ color: t.accent }}>{value.toDateString()}</Text>
        </Pressable>
      )}
    </View>
  );
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

// Quick date ranges: filter chips on Android, capsules on iOS.
function PresetChips({ from, to, onPick }: { from: Date; to: Date; onPick: (from: Date, to: Date) => void }) {
  const t = useTheme();
  const row = (
    <>
      {PRESETS.map((p) => {
        const on = dayKey(to) === dayKey(new Date()) && dayKey(from) === dayKey(daysAgo(p.days));
        return (
          <Pressable
            key={p.label}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            hitSlop={8} // 32dp chip, 48dp touch target
            android_ripple={{ color: t.text + '1F' }}
            onPress={() => {
              if (isIOS) Haptics.selectionAsync();
              onPick(daysAgo(p.days), new Date());
            }}
            style={{
              height: 32,
              paddingHorizontal: 14,
              borderRadius: isIOS ? 16 : 8,
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: hasGlass ? 'transparent' : on ? t.tonal : 'transparent',
              borderWidth: hasGlass || (on && isIOS) ? 0 : 1,
              borderColor: t.outline,
            }}
          >
            {hasGlass && (
              <GlassView isInteractive glassEffectStyle="regular" tintColor={on ? t.accent + '55' : undefined} style={StyleSheet.absoluteFill} />
            )}
            <Text style={{ color: on ? t.onTonal : t.text, fontSize: 14, fontWeight: '500', letterSpacing: isIOS ? 0 : 0.1 }}>
              {!isIOS && on ? '✓  ' : ''}
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </>
  );
  return hasGlass ? (
    <GlassContainer spacing={8} style={{ flexDirection: 'row', gap: 8 }}>
      {row}
    </GlassContainer>
  ) : (
    <View style={{ flexDirection: 'row', gap: 8 }}>{row}</View>
  );
}

export default function App() {
  const t = useTheme();
  const [screen, setScreen] = useState<Screen>('pick');
  const [mode, setMode] = useState<Mode>('date');
  const [from, setFrom] = useState(new Date(Date.now() - 7 * 86400000));
  const [to, setTo] = useState(new Date());
  const [place, setPlace] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const [demo, setDemo] = useState(false);
  const [notice, notify] = useNotice();
  const [workingCount, setWorkingCount] = useState(0);

  function useSamples() {
    const found = samplePhotos();
    setDemo(true);
    setPhotos(found);
    setSelected(new Set(found.map((p) => p.id)));
  }

  async function search() {
    if (!(await ensurePermission())) {
      Alert.alert('Photo access needed', 'Allow photo access in Settings to use Photo Cleaner.');
      return;
    }
    setBusy(true);
    try {
      const found = mode === 'date' ? await loadByDate(from, to) : await loadByPlace(place);
      setDemo(false); // only once the sample photos are actually replaced
      setPhotos(found);
      setSelected(new Set(found.map((p) => p.id)));
      if (!found.length) notify('No photos found', 'Try a different date range or place');
    } catch (e: any) {
      notify('Could not load photos', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    const chosen = photos.filter((p) => selected.has(p.id));
    if (chosen.length < 2) {
      notify('Select more photos', 'Pick at least 2 photos to compare');
      return;
    }
    setWorkingCount(chosen.length);
    setScreen('working');
    try {
      let a: Analysis;
      if (demo) {
        await new Promise((r) => setTimeout(r, 900));
        a = sampleAnalyze(chosen);
      } else {
        const images: string[] = [];
        for (let i = 0; i < chosen.length; i += 8) {
          // a few at a time, so a big day of photos doesn't use up the phone's memory
          images.push(...(await Promise.all(chosen.slice(i, i + 8).map((p) => toThumbnailBase64(p.uri)))));
        }
        a = await analyzePhotos(images);
      }
      setResult({
        judged: a.judged,
        leftovers: a.leftovers.map((i) => chosen[i]),
        groups: a.groups.map((g) => ({
          label: g.label,
          photos: g.members.map((i) => chosen[i]),
          keepIds: new Set(g.keep.map((i) => chosen[i].id)),
          notes: Object.fromEntries(Object.entries(g.notes).map(([i, n]) => [chosen[Number(i)].id, n])),
        })),
      });
      setScreen('result');
    } catch (e: any) {
      setScreen('pick');
      notify('Something went wrong', String(e?.message ?? e));
    }
  }

  // Nothing is ever deleted. Only the extra shots in a group go to the Archive album; one-offs have nothing to compete with, so they are kept.
  async function archiveRest() {
    if (!result) return;
    const ids = result.groups.flatMap((g) => g.photos.filter((p) => !g.keepIds.has(p.id)).map((p) => p.id));
    if (demo) {
      notify('Demo mode', 'Sample photos are not on your phone, so nothing was archived');
      return;
    }
    try {
      await archivePhotos(ids);
      notify('Archived', `${ids.length} photo${ids.length === 1 ? '' : 's'} moved to the Photo Cleaner Archive album`);
      setResult(null);
      setPhotos([]);
      setSelected(new Set());
      setScreen('pick');
    } catch (e: any) {
      Alert.alert('Could not archive', String(e?.message ?? e));
    }
  }

  const title = (txt: string) => (
    <Text
      style={[
        styles.title,
        { color: t.text, letterSpacing: t.titleTracking },
        isIOS
          ? { fontSize: 34, fontWeight: '700' }
          : { fontSize: 28, lineHeight: 36, fontWeight: '400' }, // M3 Headline Medium
      ]}
    >
      {txt}
    </Text>
  );

  if (screen === 'working') {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.accent} />
        <Text
          style={[
            { color: t.text, marginTop: 24 },
            isIOS ? { fontSize: 17 } : { fontSize: 16, lineHeight: 24, letterSpacing: 0.15, fontWeight: '500' },
          ]}
        >
          Comparing {workingCount} photos…
        </Text>
        <Text style={{ color: t.subtext, marginTop: 4, fontSize: 14 }}>Looking for sharp, well-framed shots</Text>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (screen === 'result' && result) {
    const { groups, leftovers } = result;
    const keepTotal = groups.reduce((n, g) => n + g.keepIds.size, 0) + leftovers.length;
    const archiveCount = groups.reduce((n, g) => n + g.photos.length - g.keepIds.size, 0);
    const caps = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const strip = (photos: Photo[], keepIds: Set<string> | null) => (
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={keepIds ? [...photos].sort((a, b) => Number(keepIds.has(b.id)) - Number(keepIds.has(a.id))) : photos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => {
          const kept = !!keepIds?.has(item.id);
          return (
            <View style={{ opacity: keepIds && !kept ? 0.55 : 1 }}>
              <Image
                source={{ uri: item.uri }}
                accessibilityLabel={kept ? 'Kept photo' : keepIds ? 'Photo to archive' : 'One-off photo, kept'}
                style={{ width: 92, height: 92, borderRadius: isIOS ? 12 : 12, borderWidth: kept ? 3 : 0, borderColor: t.keep }}
              />
              {kept && (
                <View style={[styles.check, { backgroundColor: t.keep, right: 6, top: 6 }]}>
                  <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>
                </View>
              )}
            </View>
          );
        }}
      />
    );
    const card = (head: string, sub: string, body: React.ReactNode, foot?: string) => (
      <View style={[styles.sit, { backgroundColor: t.container, borderRadius: t.radius }]}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>{head}</Text>
        <Text style={{ color: t.subtext, fontSize: 14 }}>{sub}</Text>
        {body}
        {foot ? <Text style={{ color: t.subtext, fontSize: 13 }}>{foot}</Text> : null}
      </View>
    );
    return (
      <SafeAreaView style={[styles.fill, { backgroundColor: t.bg }]}>
        <StatusBar style="auto" />
        <FlatList
          key="results"
          data={groups}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingBottom: 200 }}
          ListHeaderComponent={
            <View style={styles.pad}>
              {title('Your best')}
              <Text style={{ color: t.subtext }}>
                {groups.length} situation{groups.length === 1 ? '' : 's'} found. Keeping {keepTotal}, archiving {archiveCount}.
              </Text>
              {demo ? (
                !isIOS ? <StatusChip kind="info" label="Demo ranking, not AI" /> : <Text style={{ color: t.subtext }}>(Demo ranking, not AI)</Text>
              ) : !result.judged ? (
                <Text style={{ color: t.subtext, fontSize: 13 }}>Picked by sharpness and exposure.</Text>
              ) : null}
            </View>
          }
          renderItem={({ item: g }) => {
            const bestNote = g.notes[[...g.keepIds][0]];
            return card(
              caps(g.label),
              `${g.photos.length} photos · keeping ${g.keepIds.size}`,
              strip(g.photos, g.keepIds),
              bestNote ? `Best: ${bestNote}` : undefined
            );
          }}
          ListFooterComponent={
            leftovers.length
              ? card(
                  'Kept as is',
                  `${leftovers.length} one-off photo${leftovers.length === 1 ? '' : 's'}`,
                  strip(leftovers, null),
                  'These match nothing else, so there is nothing better to keep instead. They stay where they are.'
                )
              : null
          }
        />
        <BottomBar>
          {archiveCount > 0 && <Button title={`Archive ${archiveCount} photo${archiveCount === 1 ? '' : 's'}`} onPress={archiveRest} />}
          <Button title="Back" tonal onPress={() => setScreen('pick')} />
        </BottomBar>
        {notice}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: t.bg }]}>
      <StatusBar style="auto" />
      <FlatList
        key="pick"
        data={photos}
        numColumns={COLS}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: 200, paddingHorizontal: GAP / 2 }}
        ListHeaderComponent={
          <View style={styles.pad}>
            {title('Photo Cleaner')}
            {__DEV__ && isIOS && (
              <Text style={{ color: t.subtext, fontSize: 12 }}>
                Liquid Glass: {String(isLiquidGlassAvailable())} · API: {String(isGlassEffectAPIAvailable())} · iOS {String(Platform.Version)}
              </Text>
            )}
            {!isIOS && (
              <Text style={{ color: t.subtext, fontSize: 14, lineHeight: 20, letterSpacing: 0.25, marginTop: -8 }}>
                Keep your best shots, archive the rest
              </Text>
            )}
            <Segmented
              options={[
                { label: 'Date', value: 'date' as Mode },
                { label: 'Place', value: 'place' as Mode },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === 'date' && (
              <PresetChips
                from={from}
                to={to}
                onPick={(f, e) => {
                  setFrom(f);
                  setTo(e);
                }}
              />
            )}
            {mode === 'date' ? (
              <View style={[styles.card, { backgroundColor: t.card, borderRadius: t.radius }]}>
                <DateField label="From" value={from} onChange={setFrom} max={to} />
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.divider }} />
                <DateField label="To" value={to} onChange={setTo} min={from} max={new Date()} />
              </View>
            ) : !isIOS ? (
              <OutlinedField
                label="City or place"
                value={place}
                onChangeText={setPlace}
                placeholder="e.g. Paris"
                onSubmit={search}
              />
            ) : (
              <TextInput
                value={place}
                onChangeText={setPlace}
                placeholder="City or place, e.g. Paris"
                placeholderTextColor={t.subtext}
                style={[
                  styles.input,
                  isIOS
                    ? { backgroundColor: t.card, borderRadius: t.radius }
                    : { borderWidth: 1, borderColor: t.outline, borderRadius: 4 }, // M3 outlined text field
                  { color: t.text },
                ]}
                returnKeyType="search"
                onSubmitEditing={search}
              />
            )}
            <Button title={busy ? 'Searching…' : 'Find photos'} onPress={search} disabled={busy} />
            {__DEV__ && sampleCount > 0 && <Button title="Try with sample photos" tonal onPress={useSamples} />}
            {photos.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Text style={{ color: t.subtext, flex: 1 }}>
                  {selected.size} of {photos.length} selected.{' '}
                  {photos.length >= MAX_PHOTOS ? `Showing the ${MAX_PHOTOS} newest. ` : ''}Tap a photo to skip it.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setSelected(selected.size === photos.length ? new Set() : new Set(photos.map((p) => p.id)))}
                >
                  <Text style={{ color: t.accent, fontWeight: '500' }}>
                    {selected.size === photos.length ? 'Clear' : 'Select all'}
                  </Text>
                </Pressable>
              </View>
            )}
            {photos.length === 0 && !isIOS && (
              <EmptyState
                title="No photos yet"
                body={`Choose a date range or a place, then tap Find photos.${__DEV__ && sampleCount > 0 ? ' You can also try the sample photos.' : ''}`}
              />
            )}
          </View>
        }
        renderItem={({ item }) => {
          const on = selected.has(item.id);
          const allOn = selected.size === photos.length;
          return (
            <Pressable
              style={{ margin: GAP / 2 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`Photo ${photos.indexOf(item) + 1} of ${photos.length}`}
              onPress={() => {
                if (isIOS) Haptics.selectionAsync();
                setSelected((prev) => {
                  const n = new Set(prev);
                  on ? n.delete(item.id) : n.add(item.id);
                  return n;
                });
              }}
            >
              <Image
                source={{ uri: item.uri }}
                style={{ width: SIZE, height: SIZE, borderRadius: isIOS ? 8 : 12, opacity: on ? 1 : 0.35 }}
              />
              {on && !allOn && (
                hasGlass ? (
                  <GlassView glassEffectStyle="regular" tintColor={t.accent} style={[styles.check, { overflow: 'hidden' }]}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                  </GlassView>
                ) : (
                  <View style={[styles.check, { backgroundColor: t.accent }]}>
                    <Text style={{ color: t.onAccent, fontSize: 12 }}>✓</Text>
                  </View>
                )
              )}
            </Pressable>
          );
        }}
      />
      {photos.length > 0 && !isIOS && (
        <BottomBar>
          <View style={styles.keepRow}>
            <Text style={{ color: t.subtext, flex: 1 }}>{selected.size} selected</Text>
            <ExtendedFab label="Find the best" onPress={analyze} disabled={selected.size < 2} />
          </View>
        </BottomBar>
      )}
      {photos.length > 0 && isIOS && (
        <BottomBar>
          <Button title="Find the best" onPress={analyze} disabled={selected.size < 2} />
        </BottomBar>
      )}
      {notice}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 16, gap: 12 },
  title: { marginTop: Platform.OS === 'android' ? 24 : 0 },
  card: { paddingHorizontal: 16, paddingVertical: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  input: { padding: 14, fontSize: 16 },
  big: { width: '100%', aspectRatio: 1 },
  check: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepRow: { flexDirection: 'row', alignItems: 'center' },
  m3Card: { flex: 1, marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
  sit: { marginHorizontal: 16, marginBottom: 12, padding: 14, gap: 8 },
});
