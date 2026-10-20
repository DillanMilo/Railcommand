export const colors = {
  ink: '#0F172A',
  inkSoft: '#1E293B',
  orange: '#F97316',
  orangeDark: '#EA580C',
  orangeText: '#9A3412',
  amber: '#F59E0B',
  cream: '#F3F3EE',
  paper: '#FBFBF8',
  white: '#FFFFFF',
  line: '#D9DCD3',
  lineSoft: '#E2E8F0',
  muted: '#5F6672',
  controlLine: '#7C8490',
  success: '#047857',
  successBright: '#10B981',
  warning: '#A15C00',
  danger: '#DC2626',
  info: '#2563EB',
};

export const fonts = {
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  heading: 'PlusJakartaSans_700Bold',
  headingHeavy: 'PlusJakartaSans_800ExtraBold',
  mono: 'JetBrainsMono_600SemiBold',
} as const;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 40 };

export const radii = { command: 2, control: 2, pill: 2 } as const;
