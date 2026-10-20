import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import {
  deleteEvent,
  getAllEvents,
  setEventStatus,
  updateEvent,
  type CloudEvent,
} from '@/lib/events';
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

export default function AdminEventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    setErrorMessage('');
    try {
      setEvents(await getAllEvents());
    } catch (error) {
      console.error('Error fetching events:', error);
      setErrorMessage('Unable to load events. Check administrator access and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchEvents();
    }, [fetchEvents])
  );

  const editEvent = async (event: CloudEvent) => {
    setSaving(true);
    try {
      await updateEvent(event.id, { title, description, venue, start, end });
      setEditingId(null);
      await fetchEvents();
    } catch (error) {
      console.error('Unable to update event:', error);
      Alert.alert('Unable to update event', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (event: CloudEvent) => {
    Alert.alert('Delete event?', `This also removes attendance for "${event.title}".`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(event.id);
            await fetchEvents();
          } catch (error) {
            console.error('Unable to delete event:', error);
            Alert.alert('Unable to delete event', 'Check administrator permissions and try again.');
          }
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
        <Text style={styles.title}>Event Management</Text>
      </View>
      <Text style={styles.subtitle}>School events: {events.length}</Text>
      <View style={styles.createButton}>
        <AppButton
          theme="primary"
          title="Create event / generate QR"
          icon="add-circle-outline"
          onPress={() => router.push('/teacher')}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.eventCard}>
              <View style={styles.cardHeading}>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName}>{item.title}</Text>
                  <Text style={styles.eventDetails}>Code: {item.event_code}</Text>
                  <Text style={styles.eventDetails}>
                    {item.start_time ? new Date(item.start_time).toLocaleString() : 'Start not specified'}
                  </Text>
                  <Text style={styles.eventDetails}>
                    Status: {item.status === 'closed' ? 'Closed' : 'Open'}
                  </Text>
                </View>
                <Ionicons
                  name={item.status === 'closed' ? 'close-circle-outline' : 'checkmark-circle-outline'}
                  size={22}
                  color={item.status === 'closed' ? COLORS.textSecondary : COLORS.success}
                />
              </View>

              {editingId === item.id ? (
                <View style={styles.editor}>
                  <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Event title" placeholderTextColor={COLORS.textSecondary} />
                  <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={COLORS.textSecondary} />
                  <TextInput style={styles.input} value={venue} onChangeText={setVenue} placeholder="Venue" placeholderTextColor={COLORS.textSecondary} />
                  <TextInput style={styles.input} value={start} onChangeText={setStart} placeholder="Start date/time (ISO)" placeholderTextColor={COLORS.textSecondary} />
                  <TextInput style={styles.input} value={end} onChangeText={setEnd} placeholder="End date/time (ISO)" placeholderTextColor={COLORS.textSecondary} />
                  <View style={styles.actions}>
                    <Pressable style={styles.actionButton} disabled={saving} onPress={() => editEvent(item)}>
                      <Text style={styles.actionText}>{saving ? 'Saving...' : 'Save'}</Text>
                    </Pressable>
                    <Pressable style={styles.actionButton} onPress={() => setEditingId(null)}>
                      <Text style={styles.actionText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => {
                      setTitle(item.title);
                      setDescription(item.description ?? '');
                      setVenue(item.venue ?? '');
                      setStart(item.start_time ?? '');
                      setEnd(item.end_time ?? '');
                      setEditingId(item.id);
                    }}
                  >
                    <Text style={styles.actionText}>Edit details</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionButton}
                    onPress={async () => {
                      try {
                        await setEventStatus(item.id, item.status === 'closed' ? 'open' : 'closed');
                        await fetchEvents();
                      } catch (error) {
                        console.error('Unable to change event status:', error);
                        Alert.alert('Unable to change status', 'Check administrator permissions and try again.');
                      }
                    }}
                  >
                    <Text style={styles.actionText}>{item.status === 'closed' ? 'Reopen' : 'Close'}</Text>
                  </Pressable>
                  <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => confirmDelete(item)}>
                    <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No events found.</Text>}
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
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 14 },
  createButton: { marginBottom: 14 },
  loader: { marginTop: 30 },
  list: { paddingBottom: 24 },
  eventCard: { backgroundColor: COLORS.card, padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eventInfo: { flex: 1 },
  eventName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  eventDetails: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: { backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  deleteButton: { backgroundColor: '#F7E9E3' },
  deleteText: { color: COLORS.danger },
  editor: { marginTop: 12 },
  input: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, color: COLORS.textPrimary, marginTop: 7 },
  errorText: { fontSize: 14, color: COLORS.danger },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 30 },
});
