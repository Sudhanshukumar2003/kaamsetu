import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Alert, TouchableOpacity,
} from 'react-native';
import * as Location from 'expo-location';
import { useDispatch, useSelector } from 'react-redux';
import { fetchWorkerProfile, updateProfile, logout } from '../store';
import * as API from '../services/api';
import {
  Button, Input, Card, Badge, Avatar, Divider, LoadingSpinner,
} from '../components/UI';
import {
  colors, spacing, typography, radius, shadows,
  formatRupees, skillLevelColor,
} from '../utils/theme';

const TRADES = [
  { slug: 'electrician', label: 'Electrician ⚡' },
  { slug: 'plumber',     label: 'Plumber 🔧' },
  { slug: 'carpenter',   label: 'Carpenter 🪚' },
  { slug: 'painter',     label: 'Painter 🎨' },
  { slug: 'mason',       label: 'Mason 🧱' },
  { slug: 'welder',      label: 'Welder 🔥' },
  { slug: 'ac_technician', label: 'AC Technician ❄️' },
  { slug: 'driver',      label: 'Driver 🚗' },
  { slug: 'helper',      label: 'Helper 🏗️' },
];

const SKILL_LEVELS = ['beginner', 'intermediate', 'expert', 'master'];

const KycStatusBadge = ({ status }) => {
  const config = {
    pending:   { label: 'KYC Pending',   color: colors.warning },
    submitted: { label: 'KYC Submitted', color: colors.info },
    verified:  { label: 'KYC Verified ✓',  color: colors.success },
    rejected:  { label: 'KYC Rejected',  color: colors.danger },
  };
  const c = config[status] || config.pending;
  return <Badge label={c.label} color={c.color} />;
};

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { profile, loading } = useSelector(s => s.worker);
  const { user } = useSelector(s => s.auth);

  const [editing, setEditing]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [upiId,   setUpiId]     = useState('');
  const [savingUpi, setSavingUpi] = useState(false);

  // Editable fields
  const [fullName, setFullName]         = useState('');
  const [tradeSlug, setTradeSlug]       = useState('');
  const [skillLevel, setSkillLevel]     = useState('');
  const [yearsExp, setYearsExp]         = useState('');
  const [bio, setBio]                   = useState('');
  const [lat, setLat]                   = useState('');
  const [lng, setLng]                   = useState('');
  const [city, setCity]                 = useState('');
  const [state, setState]               = useState('');
  const [pincode, setPincode]           = useState('');

  useEffect(() => {
    dispatch(fetchWorkerProfile());
  }, []);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setTradeSlug(profile.trade_slug || '');
      setSkillLevel(profile.skill_level || 'beginner');
      setYearsExp(String(profile.years_experience || 0));
      setBio(profile.bio || '');
      setUpiId(profile.upi_id || '');
      setLat(profile.lat ? String(profile.lat) : '');
      setLng(profile.lng ? String(profile.lng) : '');
      setCity(profile.city || '');
      setState(profile.state || '');
      setPincode(profile.pincode || '');
    }
  }, [profile]);

  const handleUseLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow location access to auto-fill.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(String(pos.coords.latitude));
      setLng(String(pos.coords.longitude));

      const geo = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (geo && geo[0]) {
        setCity(geo[0].city || geo[0].subregion || '');
        setState(geo[0].region || '');
        setPincode(geo[0].postalCode || '');
      }
    } catch (err) {
      Alert.alert('Location error', err.message || 'Could not fetch location');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await dispatch(updateProfile({
        fullName,
        tradeSlug,
        skillLevel,
        yearsExperience: parseInt(yearsExp) || 0,
        bio,
        lat: lat ? parseFloat(lat) : undefined,
        lng: lng ? parseFloat(lng) : undefined,
        city: city || undefined,
        state: state || undefined,
        pincode: pincode || undefined,
      })).unwrap();
      setEditing(false);
      Alert.alert('✅ Saved!', 'Your profile has been updated.');
    } catch (err) {
      Alert.alert('Error', err || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUpi = async () => {
    if (!upiId.match(/^[\w.\-]+@[\w]+$/)) {
      Alert.alert('Invalid UPI ID', 'Enter a valid UPI ID like yourname@upi');
      return;
    }
    setSavingUpi(true);
    try {
      await API.saveBankDetails(upiId);
      Alert.alert('✅ Saved!', 'Your UPI ID has been saved. Payments will be sent here.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save UPI ID');
    } finally {
      setSavingUpi(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: () => dispatch(logout()),
      },
    ]);
  };

  if (!profile) return <LoadingSpinner message="Loading profile..." />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
        <Avatar name={profile.full_name} size={80} />
        <Text style={{ ...typography.h2, color: colors.text, marginTop: spacing.sm }}>
          {profile.full_name || 'Your Name'}
        </Text>
        <Text style={{ ...typography.bodyS, color: colors.textSecondary, marginTop: 2 }}>
          +91 {profile.phone}
        </Text>
        {profile.work_id && (
          <Text style={{ ...typography.caption, color: colors.textTertiary, marginTop: 4 }}>
            Work ID: {profile.work_id}
          </Text>
        )}
        <View style={{ marginTop: spacing.sm }}>
          <KycStatusBadge status={profile.kyc_status} />
        </View>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        {[
          { icon: '✅', label: 'Gigs Done',   value: profile.total_gigs || 0 },
          { icon: '⭐', label: 'Rating',       value: profile.avg_rating ? `${profile.avg_rating.toFixed(1)}/5` : '–' },
          { icon: '💰', label: 'Total Earned', value: profile.total_earnings ? formatRupees(profile.total_earnings) : '₹0' },
        ].map(s => (
          <View key={s.label} style={{
            flex: 1, backgroundColor: colors.surface,
            borderRadius: radius.md, padding: spacing.sm,
            alignItems: 'center', ...shadows.sm,
          }}>
            <Text style={{ fontSize: 22 }}>{s.icon}</Text>
            <Text style={{ ...typography.h4, color: colors.text, marginTop: 4 }}>{s.value}</Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* KYC prompt */}
      {profile.kyc_status !== 'verified' && (
        <Card style={{ marginBottom: spacing.md, backgroundColor: colors.warningLight, borderWidth: 1.5, borderColor: colors.warning }}>
          <Text style={{ ...typography.h4, color: colors.warning }}>⚠️ KYC Required</Text>
          <Text style={{ ...typography.bodyS, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.sm }}>
            Complete Aadhaar verification to start accepting gigs and receiving payments.
          </Text>
          <Button title="Complete KYC" onPress={() => navigation.navigate('KYC')} variant="secondary" size="sm" />
        </Card>
      )}

      {/* Profile fields */}
      <Card style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={{ ...typography.h4, color: colors.text }}>Work Profile</Text>
          <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)}>
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
              {editing ? 'Save' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {editing ? (
          <>
            <Input label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Your full name" />

            {/* Trade selector */}
            <Text style={{ ...typography.label, color: colors.textSecondary, marginBottom: 6 }}>Trade</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
              {TRADES.map(t => (
                <TouchableOpacity
                  key={t.slug}
                  onPress={() => setTradeSlug(t.slug)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6,
                    borderRadius: radius.full,
                    borderWidth: 1.5,
                    borderColor: tradeSlug === t.slug ? colors.primary : colors.border,
                    backgroundColor: tradeSlug === t.slug ? colors.primaryLight : colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: tradeSlug === t.slug ? colors.primary : colors.textSecondary }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Skill level */}
            <Text style={{ ...typography.label, color: colors.textSecondary, marginBottom: 6 }}>Skill Level</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
              {SKILL_LEVELS.map(level => (
                <TouchableOpacity
                  key={level}
                  onPress={() => setSkillLevel(level)}
                  style={{
                    flex: 1, paddingVertical: 8,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: skillLevel === level ? skillLevelColor(level) : colors.border,
                    backgroundColor: skillLevel === level ? skillLevelColor(level) + '22' : colors.surface,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: skillLevel === level ? skillLevelColor(level) : colors.textSecondary }}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Years of Experience" value={yearsExp} onChangeText={setYearsExp} keyboardType="number-pad" />
            <Input label="Bio (optional)" value={bio} onChangeText={setBio} multiline numberOfLines={3} placeholder="Tell hirers about your work..." />

            <Text style={{ ...typography.label, color: colors.textSecondary, marginBottom: 6 }}>Location</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <Button title="Use current location" variant="secondary" onPress={handleUseLocation} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Input label="Latitude" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
              <Input label="Longitude" value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Input label="City" value={city} onChangeText={setCity} style={{ flex: 1 }} />
              <Input label="State" value={state} onChangeText={setState} style={{ flex: 1 }} />
            </View>
            <Input label="Pincode" value={pincode} onChangeText={setPincode} keyboardType="number-pad" maxLength={6} />

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} style={{ flex: 1 }} />
              <Button title="Save Profile" onPress={handleSave} loading={saving} style={{ flex: 2 }} />
            </View>
          </>
        ) : (
          <>
            {[
              { label: 'Name',        value: profile.full_name || '–' },
              { label: 'Trade',       value: profile.trade_name || '–' },
              { label: 'Skill Level', value: profile.skill_level || '–' },
              { label: 'Experience',  value: profile.years_experience ? `${profile.years_experience} years` : '–' },
            ].map((row, i) => (
              <React.Fragment key={row.label}>
                {i > 0 && <Divider style={{ marginVertical: 8 }} />}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ ...typography.bodyS, color: colors.textSecondary }}>{row.label}</Text>
                  <Text style={{ ...typography.bodyS, color: colors.text, fontWeight: '500' }}>{row.value}</Text>
                </View>
              </React.Fragment>
            ))}
            {profile.bio ? (
              <>
                <Divider style={{ marginVertical: 8 }} />
                <Text style={{ ...typography.bodyS, color: colors.textSecondary }}>Bio</Text>
                <Text style={{ ...typography.bodyS, color: colors.text, marginTop: 4 }}>{profile.bio}</Text>
              </>
            ) : null}
          </>
        )}
      </Card>

      {/* UPI / Payment details */}
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ ...typography.h4, color: colors.text, marginBottom: spacing.sm }}>
          💰 Payment Details
        </Text>
        <Text style={{ ...typography.bodyS, color: colors.textSecondary, marginBottom: spacing.md }}>
          Add your UPI ID to receive payments instantly after job completion.
        </Text>
        <Input
          label="UPI ID"
          value={upiId}
          onChangeText={setUpiId}
          placeholder="yourname@upi"
          suffix={
            upiId ? (
              <TouchableOpacity onPress={handleSaveUpi}>
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                  {savingUpi ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </Card>

      {/* Logout */}
      <Button
        title="Log Out"
        variant="secondary"
        onPress={handleLogout}
        size="md"
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  );
}
