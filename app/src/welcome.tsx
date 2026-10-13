import React, { useRef, useState } from 'react';
import { FlatList, Image, Pressable, SafeAreaView, StatusBar, Text, View, useWindowDimensions } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { StatusBar as SystemBar } from 'expo-status-bar';
import { isIOS, useTheme } from './theme';
import { Button } from './ui';

// An empty marker file remembers that the welcome was seen; no storage library needed for one flag.
const seenFile = new File(Paths.document, 'welcome-seen');
export const welcomeSeen = () => {
  try {
    return seenFile.exists;
  } catch {
    return true; // never block the app over a storage error
  }
};

const PAGES = [
  { icon: null, title: 'Keep your best shots', body: 'Photo Cleaner groups a day of photos into moments, like the beach, dinner or the dog, and picks the best shot of each.' },
  { icon: '🗂', title: 'Nothing is deleted', body: 'The extra shots move to a "Photo Cleaner Archive" album. Photos that don\'t fit any moment are left alone.' },
  { icon: '🔒', title: 'Private by design', body: 'Only small, low-resolution copies are checked, and they are never stored. No account, no ads, no tracking.' },
];

export function Welcome({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const list = useRef<FlatList>(null);
  const last = page === PAGES.length - 1;

  const finish = () => {
    try {
      seenFile.create();
    } catch {}
    onDone();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <SystemBar style="auto" />
      <View style={{ alignItems: 'flex-end', padding: 16, paddingTop: 16 + (StatusBar.currentHeight ?? 0), minHeight: 56 }}>
        {!last && (
          <Pressable accessibilityRole="button" hitSlop={12} onPress={finish}>
            <Text style={{ color: t.accent, fontSize: isIOS ? 17 : 14, fontWeight: '500' }}>Skip</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        ref={list}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.title}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
            {item.icon ? (
              <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: t.tonal, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 52 }}>{item.icon}</Text>
              </View>
            ) : (
              <Image source={require('../assets/icon.png')} style={{ width: 120, height: 120, borderRadius: 28 }} accessibilityIgnoresInvertColors />
            )}
            <Text accessibilityRole="header" style={{ color: t.text, fontSize: isIOS ? 28 : 28, fontWeight: isIOS ? '700' : '400', textAlign: 'center' }}>
              {item.title}
            </Text>
            <Text style={{ color: t.subtext, fontSize: 16, lineHeight: 24, textAlign: 'center' }}>{item.body}</Text>
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 24 }} accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>
        {PAGES.map((p, i) => (
          <View key={p.title} style={{ width: i === page ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? t.accent : t.tonal }} />
        ))}
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Button
          title={last ? 'Get started' : 'Next'}
          onPress={() => (last ? finish() : (list.current?.scrollToIndex({ index: page + 1 }), setPage(page + 1)))}
        />
      </View>
    </SafeAreaView>
  );
}
