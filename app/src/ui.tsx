import React, { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { isIOS, useTheme } from './theme';

// iOS 26+ gets Liquid Glass; older iOS keeps the blur look. Glass is never nested inside glass.
export const hasGlass = isIOS && isLiquidGlassAvailable();

// iOS: responds on press-in and springs back from its current value, so it's interruptible.
// Android: Material 3 pill button (40dp, Label Large) with a ripple.
export function Button({
  title,
  onPress,
  disabled,
  danger,
  tonal,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  tonal?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const useGlass = hasGlass;
  const frosted = isIOS && !hasGlass; // iOS before 26: frosted blur instead of true Liquid Glass
  const bg = danger ? t.danger : tonal ? t.tonal : t.accent;
  const fg = danger ? t.onDanger : tonal ? t.onTonal : t.onAccent;
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={() => isIOS && spring(0.97)}
      onPressOut={() => isIOS && spring(1)}
      onPress={() => {
        if (isIOS) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      android_ripple={{ color: fg + '33', borderless: false }}
      style={{ borderRadius: isIOS ? 14 : 20, overflow: 'hidden', opacity: disabled ? (isIOS ? 0.4 : 0.6) : 1 }}
    >
      <Animated.View
        style={[
          isIOS ? s.buttonIOS : s.buttonMD3,
          { backgroundColor: useGlass ? 'transparent' : frosted ? (tonal ? 'transparent' : bg + 'CC') : disabled && !isIOS ? t.text + '1F' : bg, transform: [{ scale }] },
          style,
        ]}
      >
        {frosted && <BlurView intensity={45} tint={t.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
        {useGlass && (
          <GlassView
            isInteractive
            glassEffectStyle="regular"
            tintColor={tonal ? undefined : bg}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Text
          style={[
            s.buttonText,
            { color: disabled && !isIOS ? t.text + '61' : fg },
            isIOS ? { fontWeight: '600', letterSpacing: -0.2 } : { fontWeight: '500', letterSpacing: 0.1 },
          ]}
        >
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// iOS: segmented control. Android: M3 outlined segmented button, selected segment uses secondary-container with a check.
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  caption,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  caption?: string;
}) {
  const t = useTheme();
  if (hasGlass) {
    return (
      <GlassView isInteractive glassEffectStyle="regular" style={s.glassSeg}>
        {caption ? <Text style={{ color: t.text, fontWeight: '600', marginLeft: 10, marginRight: 6 }}>{caption}</Text> : null}
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: on }}
              style={[{ flex: caption ? undefined : 1, minWidth: 40, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 }, on && { backgroundColor: t.accent }]}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(o.value);
              }}
            >
              <Text style={{ color: on ? '#fff' : t.text, fontWeight: on ? '700' : '500' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </GlassView>
    );
  }
  if (!isIOS) {
    return (
      <View style={[s.mdSegWrap, { borderColor: t.outline }]}>
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: on }}
              android_ripple={{ color: t.text + '1F' }}
              style={[
                s.mdSeg,
                i > 0 && { borderLeftWidth: 1, borderLeftColor: t.outline },
                on && { backgroundColor: t.tonal },
              ]}
              onPress={() => onChange(o.value)}
            >
              <Text style={{ color: on ? t.onTonal : t.text, fontSize: 14, fontWeight: '500', letterSpacing: 0.1 }}>
                {on ? '✓  ' : ''}
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <View style={[s.segWrap, { backgroundColor: t.card, borderRadius: 10 }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            style={[s.seg, on && { backgroundColor: t.accent, borderRadius: 8 }]}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(o.value);
            }}
          >
            <Text style={{ color: on ? '#fff' : t.text, fontWeight: on ? '600' : '400' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// iOS: translucent blurred bar that content scrolls under. Android: M3 surface-container with tonal elevation.
export function BottomBar({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  if (hasGlass) {
    // No panel: each control is its own glass capsule floating over the photos. Siblings share one container so they merge as they get close.
    return (
      <GlassContainer spacing={16} style={s.glassDock}>
        {children}
      </GlassContainer>
    );
  }
  if (isIOS) {
    return (
      <BlurView intensity={60} tint={t.dark ? 'dark' : 'light'} style={s.bar}>
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[s.bar, { backgroundColor: t.bar, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 24 }]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  buttonIOS: { paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', borderRadius: 14 },
  buttonMD3: { height: 40, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  buttonText: { fontSize: Platform.OS === 'ios' ? 16 : 14 },
  segWrap: { flexDirection: 'row', padding: 2 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  mdSegWrap: { flexDirection: 'row', borderWidth: 1, borderRadius: 20, height: 40, overflow: 'hidden' },
  mdSeg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28, gap: 12 },
  glassDock: { position: 'absolute', left: 16, right: 16, bottom: 24, gap: 12 },
  glassSeg: { flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 24, overflow: 'hidden' },
});
