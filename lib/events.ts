
import { supabase } from '@/lib/supabase';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
  venue?: string;
  description?: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
  venue?: string | null;
  description?: string | null;
  status?: 'open' | 'closed';
};

export type CreatedEvent = Pick<
  CloudEvent,
  'id' | 'event_code' | 'title' | 'start_time' | 'end_time'
>;

export async function createEvent(
  event: Event
): Promise<{ error: string | null; event?: CreatedEvent }> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'You must be logged in to create an event.' };
    }

    let eventCode = event.eventId.trim();
    const title = event.title.trim();

    if (!title) {
      return { error: 'Event title is required.' };
    }

    if (eventCode) {
      const { data: existingEvent, error: lookupError } = await supabase
        .from('events')
        .select('id')
        .eq('event_code', eventCode)
        .maybeSingle();

      if (lookupError) {
        console.error('Unable to check event code:', lookupError.message);
        return { error: 'Unable to check the event code. Please try again.' };
      }
      if (existingEvent) eventCode = '';
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (!eventCode) {
        eventCode = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 8)
          .toUpperCase()}`;
      }

      const { data, error } = await supabase
        .from('events')
        .insert({
          event_code: eventCode,
          title,
          start_time: event.start.trim() || null,
          end_time: event.end.trim() || null,
          venue: event.venue?.trim() || null,
          description: event.description?.trim() || null,
          status: 'open',
          created_by: user.id,
        })
        .select('id, event_code, title, start_time, end_time')
        .single();

      if (!error) return { error: null, event: data };
      if (error.code === '23505') {
        console.warn('Event code already exists; generating a new code.');
        eventCode = '';
        continue;
      }

      console.error('createEvent error:', error.message);
      return { error: error.message };
    }

    return { error: 'Could not generate a unique event code. Please try again.' };
  } catch (error) {
    console.error('Unexpected createEvent error:', error);
    return { error: 'An unexpected error occurred while creating the event.' };
  }
}

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getEventsByTeacher error:', error.message);
    throw error;
  }

  return (data ?? []) as CloudEvent[];
}

export async function getAllEvents(): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CloudEvent[];
}

export async function setEventStatus(
  eventId: string,
  status: 'open' | 'closed'
): Promise<void> {
  const { data, error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', eventId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Event was not updated. Check your permissions.');
}

export async function updateEvent(
  eventId: string,
  updates: Pick<Event, 'title' | 'start' | 'end' | 'venue' | 'description'>
): Promise<void> {
  const title = updates.title.trim();
  if (!title) throw new Error('Event title is required.');
  const { data, error } = await supabase
    .from('events')
    .update({
      title,
      start_time: updates.start.trim() || null,
      end_time: updates.end.trim() || null,
      venue: updates.venue?.trim() || null,
      description: updates.description?.trim() || null,
    })
    .eq('id', eventId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Event was not updated. Check your permissions.');
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { data, error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Event was not deleted. Check your permissions.');
}

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  try {
    const eventCode = code.trim();

    if (!eventCode) {
      return null;
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('event_code', eventCode)
      .maybeSingle();

    if (error) {
      console.error('getEventByCode error:', error.message);
      return null;
    }

    return data as CloudEvent | null;
  } catch (error) {
    console.error('Unexpected getEventByCode error:', error);
    return null;
  }
}

// Fetch events available for students.
export async function getAvailableEvents(): Promise<CloudEvent[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('getAvailableEvents error:', error.message);
      throw error;
    }

    return (data ?? []) as CloudEvent[];
  } catch (error) {
    console.error('Unexpected getAvailableEvents error:', error);
    throw error;
  }
}
