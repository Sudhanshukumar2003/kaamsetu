import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginWithOTP, clearError } from '../store';
import * as API from '../services/api';
import { Button, Input } from '../components/UI';
import { colors, spacing, typography, radius } from '../utils/theme';

const RESEND_TIMEOUT = 30;

export default function LoginScreen() {
  const dispatch = useDispatch();
  const { loading, error } = useSelector(s => s.auth);

  const [step, setStep]           = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone]         = useState('');
  const [role, setRole]           = useState('worker');
  const [isNewUser, setIsNewUser] = useState(false);
  const [fullName, setFullName]   = useState('');
  const [otp, setOtp]             = useState(['', '', '', '', '', '']);
  const [sending, setSending]     = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [phoneError, setPhoneError] = useState('');

  const otpRefs = useRef([]);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'OK', onPress: () => dispatch(clearError()) }]);
    }
  }, [error]);

  const startCountdown = () => {
    setCountdown(RESEND_TIMEOUT);
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const validatePhone = (p) => /^[6-9]\d{9}$/.test(p);

  const handleSendOTP = async () => {
    if (!validatePhone(phone)) {
      setPhoneError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setPhoneError('');
    setSending(true);
    try {
      const { data } = await API.sendOTP(phone, role);
      setIsNewUser(data.data.isNewUser);
      setStep('otp');
      startCountdown();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSending(false);
    }
  };

  const handleOTPChange = (val, idx) => {
    const newOtp = [...otp];
    newOtp[idx] = val.replace(/\D/g, '').slice(-1);
    setOtp(newOtp);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!val && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (newOtp.every(d => d !== '') && newOtp.join('').length === 6) {
      handleVerifyOTP(newOtp.join(''));
    }
  };

  const handleVerifyOTP = async (code) => {
    const otpCode = code || otp.join('');
    if (otpCode.length < 6) {
      Alert.alert('Error', 'Enter all 6 digits');
      return;
    }
    dispatch(loginWithOTP({ phone, code: otpCode, role, fullName: fullName || undefined }));
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setSending(true);
    try {
      await API.sendOTP(phone, role);
      startCountdown();
      setOtp(['', '', '', '', '', '']);
    } catch {
      Alert.alert('Error', 'Failed to resend OTP');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Header */}
        <View style={{ alignItems: 'center', marginBottom: spacing.xxl }}>
          <View style={{
            width: 72, height: 72, borderRadius: radius.xl,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: spacing.md,
          }}>
            <Text style={{ fontSize: 32 }}>🔨</Text>
          </View>
          <Text style={{ ...typography.h1, color: colors.text }}>KaamSetu</Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: 4 }}>
            Aapka Kaam, Aapki Pehchaan
          </Text>
        </View>

        {step === 'phone' ? (
          <View>
            <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.xs }}>
              Sign in / Register
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg }}>
              Enter your mobile number to continue
            </Text>

            <Input
              label="Mobile Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              prefix="+91"
              placeholder="9XXXXXXXXX"
              error={phoneError}
            />

            {/* Role selector — only shown for context, auto-set to worker */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
              {['worker', 'hirer'].map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  style={{
                    flex: 1, height: 44, borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: role === r ? colors.primary : colors.border,
                    backgroundColor: role === r ? colors.primaryLight : colors.surface,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{
                    fontWeight: '600', fontSize: 14,
                    color: role === r ? colors.primary : colors.textSecondary,
                  }}>
                    {r === 'worker' ? '👷 Worker' : '🏗️ Hirer'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title="Send OTP"
              onPress={handleSendOTP}
              loading={sending}
              disabled={phone.length < 10}
              size="lg"
            />
          </View>
        ) : (
          <View>
            <TouchableOpacity onPress={() => setStep('phone')} style={{ marginBottom: spacing.md }}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>← Change number</Text>
            </TouchableOpacity>

            <Text style={{ ...typography.h3, color: colors.text, marginBottom: spacing.xs }}>
              Enter OTP
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg }}>
              Sent to +91 {phone}
            </Text>

            {/* Name input for new users */}
            {isNewUser && (
              <Input
                label="Your Full Name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Ramesh Kumar"
              />
            )}

            {/* OTP boxes */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg, justifyContent: 'center' }}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={el => otpRefs.current[idx] = el}
                  value={digit}
                  onChangeText={val => handleOTPChange(val, idx)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  style={{
                    width: 46, height: 54,
                    borderWidth: 1.5,
                    borderColor: digit ? colors.primary : colors.border,
                    borderRadius: radius.md,
                    fontSize: 22, fontWeight: '700',
                    textAlign: 'center',
                    color: colors.text,
                    backgroundColor: colors.surface,
                  }}
                />
              ))}
            </View>

            <Button
              title="Verify & Login"
              onPress={() => handleVerifyOTP()}
              loading={loading}
              disabled={otp.join('').length < 6 || (isNewUser && !fullName.trim())}
              size="lg"
            />

            <TouchableOpacity
              onPress={handleResend}
              disabled={countdown > 0 || sending}
              style={{ alignItems: 'center', marginTop: spacing.lg }}
            >
              <Text style={{ color: countdown > 0 ? colors.textTertiary : colors.primary, fontWeight: '500' }}>
                {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
