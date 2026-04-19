import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, FlatList, RefreshControl,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchGigMatches, fetchWorkerProfile, toggleAvailability,
} from '../store';
import {
  Card, Badge, Button, EmptyState, LoadingSpinner,
  AvailabilityToggle, SectionHeader,
} from '../components/UI';
import { colors, spacing, typography, radius, formatRupees, gigStatusColor, skillLevelColor } from '../utils/theme';
import { formatDistanceToNow } from 'date-fns';

// ─── Gig card ─────────────────────────────────────────────────────────
const GigCard = ({ gig, onPress }) => {
  const budgetRange = `${formatRupees(gig.budget_min)}–${formatRupees(gig.budget_max)}`;
  const startDate   = new Date(gig.start_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <Card onPress={() => onPress(gig)} style={{ marginBottom: spacing.sm }}>
      {/* Urgent banner */}
      {gig.is_urgent && (
        <View style={{
          backgroundColor: colors.danger, borderRadius: radius.sm,
          paddingHorizontal: 10, paddingVertical: 3,
          alignSelf: 'flex-start', marginBottom: spacing.sm,
        }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>⚡ URGENT</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text style={{ ...typography.h4, color: colors.text }} numberOfLines={2}>
            {gig.title}
          </Text>
          <Text style={{ ...typography.bodyS, color: colors.textSecondary, marginTop: 2 }}>
            {gig.trade_name}
          </Text>
        </View>
        <Badge
          label={gig.required_skill_level}
          color={skillLevelColor(gig.required_skill_level)}
          size="sm"
        />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 13 }}>📍</Text>
          <Text style={{ ...typography.bodyS, color: colors.textSecondary }}>
            {gig.city} · {gig.distance_km} km away
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 13 }}>📅</Text>
          <Text style={{ ...typography.bodyS, color: colors.textSecondary }}>{startDate}</Text>
        </View>
        {gig.estimated_hours && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 13 }}>⏱️</Text>
            <Text style={{ ...typography.bodyS, color: colors.textSecondary }}>
              {gig.estimated_hours}h
            </Text>
          </View>
        )}
      </View>

      <View style={{
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border,
      }}>
        <View>
          <Text style={{ ...typography.h3, color: colors.primary }}>{budgetRange}</Text>
          <Text style={{ ...typography.caption, color: colors.textTertiary }}>
            ⭐ {gig.hirer_rating ? gig.hirer_rating.toFixed(1) : 'New'} · {gig.hirer_type?.replace('_', ' ')}
          </Text>
        </View>
        <View style={{
          backgroundColor: colors.primaryLight, borderRadius: radius.md,
          paddingHorizontal: 14, paddingVertical: 8,
          borderWidth: 1.5, borderColor: colors.primary,
        }}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>View</Text>
        </View>
      </View>
    </Card>
  );
};

// ─── KYC reminder banner ─────────────────────────────────────────────
const KYCBanner = ({ onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
    <View style={{
      backgroundColor: colors.warning,
      borderRadius: radius.lg, padding: spacing.md,
      flexDirection: 'row', alignItems: 'center',
      gap: spacing.sm, marginBottom: spacing.md,
    }}>
      <Text style={{ fontSize: 24 }}>⚠️</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: '#fff', fontSize: 14 }}>
          Complete KYC to get gigs
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
          Aadhaar verification required · Takes 5 minutes →
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

// ─── Main Home Screen ─────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { profile }              = useSelector(s => s.worker);
  const { matches, loading, pagination } = useSelector(s => s.gigs);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingAvail, setTogglingAvail] = useState(false);

  useEffect(() => {
    dispatch(fetchWorkerProfile());
    if (profile?.kyc_status === 'verified') dispatch(fetchGigMatches());
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchWorkerProfile());
    if (profile?.kyc_status === 'verified') await dispatch(fetchGigMatches());
    setRefreshing(false);
  }, [profile]);

  const handleToggleAvailability = async () => {
    if (!profile) return;
    setTogglingAvail(true);
    await dispatch(toggleAvailability(!profile.is_available));
    setTogglingAvail(false);
  };

  const loadMore = () => {
    if (pagination?.hasMore && !loading) {
      dispatch(fetchGigMatches({ page: (pagination.page || 1) + 1 }));
    }
  };

  const isKycVerified = profile?.kyc_status === 'verified';

  const ListHeader = () => (
    <View style={{ paddingBottom: spacing.sm }}>
      {/* Greeting */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <View>
          <Text style={{ ...typography.h2, color: colors.text }}>
            Namaste, {profile?.full_name?.split(' ')[0] || 'Worker'} 👋
          </Text>
          {isKycVerified && profile?.work_id && (
            <Text style={{ ...typography.bodyS, color: colors.textSecondary, marginTop: 2 }}>
              Work ID: {profile.work_id}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <View style={{
            width: 42, height: 42, borderRadius: 21,
            backgroundColor: colors.primaryLight,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: colors.primary,
          }}>
            <Text style={{ fontSize: 18 }}>👤</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* KYC banner if needed */}
      {!isKycVerified && (
        <KYCBanner onPress={() => navigation.navigate('KYC')} />
      )}

      {/* Availability toggle */}
      {isKycVerified && (
        <View style={{ marginBottom: spacing.md }}>
          <AvailabilityToggle
            isAvailable={profile?.is_available}
            onToggle={handleToggleAvailability}
            loading={togglingAvail}
          />
        </View>
      )}

      {/* Stats row */}
      {isKycVerified && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {[
            { label: 'Gigs Done', value: profile?.total_gigs || 0, icon: '✅' },
            { label: 'Rating', value: profile?.avg_rating ? profile.avg_rating.toFixed(1) : '–', icon: '⭐' },
            { label: 'Earned', value: profile?.total_earnings ? formatRupees(profile.total_earnings) : '₹0', icon: '💰' },
          ].map(stat => (
            <View key={stat.label} style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.sm,
              alignItems: 'center',
              borderWidth: 1, borderColor: colors.border,
            }}>
              <Text style={{ fontSize: 20 }}>{stat.icon}</Text>
              <Text style={{ ...typography.h4, color: colors.text, marginTop: 2 }}>{stat.value}</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}

      {isKycVerified && (
        <SectionHeader
          title="Nearby Gigs"
          right={
            <Text style={{ ...typography.bodyS, color: colors.primary }}>
              {pagination?.total || 0} found
            </Text>
          }
        />
      )}
    </View>
  );

  if (!profile) return <LoadingSpinner message="Loading your profile..." />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={isKycVerified ? matches : []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <GigCard gig={item} onPress={gig => navigation.navigate('GigDetail', { gigId: gig.id })} />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          isKycVerified
            ? <EmptyState
                emoji="🔍"
                title="No gigs nearby right now"
                subtitle="New gigs are posted daily. Make sure your location and trade are set correctly."
              />
            : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
