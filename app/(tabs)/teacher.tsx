import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
    type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
    createEvent,
    getAllEvents,
    getEventsByTeacher,
    setEventStatus,
    updateEvent,
    type CloudEvent,
} from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

type EditTarget = 'start' | 'end';
type EventQR = {
  id?: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
};

function eventQRPayload(event: EventQR) {
  return JSON.stringify({
    v: 1,
    event: event.event_code || event.id,
    title: event.title,
    start: event.start_time,
    end: event.end_time,
  });
}

export default function TeacherScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [lastCreatedEvent, setLastCreatedEvent] = useState<EventQR | null>(null);
  const [qrEvent, setQrEvent] = useState<EventQR | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventError, setEventError] = useState('');
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  const isAndroid = Platform.OS === 'android';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!user) {
        setRoleLoading(false);
        return () => {
          active = false;
        };
      }
      const loadTeacherData = async () => {
        try {
          const profile = await getProfile(user.id);
          if (!active) return;
          setRole(profile?.role ?? null);
          if (profile?.role === 'teacher' || profile?.role === 'admin') {
            setLoadingEvents(true);
            const teacherEvents =
              profile.role === 'admin'
                ? await getAllEvents()
                : await getEventsByTeacher(user.id);
            if (active) setEvents(teacherEvents);
          }
        } catch (error) {
          console.error('Failed to load teacher data:', error);
          if (active) setEventError('Unable to load events. Please try again.');
        } finally {
          if (active) {
            setLoadingEvents(false);
            setRoleLoading(false);
          }
        }
      };
      loadTeacherData();
      return () => {
        active = false;
      };
    }, [user])
  );

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (editTarget === 'start') setStartDate(next);
    else setEndDate(next);

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const handleCreateEvent = async () => {
    const eventData = {
      eventId: eventId.trim(),
      title: title.trim(),
      venue: venue.trim(),
      description: description.trim(),
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
    };

    if (!eventData.title) {
      setMessage('Event title is required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }

    setCreatingEvent(true);
    try {
      const { error, event: createdEvent } = await createEvent(eventData);
      if (error) {
        setMessage(error);
        return;
      }
      if (!createdEvent) {
        setMessage('The event was saved, but its QR code could not be prepared.');
        return;
      }

      setEventId(createdEvent.event_code);
      setMessage(
        eventData.eventId && eventData.eventId === createdEvent.event_code
          ? 'Event saved! Scan the QR with the Scan tab to test it.'
          : `Event saved with generated code ${createdEvent.event_code}. Scan the QR with the Scan tab to test it.`
      );
      setLastCreatedEvent(createdEvent);
      if (user) {
        (role === 'admin' ? getAllEvents() : getEventsByTeacher(user.id))
          .then(setEvents)
          .catch((loadError) => {
            console.error('Failed to refresh events:', loadError);
            setEventError('Event was saved, but the event list could not be refreshed.');
          });
      }
    } catch (error) {
      console.error('Failed to create event:', error);
      setMessage(
        error instanceof Error ? error.message : 'Could not save the event. Please try again.'
      );
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleSaveEvent = async (event: CloudEvent) => {
    try {
      await updateEvent(event.id, {
        title: editTitle,
        description: editDescription,
        venue: editVenue,
        start: editStart,
        end: editEnd,
      });
      setEditingEvent(null);
      if (user) setEvents(role === 'admin' ? await getAllEvents() : await getEventsByTeacher(user.id));
    } catch (error) {
      console.error('Failed to update event:', error);
      setEventError(error instanceof Error ? error.message : 'Unable to update event.');
    }
  };

  const handleToggleEvent = async (event: CloudEvent) => {
    try {
      await setEventStatus(event.id, event.status === 'closed' ? 'open' : 'closed');
      if (user) setEvents(role === 'admin' ? await getAllEvents() : await getEventsByTeacher(user.id));
    } catch (error) {
      console.error('Failed to change event status:', error);
      setEventError('Unable to update event status. Please try again.');
    }
  };

  const showEventQR = (event: CloudEvent) => {
    const selectedQr: EventQR = {
      id: event.id,
      event_code: event.event_code,
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
    };
    setLastCreatedEvent(selectedQr);
    setQrEvent(selectedQr);
  };

  const qrSize = Math.max(
    180,
    Math.min(width - 64, height - insets.top - insets.bottom - 260, 380)
  );

  if (roleLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Checking your account...</Text>
      </View>
    );
  }

  if (role !== 'teacher' && role !== 'admin') {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="lock-closed-outline" size={64} color={COLORS.textSecondary} />
        <Text style={styles.lockTitle}>Teachers Only</Text>
        <Text style={styles.lockSubtitle}>Only teacher and administrator accounts can manage events.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Manage Events & Generate QR</Text>
      <Text style={styles.subtitle}></Text>

      <Text style={styles.label}>Event Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Event Code</Text>
      <TextInput
        style={styles.input}
        value={eventId}
        onChangeText={setEventId}
        placeholder="Optional — generated automatically if blank or already used"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="characters"
      />
      <Text style={styles.hint}>
        Leave blank to generate a unique event code. A replacement code is generated if this one is already in use.
      </Text>

      <Text style={styles.label}>Venue</Text>
      <TextInput
        style={styles.input}
        value={venue}
        onChangeText={setVenue}
        placeholder="e.g. CC Toledo City - AVR"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        value={description}
        onChangeText={setDescription}
        placeholder="What is this event about? (optional)"
        placeholderTextColor={COLORS.textSecondary}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.label}>Starts</Text>
      <PickerField
        value={formatDateTime(startDate)}
        icon="sunny-outline"
        onPress={() => openPicker('start')}
      />

      <Text style={styles.label}>Ends</Text>
      <PickerField
        value={formatDateTime(endDate)}
        icon="moon-outline"
        onPress={() => openPicker('end')}
      />
      <View style={styles.chipRow}>
        {QUICK_END_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            style={styles.chip}
            onPress={() => handleQuickEnd(option.ms)}
          >
            <Text style={styles.chipText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>Tap a chip to set the end time from start.</Text>

      <AppButton
        theme="primary"
        title={creatingEvent ? 'Creating Event...' : 'Create Event'}
        icon="add-circle-outline"
        onPress={handleCreateEvent}
        disabled={creatingEvent}
      />

      {lastCreatedEvent && (
        <View style={styles.resultCard}>
          <Text style={styles.messageText}>
            {message}
          </Text>
          <Text style={styles.resultTitle}>
            Scan this QR code with the Scan tab:
          </Text>
          <View style={styles.qrBox}>
            <QRCode value={eventQRPayload(lastCreatedEvent)} size={200} />
          </View>
          <Text selectable style={styles.payloadText}>
            {eventQRPayload(lastCreatedEvent)}
          </Text>
        </View>
      )}

      {editTarget && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={editTarget === 'start' ? startDate : endDate}
            mode={isAndroid ? editingPart : 'datetime'}
            display={isAndroid ? 'default' : 'spinner'}
            onChange={onPickerChange}
          />
        </View>
      )}

      <View style={styles.eventsSection}>
        <Text style={styles.eventsTitle}>{role === 'admin' ? 'All Events' : 'Your Events'}</Text>
        {eventError ? <Text style={styles.eventError}>{eventError}</Text> : null}
        {loadingEvents ? (
          <ActivityIndicator color={COLORS.primary} style={styles.eventsLoader} />
        ) : events.length === 0 ? (
          <Text style={styles.hint}>Your created events will appear here.</Text>
        ) : events.map((event) => (
          <View key={event.id} style={styles.eventCard}>
            {editingEvent === event.id ? (
              <>
                <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder="Title" placeholderTextColor={COLORS.textSecondary} />
                <TextInput style={styles.input} value={editDescription} onChangeText={setEditDescription} placeholder="Description" placeholderTextColor={COLORS.textSecondary} />
                <TextInput style={styles.input} value={editVenue} onChangeText={setEditVenue} placeholder="Venue" placeholderTextColor={COLORS.textSecondary} />
                <TextInput style={styles.input} value={editStart} onChangeText={setEditStart} placeholder="Start date/time (ISO)" placeholderTextColor={COLORS.textSecondary} />
                <TextInput style={styles.input} value={editEnd} onChangeText={setEditEnd} placeholder="End date/time (ISO)" placeholderTextColor={COLORS.textSecondary} />
                <View style={styles.eventActions}>
                  <Pressable style={styles.eventAction} onPress={() => handleSaveEvent(event)}>
                    <Text style={styles.eventActionText}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.eventAction} onPress={() => setEditingEvent(null)}>
                    <Text style={styles.eventActionText}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.eventName}>{event.title}</Text>
                <Text style={styles.eventMeta}>Code: {event.event_code}</Text>
                <Text style={styles.eventMeta}>Status: {event.status === 'closed' ? 'Closed' : 'Open'}</Text>
                <View style={styles.eventQrPreview}>
                  <QRCode
                    value={eventQRPayload(event)}
                    size={112}
                  />
                  <Text style={styles.eventQrHint}>
                    Scan to record attendance
                  </Text>
                </View>
                <View style={styles.eventActions}>
                  <Pressable style={styles.eventAction} onPress={() => showEventQR(event)}>
                    <Text style={styles.eventActionText}>View QR Code</Text>
                  </Pressable>
                  <Pressable
                    style={styles.eventAction}
                    onPress={() => {
                      setEditTitle(event.title);
                      setEditDescription(event.description ?? '');
                      setEditVenue(event.venue ?? '');
                      setEditStart(event.start_time ?? '');
                      setEditEnd(event.end_time ?? '');
                      setEditingEvent(event.id);
                    }}
                  >
                    <Text style={styles.eventActionText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.eventAction} onPress={() => handleToggleEvent(event)}>
                    <Text style={styles.eventActionText}>{event.status === 'closed' ? 'Reopen' : 'Close'}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ))}
      </View>

      <Modal
        visible={qrEvent !== null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setQrEvent(null)}
      >
        {qrEvent && (
          <View
            style={[
              styles.qrModal,
              {
                paddingTop: insets.top + 16,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close QR code"
              style={styles.qrCloseButton}
              onPress={() => setQrEvent(null)}
            >
              <Ionicons name="close" size={28} color={COLORS.textPrimary} />
            </Pressable>
            <Text style={styles.qrModalTitle}>{qrEvent.title}</Text>
            <Text style={styles.qrModalCode}>
              Event code: {qrEvent.event_code || qrEvent.id}
            </Text>
            <View style={styles.qrModalCodeBox}>
              <QRCode value={eventQRPayload(qrEvent)} size={qrSize} />
            </View>
            <Text style={styles.qrModalHint}>
              Ask students to open Scan and point their camera at this code.
            </Text>
          </View>
        )}
      </Modal>
    </ScrollView>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({ value, icon, onPress }: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pickerField, pressed && styles.pickerFieldPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.pickerValue}>{value}</Text>
      <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  lockTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  lockSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  multilineInput: {
    minHeight: 84,
    paddingTop: 12,
  },
  pickerField: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    backgroundColor: COLORS.surface,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  eventsSection: {
    marginTop: 28,
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  eventsLoader: {
    marginVertical: 18,
  },
  eventError: {
    color: COLORS.danger,
    fontSize: 14,
    marginBottom: 10,
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  eventName: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  eventMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  eventQrPreview: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  eventQrHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  eventActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  eventAction: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  eventActionText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  pickerContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  resultCard: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    color: '#1C1B1F',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  payloadText: {
    alignSelf: 'stretch',
    color: '#666666',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrModal: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: COLORS.background,
  },
  qrCloseButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 1,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: COLORS.surface,
  },
  qrModalTitle: {
    maxWidth: '85%',
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  qrModalCode: {
    marginTop: 8,
    marginBottom: 24,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  qrModalCodeBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  qrModalHint: {
    maxWidth: 300,
    marginTop: 24,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});