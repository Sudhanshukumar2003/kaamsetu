import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, Image,
} from 'react-native';
import { colors, spacing, radius, typography, shadows } from '../utils/theme';

// ─── Button ───────────────────────────────────────────────────────────
export const Button = ({
  title, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, style, icon,
}) => {
  const isDisabled = disabled || loading;
  const variants = {
    primary:   { bg: colors.primary,     text: '#fff',              border: colors.primary },
    secondary: { bg: colors.surface,     text: colors.primary,      border: colors.primary },
    success:   { bg: colors.success,     text: '#fff',              border: colors.success },
    danger:    { bg: colors.danger,      text: '#fff',              border: colors.danger },
    ghost:     { bg: 'transparent',      text: colors.textSecondary, border: 'transparent' },
  };
  const sizes = {
    sm: { height: 36, px: 14, fontSize: 13 },
    md: { height: 50, px: 20, fontSize: 15 },
    lg: { height: 56, px: 24, fontSize: 17 },
  };
  const v = variants[variant];
  const s = sizes[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[{
        height: s.height,
        paddingHorizontal: s.px,
        backgroundColor: isDisabled ? colors.surfaceAlt : v.bg,
        borderColor: isDisabled ? colors.border : v.border,
        borderWidth: 1.5,
        borderRadius: radius.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }, style]}
    >
      {loading
        ? <ActivityIndicator color={v.text} size="small" />
        : <>
            {icon}
            <Text style={{ fontSize: s.fontSize, fontWeight: '600', color: isDisabled ? colors.textTertiary : v.text }}>
              {title}
            </Text>
          </>
      }
    </TouchableOpacity>
  );
};

// ─── Input ────────────────────────────────────────────────────────────
export const Input = ({
  label, value, onChangeText, placeholder, keyboardType = 'default',
  maxLength, secureTextEntry, editable = true, error,
  prefix, suffix, style, inputStyle, multiline, numberOfLines,
}) => (
  <View style={[{ marginBottom: spacing.md }, style]}>
    {label && (
      <Text style={{ ...typography.label, color: colors.textSecondary, marginBottom: 6 }}>
        {label}
      </Text>
    )}
    <View style={[{
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1.5,
      borderColor: error ? colors.danger : editable ? colors.border : colors.surfaceAlt,
      borderRadius: radius.md,
      backgroundColor: editable ? colors.surface : colors.surfaceAlt,
      paddingHorizontal: spacing.md,
      minHeight: multiline ? 96 : 50,
    }]}>
      {prefix && <Text style={{ color: colors.textSecondary, marginRight: 6, fontSize: 15 }}>{prefix}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        editable={editable}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={[{
          flex: 1,
          fontSize: 15,
          color: colors.text,
          paddingVertical: multiline ? spacing.sm : 0,
          textAlignVertical: multiline ? 'top' : 'center',
        }, inputStyle]}
      />
      {suffix}
    </View>
    {error && (
      <Text style={{ ...typography.caption, color: colors.danger, marginTop: 4 }}>
        {error}
      </Text>
    )}
  </View>
);

// ─── Card ─────────────────────────────────────────────────────────────
export const Card = ({ children, style, onPress, variant = 'default' }) => {
  const cardStyle = [
    {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: variant === 'outlined' ? 1.5 : 0,
      borderColor: colors.border,
    },
    variant !== 'outlined' && shadows.sm,
    style,
  ];
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle}>{children}</View>;
};

// ─── Badge ────────────────────────────────────────────────────────────
export const Badge = ({ label, color = colors.info, size = 'md' }) => {
  const pad = size === 'sm' ? { px: 8, py: 3, fs: 10 } : { px: 12, py: 5, fs: 12 };
  return (
    <View style={{
      backgroundColor: color + '22',
      borderRadius: radius.full,
      paddingHorizontal: pad.px,
      paddingVertical: pad.py,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: color + '44',
    }}>
      <Text style={{ fontSize: pad.fs, fontWeight: '600', color }}>
        {label}
      </Text>
    </View>
  );
};

// ─── Avatar ───────────────────────────────────────────────────────────
export const Avatar = ({ name, uri, size = 48, color = colors.primary }) => {
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View style={{
      width: size, height: size,
      borderRadius: size / 2,
      backgroundColor: color + '22',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: color + '44',
    }}>
      <Text style={{
        fontSize: size * 0.36,
        fontWeight: '700',
        color,
      }}>
        {initials}
      </Text>
    </View>
  );
};

// ─── LoadingSpinner ───────────────────────────────────────────────────
export const LoadingSpinner = ({ message = 'Loading...' }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={{ ...typography.bodyS, color: colors.textSecondary }}>
      {message}
    </Text>
  </View>
);

// ─── EmptyState ───────────────────────────────────────────────────────
export const EmptyState = ({ emoji = '📭', title, subtitle, action }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
    <Text style={{ fontSize: 56, marginBottom: spacing.md }}>{emoji}</Text>
    <Text style={{ ...typography.h3, color: colors.text, textAlign: 'center', marginBottom: spacing.sm }}>
      {title}
    </Text>
    {subtitle && (
      <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg }}>
        {subtitle}
      </Text>
    )}
    {action}
  </View>
);

// ─── Section header ───────────────────────────────────────────────────
export const SectionHeader = ({ title, right }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
    <Text style={{ ...typography.h4, color: colors.text }}>{title}</Text>
    {right}
  </View>
);

// ─── Divider ──────────────────────────────────────────────────────────
export const Divider = ({ style }) => (
  <View style={[{ height: 1, backgroundColor: colors.border }, style]} />
);

// ─── Toggle (availability switch) ─────────────────────────────────────
export const AvailabilityToggle = ({ isAvailable, onToggle, loading }) => (
  <TouchableOpacity
    onPress={onToggle}
    disabled={loading}
    activeOpacity={0.8}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isAvailable ? colors.successLight : colors.surfaceAlt,
      borderRadius: radius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: 8,
      borderWidth: 1.5,
      borderColor: isAvailable ? colors.success : colors.border,
    }}
  >
    <View style={{
      width: 10, height: 10,
      borderRadius: 5,
      backgroundColor: isAvailable ? colors.success : colors.textTertiary,
    }} />
    <Text style={{
      fontWeight: '600',
      fontSize: 13,
      color: isAvailable ? colors.success : colors.textSecondary,
    }}>
      {loading ? 'Updating...' : isAvailable ? 'Available for work' : 'Not available'}
    </Text>
  </TouchableOpacity>
);
