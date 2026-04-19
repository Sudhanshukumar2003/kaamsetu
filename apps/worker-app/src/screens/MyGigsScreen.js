import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyGigs } from '../store';
import { Card, Badge, EmptyState, LoadingSpinner } from '../components/UI';
import {
  colors, spacing, typography, radius,
  formatRupees, gigStatusColor,
} from '../utils/theme';

const STATUS_TABS = [
  { key: null,          label: 'All' },
  { key: 'accepted',    label: 'Upcoming' },
  { key: 'in_progress', label: 'Active' },
  { key: 'completed',   label: 'Done' },
  { key: 'disputed',    label: 'Disputed' },
];

const GigRow = ({ gig, onPress }) => {
  const statusColor = gigStatusColor(gig.status);
  const date = new Date(gig.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <Card onPress={() => onPress(gig)} style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text style={{ ...typography.h4, color: colors.text }} numberOfLines={1}>{gig.title}</Text>
          <Text style={{ ...typography.bodyS, color: colors.textSecondary, marginTop: 2 }}>
            {gig.trade_name} · {gig.city}
          </Text>
        </View>
        <Badge label={gig.status.replace('_',' ')} color={statusColor} size="sm" />
      </View>

      <View style={{
        flexDirection: 'row', justifyContent: 'space-between',
        marginTop: spacing.sm, paddingTop: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13 }}>📅</Text>
          <Text style={{ ...typography.bodyS, color: colors.textSecondary }}>{date}</Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          {gig.agreed_amount ? (
            <Text style={{ ...typography.h4, color: colors.primary }}>
              {formatRupees(gig.agreed_amount)}
            </Text>
          ) : (
            <Text style={{ ...typography.bodyS, color: colors.textSecondary }}>
              {formatRupees(gig.budget_min)}–{formatRupees(gig.budget_max)}
            </Text>
          )}
          {gig.payment_status && (
            <Text style={{ ...typography.caption, color: colors.textTertiary }}>
              {gig.payment_status === 'escrow_released' ? '✅ Paid' :
               gig.payment_status === 'escrow_held'    ? '🔒 In escrow' : ''}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
};

export default function MyGigsScreen({ navigation }) {
  const dispatch = useDispatch();
  const { myGigs, loading } = useSelector(s => s.gigs);
  const [activeTab, setActiveTab] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { dispatch(fetchMyGigs(activeTab)); }, [activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchMyGigs(activeTab));
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Status tabs */}
      <View style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <FlatList
          data={STATUS_TABS}
          keyExtractor={t => String(t.key)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
          renderItem={({ item: tab }) => (
            <TouchableOpacity
              onPress={() => setActiveTab(tab.key)}
              style={{
                paddingHorizontal: spacing.md, paddingVertical: 8,
                marginRight: spacing.sm,
                borderRadius: radius.full,
                backgroundColor: activeTab === tab.key ? colors.primary : colors.background,
                borderWidth: 1.5,
                borderColor: activeTab === tab.key ? colors.primary : colors.border,
              }}
            >
              <Text style={{
                fontWeight: '600', fontSize: 13,
                color: activeTab === tab.key ? '#fff' : colors.textSecondary,
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={myGigs}
        keyExtractor={g => g.id}
        renderItem={({ item }) => (
          <GigRow gig={item} onPress={g => navigation.navigate('GigDetail', { gigId: g.id })} />
        )}
        ListEmptyComponent={
          loading
            ? <LoadingSpinner />
            : <EmptyState
                emoji="📋"
                title="No gigs yet"
                subtitle={activeTab
                  ? `No ${STATUS_TABS.find(t=>t.key===activeTab)?.label?.toLowerCase()} gigs found.`
                  : 'Accept your first gig from the home screen!'}
              />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
