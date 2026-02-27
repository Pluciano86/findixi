import type { ViewStyle } from 'react-native';

export const primaryOrange = '#EC7F25';
export const primaryBlue = '#2563eb';
export const darkFooter = '#023047';
export const backgroundGray = '#f3f4f6';

export const borderRadius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fonts = {
  light: 'Kanit_300Light',
  regular: 'Kanit_400Regular',
  medium: 'Kanit_500Medium',
  semibold: 'Kanit_600SemiBold',
  bold: 'Kanit_700Bold',
} as const;

export const shadows: { card: ViewStyle; elevated: ViewStyle } = {
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
  },
};
