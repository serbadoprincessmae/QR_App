import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import {
    getAttendanceHistory,
    getTeacherEventAttendance,
    type AttendanceRecord,
    type TeacherEventAttendance,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

function shortId(id: string) {
  return id ? `…${id.slice(-8)}` : 'unknown';
}

function formatDate(dateString: string | null) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setErrorMessage(null);
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const profile = await getProfile(user.id);
      const currentRole = profile?.role ?? 'student';
      setRole(currentRole);

      if (currentRole === 'teacher') {
        const events = await getTeacherEventAttendance(user.id);
        setTeacherEvents(events);
        setStudentRecords([]);
      } else {
        const records = await getAttendanceHistory(user.id);
        setStudentRecords(records);
        setTeacherEvents([]);
      }
    } catch (err) {
      console.error('Error loading history:', err);
      setErrorMessage('Unable to load attendance records. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      setLoading(true);
      loadData();
      const attendanceChannel = supabase
        .channel(`attendance-history-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance' },
          () => {
            loadData();
          }
        )
        .subscribe((status, error) => {
          if (error) {
            console.error('Attendance realtime subscription failed:', error.message);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('Attendance realtime subscription status:', status);
          }
        });

      return () => {
        supabase.removeChannel(attendanceChannel);
      };
    }, [loadData, user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // --- TEACHER VIEW ---
  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Event Attendance Register</Text>
        <FlatList
          data={teacherEvents}
          keyExtractor={(item) => item.eventId}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.subtitle}>
                {errorMessage || 'Attendance for your events will appear here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {item.attendeeCount} Scanned
                  </Text>
                </View>
              </View>

              <Text style={styles.eventCode}>Code: {item.eventCode}</Text>
              <Text style={styles.eventMeta}>
                Starts: {formatDate(item.startTime)}
              </Text>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Attendees</Text>
              {item.attendees.length === 0 ? (
                <Text style={styles.subText}>No scans recorded yet.</Text>
              ) : (
                item.attendees.map((att, idx) => (
                  <View key={`${att.studentId}-${idx}`} style={styles.attendeeRow}>
                    <Text style={styles.studentIdText}>
                      Student ID: {shortId(att.studentId)}
                    </Text>
                    <Text style={styles.scannedAtText}>
                      {formatDate(att.scannedAt)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        />
      </View>
    );
  }


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance History</Text>
      <FlatList
        data={studentRecords}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.subtitle}>
              {errorMessage || 'Your attended events will appear here.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.eventTitle}>{item.eventTitle}</Text>

            <Text style={styles.eventCode}>
               Code: {(item as any).eventCode || (item as any).event_code || 'N/A'}
            </Text>
            <Text style={styles.eventMeta}>
              Scanned: {formatDate(item.scannedAt)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'left',
    lineHeight: 22,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'flex-start',
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 10,                 
    borderWidth: 1,
    borderColor: COLORS.border,      
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  countBadge: {
    backgroundColor: COLORS.success,  
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  eventCode: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  subText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  attendeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  studentIdText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontFamily: 'monospace',
  },
  scannedAtText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});