import { Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const colors = {
  primary:       '#F4631E',   // KaamSetu orange
  primaryDark:   '#C94E16',
  primaryLight:  '#FFF0EA',
  accent:        '#FFBA08',   // gold
  success:       '#22C55E',
  successLight:  '#DCFCE7',
  warning:       '#F59E0B',
  warningLight:  '#FEF3C7',
  danger:        '#EF4444',
  dangerLight:   '#FEE2E2',
  info:          '#3B82F6',
  infoLight:     '#EFF6FF',

  // Neutrals
  text:          '#111827',
  textSecondary: '#6B7280',
  textTertiary:  '#9CA3AF',
  textInverse:   '#FFFFFF',

  border:        '#E5E7EB',
  borderFocus:   '#F4631E',
  background:    '#F9FAFB',
  surface:       '#FFFFFF',
  surfaceAlt:    '#F3F4F6',

  // KYC status
  kycPending:    '#F59E0B',
  kycVerified:   '#22C55E',
  kycRejected:   '#EF4444',

  // Skill levels
  beginner:      '#6B7280',
  intermediate:  '#3B82F6',
  expert:        '#8B5CF6',
  master:        '#F59E0B',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  full: 9999,
};

export const typography = {
  h1:    { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  h2:    { fontSize: 22, fontWeight: '700', lineHeight: 30 },
  h3:    { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  h4:    { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  body:  { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyS: { fontSize: 13, fontWeight: '400', lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '500', lineHeight: 18 },
  caption:{ fontSize: 11, fontWeight: '400', lineHeight: 16 },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const screen = { width: SCREEN_W, height: SCREEN_H };

export const skillLevelColor = (level) => ({
  beginner:     colors.beginner,
  intermediate: colors.intermediate,
  expert:       colors.expert,
  master:       colors.master,
}[level] || colors.textSecondary);

export const gigStatusColor = (status) => ({
  open:        colors.info,
  matched:     colors.warning,
  accepted:    colors.warning,
  in_progress: colors.primary,
  completed:   colors.success,
  disputed:    colors.danger,
  cancelled:   colors.textSecondary,
}[status] || colors.textSecondary);

export const formatRupees = (paise) =>
  `₹${(paise / 100).toLocaleString('en-IN')}`;
