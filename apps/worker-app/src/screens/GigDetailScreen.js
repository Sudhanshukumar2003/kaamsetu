import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Alert, TouchableOpacity, Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { useDispatch, useSelector } from 'react-redux';
import { fetchGigDetail, acceptGigAction } from '../store';
import * as API from '../services/api';
import { Button, Card, Badge, Divider, LoadingSpinner, Input } from '../components/UI';
import {
  colors, spacing, typography, radius, shadows,
  formatRupees, gigStatusColor, skillLevelColor,
} from '../utils/theme';

const InfoRow = ({ icon, label, value, valueColor }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
    <Text style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{icon}</Text>
    <View style={{ flex: 1 }}>
      <Text style={{ ...typography.caption, color: colors.textTertiary }}>{label}</Text>
      <Text style={{ ...typography.body, color: valueColor || colors.text, fontWeight: '500', marginTop: 1 }}>
        {value}
      </Text>
    </View>
  </View>
);

const StatusTimeline = ({ gig }) => {
  const steps = [
    { key: 'open',        label: 'Posted',      done: true },
    { key: 'accepted',    label: 'Accepted',     done: ['accepted','in_progress','completed'].includes(gig.status) },
    { key: 'in_progress', label: 'In Progress',  done: ['in_progress','completed'].includes(gig.status) },
    { key: 'completed',   label: 'Completed',    done: gig.status === 'completed' },
  ];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: s.done ? colors.success : colors.border,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 4,
            }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                {s.done ? '✓' : String(i + 1)}
              </Text>
            </View>
            <Text style={{
              fontSize: 9, textAlign: 'center',
              color: s.done ? colors.success : colors.textTertiary,
              fontWeight: s.done ? '600' : '400',
            }}>
              {s.label}
            </Text>
          </View>
          {i < steps.length - 1 && (
            <View style={{
              height: 2, flex: 0.5, marginBottom: 18,
              backgroundColor: steps[i + 1].done ? colors.success : colors.border,
            }} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

export default function GigDetailScreen({ route, navigation }) {
  const { gigId } = route.params;
  const dispatch  = useDispatch();
  const { activeGig: gig, loading } = useSelector(s => s.gigs);
  const { profile } = useSelector(s => s.worker);

  const [actionLoading, setActionLoading] = useState(false);
  const [agreedAmount, setAgreedAmount]   = useState('');

  useEffect(() => {
    dispatch(fetchGigDetail(gigId));
  }, [gigId]);

  useEffect(() => {
    if (gig) setAgreedAmount(String(Math.round(gig.budget_max / 100)));
  }, [gig]);

  const handleAccept = () => {
    const agreedRupees = parseInt(agreedAmount, 10);
    if (Number.isNaN(agreedRupees)) {
      Alert.alert('Invalid amount', 'Enter a valid agreed amount.');
      return;
    }
    const agreedPaise = agreedRupees * 100;
    if (agreedPaise < gig.budget_min || agreedPaise > gig.budget_max) {
      Alert.alert(
        'Amount out of range',
        `Agreed amount must be between ${formatRupees(gig.budget_min)} and ${formatRupees(gig.budget_max)}.`
      );
      return;
    }
    Alert.alert(
      'Accept this gig?',
      `You are agreeing to work for ${formatRupees(agreedPaise)}.\n\nThis amount will be held in escrow until the job is confirmed complete.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept Gig',
          onPress: async () => {
            setActionLoading(true);
            try {
              await dispatch(acceptGigAction({ gigId: gig.id, agreedAmount: agreedPaise })).unwrap();
              Alert.alert('🎉 Gig Accepted!', 'The hirer has been notified. Prepare for the job date.');
              dispatch(fetchGigDetail(gigId));
            } catch (err) {
              Alert.alert('Error', err || 'Could not accept gig');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCheckin = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location needed', 'Enable location to check in at the job site.');
      return;
    }
    setActionLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { data } = await API.checkinGig(gig.id, loc.coords.latitude, loc.coords.longitude);
      const within = data.data.withinRange;
      Alert.alert(
        within ? '📍 Checked In!' : '⚠️ Checked In (Far)',
        within
          ? `You are ${data.data.distanceFromSite} from the job site. Work has started!`
          : `You are ${data.data.distanceFromSite} from the listed address. The hirer has been notified.`
      );
      dispatch(fetchGigDetail(gigId));
    } catch (err) {
      Alert.alert('Check-in failed', err.response?.data?.message || 'Please try again');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = () => {
    Alert.alert(
      'Mark job as complete?',
      'The hirer will be notified to confirm and release your payment.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Complete',
          onPress: async () => {
            setActionLoading(true);
            try {
              await API.completeGig(gig.id);
              Alert.alert('✅ Done!', 'Waiting for hirer to confirm. Payment will be released shortly.');
              dispatch(fetchGigDetail(gigId));
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Please try again');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDispute = () => {
    Alert.prompt(
      'Raise a Dispute',
      'Describe the issue briefly:',
      async (description) => {
        if (!description?.trim()) return;
        setActionLoading(true);
        try {
          await API.raiseDispute(gig.id, 'Payment or work issue', description);
          Alert.alert('Dispute Raised', 'Our team will review within 24 hours. Payment is frozen until resolved.');
          dispatch(fetchGigDetail(gigId));
        } catch (err) {
          Alert.alert('Error', err.response?.data?.message || 'Could not raise dispute');
        } finally {
          setActionLoading(false);
        }
      },
      'plain-text'
    );
  };

  if (loading || !gig) return <LoadingSpinner message="Loading gig details..." />;

  const statusColor = gigStatusColor(gig.status);
  const paymentHeld = gig.payment_status === 'escrow_held';
  const startDate = new Date(gig.start_date).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Status pill */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Badge label={gig.status.replace('_', ' ').toUpperCase()} color={statusColor} />
        {gig.is_urgent && <Badge label="URGENT" color={colors.danger} />}
      </View>

      {/* Title */}
      <Text style={{ ...typography.h2, color: colors.text, marginBottom: spacing.xs }}>
        {gig.title}
      </Text>
      {gig.description && (
        <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.md }}>
          {gig.description}
        </Text>
      )}

      {/* Timeline */}
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ ...typography.h4, color: colors.text, marginBottom: spacing.xs }}>
          Job Progress
        </Text>
        <StatusTimeline gig={gig} />
      </Card>

      {/* Details card */}
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ ...typography.h4, color: colors.text, marginBottom: spacing.sm }}>
          Job Details
        </Text>
        <InfoRow icon="🔧" label="Trade" value={gig.trade_name} />
        <Divider />
        <InfoRow icon="⭐" label="Skill Required" value={gig.required_skill_level}
          valueColor={skillLevelColor(gig.required_skill_level)} />
        <Divider />
        <InfoRow icon="📅" label="Date" value={startDate} />
        {gig.start_time && (
          <>
            <Divider />
            <InfoRow icon="⏰" label="Start Time" value={gig.start_time} />
          </>
        )}
        {gig.estimated_hours && (
          <>
            <Divider />
            <InfoRow icon="⏱️" label="Duration" value={`~${gig.estimated_hours} hours`} />
          </>
        )}
        <Divider />
        <InfoRow icon="📍" label="Location" value={gig.address + ', ' + gig.city} />
      </Card>

      {/* Payment card */}
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={{ ...typography.h4, color: colors.text, marginBottom: spacing.sm }}>
          Payment
        </Text>
        {gig.agreed_amount ? (
          <>
            <InfoRow icon="💰" label="Agreed Amount" value={formatRupees(gig.agreed_amount)}
              valueColor={colors.success} />
            <InfoRow icon="🏦" label="Your Payout (90%)"
              value={formatRupees(Math.round(gig.agreed_amount * 0.9))}
              valueColor={colors.primary} />
            <InfoRow icon="🔒" label="Payment Status"
              value={gig.payment_status?.replace('_', ' ') || 'Pending'}
              valueColor={gig.payment_status === 'escrow_held' ? colors.warning : colors.textSecondary} />
          </>
        ) : (
          <>
            <InfoRow icon="💰" label="Budget Range"
              value={`${formatRupees(gig.budget_min)} – ${formatRupees(gig.budget_max)}`} />
            <Text style={{ ...typography.caption, color: colors.textTertiary, marginTop: 4 }}>
              Your payout is 90% of agreed amount after 10% platform fee.
            </Text>
            <Input
              label="Agreed Amount (INR)"
              value={agreedAmount}
              onChangeText={setAgreedAmount}
              keyboardType="number-pad"
              placeholder="Enter amount"
            />
          </>
        )}
      </Card>

      {/* Hirer card */}
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={{ ...typography.h4, color: colors.text, marginBottom: spacing.sm }}>
          Hirer
        </Text>
        <InfoRow icon="🏗️" label="Name" value={gig.hirer_name || 'Anonymous'} />
        {gig.business_type && (
          <>
            <Divider />
            <InfoRow icon="🏢" label="Type" value={gig.business_type.replace('_', ' ')} />
          </>
        )}
        {gig.hirer_rating > 0 && (
          <>
            <Divider />
            <InfoRow icon="⭐" label="Rating" value={`${gig.hirer_rating.toFixed(1)} / 5.0`} />
          </>
        )}
      </Card>

      {/* Action buttons based on status */}
      {gig.status === 'open' && (
        <Button
          title="✅ Accept This Gig"
          onPress={handleAccept}
          loading={actionLoading}
          size="lg"
        />
      )}

      {gig.status === 'accepted' && (
        <View style={{ gap: spacing.sm }}>
          {!paymentHeld && (
            <Card style={{ backgroundColor: colors.warningLight, borderWidth: 1.5, borderColor: colors.warning }}>
              <Text style={{ ...typography.bodyS, color: colors.warning, textAlign: 'center' }}>
                ⏳ Waiting for hirer to deposit escrow. Check-in unlocks once payment is held.
              </Text>
            </Card>
          )}
          <Button
            title="📍 Check In at Job Site"
            onPress={handleCheckin}
            loading={actionLoading}
            size="lg"
            disabled={!paymentHeld}
          />
        </View>
      )}

      {gig.status === 'in_progress' && (
        <View style={{ gap: spacing.sm }}>
          {!paymentHeld && (
            <Card style={{ backgroundColor: colors.warningLight, borderWidth: 1.5, borderColor: colors.warning }}>
              <Text style={{ ...typography.bodyS, color: colors.warning, textAlign: 'center' }}>
                ⏳ Escrow not deposited. Completion is blocked until payment is held.
              </Text>
            </Card>
          )}
          <Button
            title="✅ Mark Job Complete"
            onPress={handleComplete}
            loading={actionLoading}
            variant="success"
            size="lg"
            disabled={!paymentHeld}
          />
          <Button
            title="⚠️ Raise a Dispute"
            onPress={handleDispute}
            variant="secondary"
            size="md"
          />
        </View>
      )}

      {gig.status === 'completed' && (
        <Card style={{ backgroundColor: colors.successLight, borderWidth: 1.5, borderColor: colors.success }}>
          <Text style={{ ...typography.h4, color: colors.success, textAlign: 'center' }}>
            🎉 Job Complete!
          </Text>
          <Text style={{ ...typography.bodyS, color: colors.success, textAlign: 'center', marginTop: 4 }}>
            Payment of {formatRupees(Math.round((gig.agreed_amount || 0) * 0.9))} will be released to your UPI once the hirer confirms.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}
