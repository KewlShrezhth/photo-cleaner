import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { isIOS, useTheme } from './theme';

// Material 3 pieces used on Android. On iOS the app keeps its Apple look and these fall back to simple equivalents.

// Extended FAB: 56dp tall, 16dp corners, primary-container fill, Label Large text.
export function ExtendedFab({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      android_ripple={{ color: t.onPrimaryContainer + '1F' }}
      style={[
        s.fab,
        { backgroundColor: disabled ? t.text + '1F' : t.primaryContainer, elevation: disabled ? 0 : 3 },
      ]}
    >
      <Text style={[s.fabIcon, { color: disabled ? t.text + '61' : t.onPrimaryContainer }]}>✦</Text>
      <Text style={[s.fabLabel, { color: disabled ? t.text + '61' : t.onPrimaryContainer }]}>{label}</Text>
    </Pressable>
  );
}

// Assist chip (Keep) = filled with primary-container; Remove = outlined. Label Large, 8dp corners.
export function StatusChip({ kind, label }: { kind: 'keep' | 'remove' | 'info'; label: string }) {
  const t = useTheme();
  const filled = kind === 'keep';
  return (
    <View
      style={[
        s.chip,
        filled
          ? { backgroundColor: t.primaryContainer }
          : { borderWidth: 1, borderColor: t.outline, backgroundColor: kind === 'info' ? t.tonal : 'transparent' },
      ]}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '500',
          letterSpacing: 0.5,
          color: filled ? t.onPrimaryContainer : kind === 'info' ? t.onTonal : t.subtext,
        }}
      >
        {filled ? '✓  ' : ''}
        {label}
      </Text>
    </View>
  );
}

// Outlined text field with a floating label (label sits on the border when filled or focused).
export function OutlinedField({
  label,
  value,
  onChangeText,
  placeholder,
  onSubmit,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const color = focused ? t.accent : t.outline;
  return (
    <View style={{ marginTop: 6 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={focused ? placeholder : undefined}
        placeholderTextColor={t.subtext}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        style={[s.field, { borderColor: color, borderWidth: focused ? 2 : 1, color: t.text }]}
      />
      <Text
        pointerEvents="none"
        style={[
          s.fieldLabel,
          focused || value
            ? { top: -9, fontSize: 12, color, backgroundColor: t.bg, paddingHorizontal: 4, left: 12 }
            : { top: 17, fontSize: 16, color: t.subtext, left: 16 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// Snackbar: inverse-surface, 4dp corners, auto-dismisses. Returns [element, show()].
export function useNotice(): [React.ReactElement | null, (title: string, message: string) => void] {
  const t = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  const y = useRef(new Animated.Value(80)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(y, { toValue: 80, duration: 200, easing: Easing.bezier(0.3, 0, 0.8, 0.15), useNativeDriver: true }).start(
      () => setMsg(null)
    );
  }, [y]);

  const show = useCallback(
    (title: string, message: string) => {
      if (isIOS) {
        Alert.alert(title, message);
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      setMsg(`${title}. ${message}`);
      Animated.timing(y, { toValue: 0, duration: 400, easing: Easing.bezier(0.05, 0.7, 0.1, 1), useNativeDriver: true }).start();
      timer.current = setTimeout(hide, 4000);
    },
    [hide, y]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const el = msg ? (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[s.snack, { backgroundColor: t.inverse, transform: [{ translateY: y }] }]}
    >
      <Text style={{ color: t.onInverse, fontSize: 14, letterSpacing: 0.25, flex: 1 }}>{msg}</Text>
      <Pressable onPress={hide} hitSlop={12}>
        <Text style={{ color: t.dark ? '#6750A4' : '#D0BCFF', fontSize: 14, fontWeight: '500', letterSpacing: 0.1 }}>Dismiss</Text>
      </Pressable>
    </Animated.View>
  ) : null;
  return [el, show];
}

// Empty state: icon-less, text-first, as Material 3 recommends for first-run screens.
export function EmptyState({ title, body }: { title: string; body: string }) {
  const t = useTheme();
  return (
    <View style={[s.empty, { backgroundColor: t.container }]}>
      <Text style={{ color: t.text, fontSize: 22, lineHeight: 28 }}>{title}</Text>
      <Text style={{ color: t.subtext, fontSize: 14, lineHeight: 20, letterSpacing: 0.25, marginTop: 8 }}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fab: { height: 56, borderRadius: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fabIcon: { fontSize: 18 },
  fabLabel: { fontSize: 14, fontWeight: '500', letterSpacing: 0.1 },
  chip: { alignSelf: 'flex-start', height: 28, borderRadius: 8, paddingHorizontal: 10, justifyContent: 'center' },
  field: { height: 56, borderRadius: 4, paddingHorizontal: 16, fontSize: 16 },
  fieldLabel: { position: 'absolute' },
  snack: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    minHeight: 48,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 6,
  },
  empty: { borderRadius: 12, padding: 20, marginTop: 4 },
});
