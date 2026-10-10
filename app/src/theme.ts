import { Platform, useColorScheme } from 'react-native';

export const isIOS = Platform.OS === 'ios';

// iOS follows Apple's system look (SF font, translucent chrome, springs).
// Android follows Material Design 3 (baseline color scheme, tonal surfaces, pill shapes).
export function useTheme() {
  const dark = useColorScheme() === 'dark';
  if (isIOS) {
    return {
      dark,
      bg: dark ? '#000000' : '#F2F2F7',
      card: dark ? '#1C1C1E' : '#FFFFFF',
      text: dark ? '#FFFFFF' : '#000000',
      subtext: dark ? '#98989F' : '#6C6C70',
      accent: '#007AFF',
      onAccent: '#FFFFFF',
      danger: '#FF3B30',
      onDanger: '#FFFFFF',
      keep: '#34C759',
      tonal: dark ? '#2C2C2E' : '#E5E5EA',
      onTonal: dark ? '#FFFFFF' : '#000000',
      outline: dark ? '#38383A' : '#C6C6C8',
      bar: dark ? '#1C1C1E' : '#FFFFFF',
      container: dark ? '#1C1C1E' : '#FFFFFF',
      divider: dark ? '#38383A' : '#E5E5EA',
      primaryContainer: dark ? '#0A3A75' : '#D6E8FF',
      onPrimaryContainer: dark ? '#FFFFFF' : '#001B3D',
      inverse: dark ? '#E5E5EA' : '#2C2C2E',
      onInverse: dark ? '#1C1C1E' : '#FFFFFF',
      radius: 14,
      titleTracking: -0.4,
    };
  }
  // Material 3 baseline scheme (md.sys.color.*)
  return dark
    ? {
        dark,
        bg: '#141218', // surface
        card: '#1D1B20', // surface-container-low
        text: '#E6E0E9', // on-surface
        subtext: '#CAC4D0', // on-surface-variant
        accent: '#D0BCFF', // primary
        onAccent: '#381E72', // on-primary
        danger: '#F2B8B5', // error
        onDanger: '#601410', // on-error
        keep: '#D0BCFF',
        tonal: '#4A4458', // secondary-container
        onTonal: '#E8DEF8', // on-secondary-container
        outline: '#938F99',
        bar: '#211F26', // surface-container
        container: '#1D1B20',
        divider: '#49454F', // outline-variant
        primaryContainer: '#4F378B',
        onPrimaryContainer: '#EADDFF',
        inverse: '#E6E0E9', // inverse-surface
        onInverse: '#322F35',
        radius: 12, // shape medium
        titleTracking: 0,
      }
    : {
        dark,
        bg: '#FEF7FF',
        card: '#F7F2FA',
        text: '#1D1B20',
        subtext: '#49454F',
        accent: '#6750A4',
        onAccent: '#FFFFFF',
        danger: '#B3261E',
        onDanger: '#FFFFFF',
        keep: '#6750A4',
        tonal: '#E8DEF8',
        onTonal: '#1D192B',
        outline: '#79747E',
        bar: '#F3EDF7',
        container: '#F7F2FA',
        divider: '#CAC4D0', // outline-variant
        primaryContainer: '#EADDFF',
        onPrimaryContainer: '#21005D',
        inverse: '#322F35', // inverse-surface
        onInverse: '#F5EFF7',
        radius: 12,
        titleTracking: 0,
      };
}
