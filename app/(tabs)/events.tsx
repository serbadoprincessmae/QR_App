
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import {
  getAvailableEvents,
  type CloudEvent,
} from '@/lib/events';

export default function EventsScreen() {
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage('');

    try {
      const result = await getAvailableEvents();
      setEvents(result);
    } catch (error) {
      console.error('Unable to load available events:', error);
      setErrorMessage('Unable to load events. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadEvents(true)}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.header}>
          <Header title="Available Events" />
        </View>

        <Text style={styles.subtitle}>
          View school events and check their details.
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={styles.loader}
          />
        ) : errorMessage ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Unable to load events</Text>
            <Text style={styles.emptyText}>{errorMessage}</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No available events yet</Text>
            <Text style={styles.emptyText}>
              Events created by your teacher will appear here when they are
              saved and marked as open. Pull down to refresh.
            </Text>
          </View>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>OPEN</Text>
              </View>

              <Text style={styles.eventTitle}>{event.title}</Text>

              {event.description ? (
                <Text style={styles.eventDescription}>
                  {event.description}
                </Text>
              ) : null}

              {event.venue ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Venue</Text>
                  <Text style={styles.detailValue}>{event.venue}</Text>
                </View>
              ) : null}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Start</Text>
                <Text style={styles.detailValue}>
                  {event.start_time
                    ? new Date(event.start_time).toLocaleString()
                    : 'Not specified'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>End</Text>
                <Text style={styles.detailValue}>
                  {event.end_time
                    ? new Date(event.end_time).toLocaleString()
                    : 'Not specified'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 28,
  },
  header: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    marginHorizontal: 20,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },
  loader: {
    marginTop: 40,
  },
  eventCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    marginBottom: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  eventTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  detailRow: {
    marginTop: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  emptyCard: {
    marginHorizontal: 20,
    padding: 22,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },
});
