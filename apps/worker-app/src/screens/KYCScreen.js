import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, Image, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useDispatch } from 'react-redux';
import { fetchWorkerProfile } from '../store';
import * as API from '../services/api';
import { Button, Input, Card } from '../components/UI';
import { colors, spacing, typography, radius } from '../utils/theme';

const STEPS = ['aadhaar', 'otp', 'selfie', 'done'];

export default function KYCScreen({ navigation }) {
  const dispatch = useDispatch();
  const [step, setStep]               = useState('aadhaar');
  const [aadhaar, setAadhaar]         = useState('');
  const [requestId, setRequestId]     = useState('');
  const [otpDigits, setOtpDigits]     = useState('');
  const [selfieUri, setSelfieUri]     = useState(null);
  const [selfieBase64, setSelfieBase64] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [cameraFacing, setCameraFacing] = useState('front');
  const [cameraPermission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const stepIndex = STEPS.indexOf(step);

  const initiateKYC = async () => {
    if (aadhaar.length !== 12) {
      Alert.alert('Error', 'Aadhaar number must be exactly 12 digits');
      return;
    }
    setLoading(true);
    try {
      const { data } = await API.initiateKYC(aadhaar);
      setRequestId(data.data.requestId);
      setStep('otp');
    } catch (err) {
      Alert.alert('KYC Failed', err.response?.data?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) return;
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      setSelfieUri(photo.uri);
      setSelfieBase64(`data:image/jpeg;base64,${photo.base64}`);
      setStep('otp'); // go back to confirm with selfie
    } catch {
      Alert.alert('Error', 'Could not capture photo');
    } finally {
      setLoading(false);
    }
  };

  const verifyKYC = async () => {
    if (otpDigits.length !== 6) {
      Alert.alert('Error', 'Enter the 6-digit OTP sent to your Aadhaar-linked mobile');
      return;
    }
    setLoading(true);
    try {
      const { data } = await API.verifyKYC(requestId, otpDigits, selfieBase64);
      setStep('done');
      dispatch(fetchWorkerProfile());
      Alert.alert(
        '✅ KYC Verified!',
        `Your Work ID is: ${data.data.workId}\n\nWelcome to KaamSetu, ${data.data.name}!`,
        [{ text: 'Continue', onPress: () => navigation.replace('Main') }]
      );
    } catch (err) {
      Alert.alert('Verification Failed', err.response?.data?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  // Progress indicator
  const ProgressBar = () => (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.xl }}>
      {['Aadhaar', 'OTP', 'Selfie', 'Done'].map((label, i) => (
        <View key={label} style={{ flex: 1, alignItems: 'center' }}>
          <View style={{
            width: '100%', height: 4, borderRadius: 2,
            backgroundColor: i <= stepIndex ? colors.primary : colors.border,
          }} />
          <Text style={{ fontSize: 9, marginTop: 4, color: i <= stepIndex ? colors.primary : colors.textTertiary }}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );

  // ── Step: Aadhaar entry ──────────────────────────────────────────────
  if (step === 'aadhaar') return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}>
      <ProgressBar />

      <Text style={{ ...typography.h2, color: colors.text, marginBottom: spacing.xs }}>
        Verify your identity
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl }}>
        We use Aadhaar to create your permanent Work ID. Your data is encrypted and never shared.
      </Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md }}>
          <Text style={{ fontSize: 28 }}>🪪</Text>
          <View>
            <Text style={{ ...typography.h4, color: colors.text }}>Work ID</Text>
            <Text style={{ ...typography.bodyS, color: colors.textSecondary }}>
              Your digital professional identity
            </Text>
          </View>
        </View>
        {['Verified by Aadhaar', 'Permanent & portable', 'Required to accept gigs'].map(item => (
          <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ color: colors.success }}>✓</Text>
            <Text style={{ ...typography.bodyS, color: colors.textSecondary }}>{item}</Text>
          </View>
        ))}
      </Card>

      <Input
        label="Aadhaar Number"
        value={aadhaar}
        onChangeText={t => setAadhaar(t.replace(/\D/g, '').slice(0, 12))}
        keyboardType="number-pad"
        maxLength={12}
        placeholder="XXXX XXXX XXXX"
      />

      <Text style={{ ...typography.caption, color: colors.textTertiary, marginBottom: spacing.lg }}>
        An OTP will be sent to the mobile number linked with your Aadhaar.
      </Text>

      <Button
        title="Send Aadhaar OTP"
        onPress={initiateKYC}
        loading={loading}
        disabled={aadhaar.length !== 12}
        size="lg"
      />
    </ScrollView>
  );

  // ── Step: OTP + selfie trigger ───────────────────────────────────────
  if (step === 'otp') return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}>
      <ProgressBar />

      <Text style={{ ...typography.h2, color: colors.text, marginBottom: spacing.sm }}>
        Verify OTP
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl }}>
        Enter the 6-digit OTP sent to your Aadhaar-registered mobile number.
      </Text>

      <Input
        label="Aadhaar OTP"
        value={otpDigits}
        onChangeText={t => setOtpDigits(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="Enter 6-digit OTP"
      />

      {/* Selfie section */}
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={{ ...typography.h4, color: colors.text, marginBottom: spacing.sm }}>
          Take a selfie
        </Text>
        <Text style={{ ...typography.bodyS, color: colors.textSecondary, marginBottom: spacing.md }}>
          We match your face with your Aadhaar photo to confirm your identity.
        </Text>
        {selfieUri ? (
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <Image source={{ uri: selfieUri }}
              style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: colors.success }} />
            <Text style={{ color: colors.success, fontWeight: '600' }}>✓ Selfie captured</Text>
            <TouchableOpacity onPress={() => setStep('selfie')}>
              <Text style={{ color: colors.primary, fontWeight: '500' }}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Button
            title="📷 Take Selfie"
            variant="secondary"
            onPress={async () => {
              if (!cameraPermission?.granted) await requestPermission();
              setStep('selfie');
            }}
          />
        )}
      </Card>

      <Button
        title="Verify & Get Work ID"
        onPress={verifyKYC}
        loading={loading}
        disabled={otpDigits.length < 6}
        size="lg"
      />
    </ScrollView>
  );

  // ── Step: Camera ─────────────────────────────────────────────────────
  if (step === 'selfie') return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        ref={cameraRef}
        facing={cameraFacing}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'space-between', padding: spacing.lg }}>
          {/* Face guide oval */}
          <View style={{ alignItems: 'center', marginTop: 80 }}>
            <View style={{
              width: 200, height: 240,
              borderRadius: 100,
              borderWidth: 3,
              borderColor: 'rgba(255,255,255,0.7)',
            }} />
            <Text style={{ color: '#fff', marginTop: spacing.md, textAlign: 'center' }}>
              Place your face within the oval
            </Text>
          </View>

          {/* Controls */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: spacing.xl }}>
            <TouchableOpacity onPress={() => setStep('otp')}>
              <Text style={{ color: '#fff', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={capturePhoto}
              style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: '#fff',
                borderWidth: 4, borderColor: colors.primary,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {loading
                ? <ActivityIndicator color={colors.primary} />
                : <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary }} />
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() =>
              setCameraFacing(f => f === 'front' ? 'back' : 'front')}>
              <Text style={{ color: '#fff', fontSize: 16 }}>Flip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );

  return null;
}
