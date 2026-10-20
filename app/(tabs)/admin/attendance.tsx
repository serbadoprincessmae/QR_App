import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type AttendanceLog = {
  id: string;
  scanned_at: string;
  student_id: string;
  student_name: string;
  event_id: string;
  event_title: string;
};

type EventSummary = {
  id: string;
  title: string;
  count: number;
};

export default function AdminAttendanceScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [eventSummaries, setEventSummaries] = useState<EventSummary[]>([]);
  const [recentAttendance, setRecentAttendance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [studentId, setStudentId] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTime, setEditedTime] = useState('');

  const fetchAttendance = useCallback(async () => {
    setErrorMessage('');
    try {
      const { data: attendance, error } = await supabase
        .from('attendance')
        .select('id, scanned_at, student_id, event_id')
        .order('scanned_at', { ascending: false });
      if (error) throw error;

      const rows = attendance ?? [];
      const studentIds = [...new Set(rows.map((row) => row.student_id))];
      const eventIds = [...new Set(rows.map((row) => row.event_id))];
      const [profiles, events] = await Promise.all([
        studentIds.length
          ? supabase.from('profiles').select('id, full_name, email').in('id', studentIds)
          : Promise.resolve({ data: [], error: null }),
        eventIds.length
          ? supabase.from('events').select('id, title').in('id', eventIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profiles.error) throw profiles.error;
      if (events.error) throw events.error;

      const names = new Map(
        (profiles.data ?? []).map((profile) => [
          profile.id,
          profile.full_name || profile.email || profile.id,
        ])
      );
      const titles = new Map((events.data ?? []).map((event) => [event.id, event.title]));
      const mappedRows = rows.map((row) => ({
          ...row,
          student_name: names.get(row.student_id) || row.student_id,
          event_title: titles.get(row.event_id) || 'Unknown event',
        }));
      setRecords(mappedRows);

      const counts = new Map<string, EventSummary>();
      mappedRows.forEach((row) => {
        const summary = counts.get(row.event_id);
        if (summary) {
          summary.count += 1;
        } else {
          counts.set(row.event_id, {
            id: row.event_id,
            title: row.event_title,
            count: 1,
          });
        }
      });
      setEventSummaries([...counts.values()].sort((a, b) => b.count - a.count));
      const sinceYesterday = Date.now() - 24 * 60 * 60 * 1000;
      setRecentAttendance(
        mappedRows.filter((row) => new Date(row.scanned_at).getTime() >= sinceYesterday)
          .length
      );
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setErrorMessage('Unable to load attendance records. Check administrator access and database setup.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchAttendance();
    }, [fetchAttendance])
  );

  const addRecord = async () => {
    const normalizedCode = eventCode.trim();
    const normalizedStudent = studentId.trim();
    if (!normalizedCode || !normalizedStudent) {
      Alert.alert('Required fields', 'Enter the student account ID and event code.');
      return;
    }

    setAdding(true);
    try {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, title')
        .eq('event_code', normalizedCode)
        .maybeSingle();
      if (eventError) throw eventError;
      if (!event) {
        Alert.alert('Event not found', 'Check the event code and try again.');
        return;
      }

      const { data: student, error: studentError } = await supabase
        .from('profiles')
        .select('id, role, is_active')
        .eq('id', normalizedStudent)
        .maybeSingle();
      if (studentError) throw studentError;
      if (!student || student.role !== 'student' || student.is_active === false) {
        Alert.alert('Student not found', 'Enter the ID of an active student account.');
        return;
      }

      const { error } = await supabase.from('attendance').insert({
        student_id: normalizedStudent,
        event_id: event.id,
      });
      if (error) throw error;
      setEventCode('');
      setStudentId('');
      await fetchAttendance();
      Alert.alert('Attendance added', `Record added for ${event.title}.`);
    } catch (error) {
      console.error('Unable to add attendance record:', error);
      Alert.alert(
        'Unable to add record',
        error instanceof Error ? error.message : 'Check the student ID and administrator permissions.'
      );
    } finally {
      setAdding(false);
    }
  };

  const correctTime = async (recordId: string) => {
    const parsed = new Date(editedTime);
    if (!editedTime.trim() || Number.isNaN(parsed.getTime())) {
      Alert.alert('Invalid date and time', 'Enter a valid date/time value.');
      return;
    }
    const { data, error } = await supabase
      .from('attendance')
      .update({ scanned_at: parsed.toISOString() })
      .eq('id', recordId)
      .select('id')
      .maybeSingle();
    if (error) {
      Alert.alert('Unable to correct record', error.message);
      return;
    }
    if (!data) {
      Alert.alert('Unable to correct record', 'No record was changed. Check administrator permissions.');
      return;
    }
    setEditingId(null);
    await fetchAttendance();
  };

  const deleteRecord = (recordId: string) => {
    Alert.alert('Delete attendance record?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { data, error } = await supabase
            .from('attendance')
            .delete()
            .eq('id', recordId)
            .select('id')
            .maybeSingle();
          if (error) {
            Alert.alert('Unable to delete record', error.message);
            return;
          }
          if (!data) {
            Alert.alert('Unable to delete record', 'No record was deleted. Check administrator permissions.');
            return;
          }
          await fetchAttendance();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Attendance Reports</Text>
      </View>
      <Text style={styles.subtitle}>Overall attendance records: {records.length}</Text>

      <View style={styles.addCard}>
        <Text style={styles.sectionTitle}>Manually Add Attendance</Text>
        <TextInput
          style={styles.input}
          value={studentId}
          onChangeText={setStudentId}
          placeholder="Student account ID"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={eventCode}
          onChangeText={setEventCode}
          placeholder="Event code"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"
        />
        <Pressable style={styles.primaryButton} disabled={adding} onPress={addRecord}>
          <Text style={styles.primaryButtonText}>
            {adding ? 'Adding...' : 'Add Attendance'}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.reportCard}>
              <Text style={styles.sectionTitle}>System Activity</Text>
              <Text style={styles.reportText}>
                Attendance recorded in the last 24 hours: {recentAttendance}
              </Text>
              <Text style={[styles.sectionTitle, styles.eventSummaryTitle]}>
                Attendance by Event
              </Text>
              {eventSummaries.length ? eventSummaries.map((summary) => (
                <View key={summary.id} style={styles.summaryRow}>
                  <Text style={styles.reportText}>{summary.title}</Text>
                  <Text style={styles.summaryCount}>{summary.count}</Text>
                </View>
              )) : <Text style={styles.reportText}>No event attendance yet.</Text>}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.recordCard}>
              <Text style={styles.userName}>{item.student_name}</Text>
              <Text style={styles.eventTitle}>{item.event_title}</Text>
              <Text style={styles.dateText}>
                {new Date(item.scanned_at).toLocaleString()}
              </Text>
              {editingId === item.id ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={editedTime}
                    onChangeText={setEditedTime}
                    placeholder="YYYY-MM-DD HH:mm"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                  <View style={styles.actions}>
                    <Pressable style={styles.actionButton} onPress={() => correctTime(item.id)}>
                      <Text style={styles.actionText}>Save correction</Text>
                    </Pressable>
                    <Pressable style={styles.actionButton} onPress={() => setEditingId(null)}>
                      <Text style={styles.actionText}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => {
                      const date = new Date(item.scanned_at);
                      const pad = (value: number) => String(value).padStart(2, '0');
                      setEditedTime(
                        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
                          date.getDate()
                        )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
                      );
                      setEditingId(item.id);
                    }}
                  >
                    <Text style={styles.actionText}>Correct time</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => deleteRecord(item.id)}
                  >
                    <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No attendance records yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backButton: { marginRight: 12 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 },
  addCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    marginBottom: 9,
  },
  primaryButton: { backgroundColor: COLORS.primary, padding: 12, borderRadius: 9, alignItems: 'center' },
  primaryButtonText: { color: COLORS.textOnPrimary, fontWeight: '700' },
  loader: { marginTop: 24 },
  list: { paddingBottom: 24 },
  reportCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  eventSummaryTitle: {
    marginTop: 14,
  },
  reportText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 7,
  },
  summaryCount: {
    color: COLORS.primary,
    fontWeight: '700',
    paddingLeft: 12,
  },
  recordCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  eventTitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  dateText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  actionButton: { backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  deleteButton: { backgroundColor: '#F7E9E3' },
  deleteText: { color: COLORS.danger },
  errorText: { color: COLORS.danger, fontSize: 14 },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 24 },
});
