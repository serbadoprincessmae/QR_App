import { getEventByCode } from './events';
import { parseQRPayload } from './qr';
import { supabase } from './supabase';

// ==============================
// TYPES
// ==============================

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

// Phase 10: Summary Type (Headcount only)
export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

// Phase 10: Attendance Type (Full Details + Student Name)
export type TeacherEventAttendance = {
  eventId: string;
  title: string;
  eventCode: string;
  startTime: string | null;
  attendeeCount: number;
  attendees: {
    studentId: string;
    studentName?: string;
    scannedAt: string;
  }[];
};

// Helper aron sakto ang pagbasa sa local time gikan sa DB string (gitangtang ang Z o timezone offset)
function parseLocalDateTime(dateStr: string | null): number | null {
  if (!dateStr) return null;
  // Kuhaon lang ang YYYY-MM-DDTHH:mm:ss parte ug i-parse as local time
  const cleanStr = dateStr.replace(/\+.*$/, '').replace(/Z$/, '');
  const parsed = new Date(cleanStr.includes('T') ? cleanStr : cleanStr.replace(' ', 'T'));
  return isNaN(parsed.getTime()) ? null : parsed.getTime();
}

// ==============================
// REGISTER ATTENDANCE (Student)
// ==============================

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) return { success: false, message: parsed.message };

  // Never trust a user ID supplied by the screen; bind attendance to the
  // authenticated Supabase user. RLS is still required as the server-side guard.
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const signedInUser = authData.user;
  if (authError || !signedInUser) {
    return { success: false, message: 'Please sign in before recording attendance.' };
  }
  if (signedInUser.id !== studentId) {
    return { success: false, message: 'You are not allowed to record attendance for another user.' };
  }

  const payload = parsed.payload;
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, status')
    .eq('event_code', payload.event.trim())
    .maybeSingle();

  if (eventError) {
    return { success: false, message: 'Could not validate this event. Please try again.' };
  }
  if (!event) {
    return { success: false, message: 'This QR code does not match an existing event.' };
  }
  if (event.status !== 'open') {
    return { success: false, message: 'This event is closed and no longer accepts attendance.', eventTitle: event.title };
  }

  // Gigamit ang parseLocalDateTime aron dili ma-convert sa UTC angoras sa event
  const now = Date.now();
  const start = parseLocalDateTime(event.start_time);
  const end = parseLocalDateTime(event.end_time);

  if (start !== null && now < start) {
    return { success: false, message: 'Event has not started yet.', eventTitle: event.title };
  }
  if (end !== null && now > end) {
    return { success: false, message: 'Event has already ended.', eventTitle: event.title };
  }

  const { error: attendanceError } = await supabase.from('attendance').insert({
    student_id: signedInUser.id,
    event_id: event.id,
  });

  if (attendanceError) {
    if (attendanceError.code === '23505') {
      return { success: false, message: 'You have already recorded attendance for this event.', eventTitle: event.title };
    }
    if (attendanceError.code === '42501') {
      return { success: false, message: 'You are not authorized to record attendance for this event.', eventTitle: event.title };
    }
    console.error('Attendance insert failed:', attendanceError.message);
    return { success: false, message: 'Attendance could not be recorded. Please try again.', eventTitle: event.title };
  }

  return { success: true, message: 'Attendance recorded successfully!', eventTitle: event.title };
}

// ==============================
// GET ATTENDANCE HISTORY (Student)
// ==============================

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, scanned_at, events ( event_code, title )')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    scannedAt: row.scanned_at,
  }));
}

// ==============================
// GET TEACHER EVENT SUMMARY (Phase 10: Count-Only Pattern)
// ==============================

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  // 1. Get teacher's events
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events || events.length === 0) {
    return [];
  }

  const eventIds = events.map((e) => e.id);

  // 2. Lightweight fetch: ONLY select 'event_id'
  const { data: attRows, error: attError } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError) {
    console.error('Error fetching attendance summary counts:', attError);
  }

  const safeRows = attRows ?? [];

  // 3. Count occurrences using dictionary
  const counts: Record<string, number> = {};
  safeRows.forEach((r: any) => {
    counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
  });

  // 4. Map events to summaries with fallback to 0
  return events.map((e: any) => ({
    eventId: e.id,
    eventCode: e.event_code ?? '',
    title: e.title,
    attendeeCount: counts[e.id] ?? 0,
  }));
}

// ==============================
// GET TEACHER EVENT ATTENDANCE (Full Details)
// ==============================

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events || events.length === 0) {
    return [];
  }

  // Fetch attendance records directly without implicit FK join
  const eventIds = events.map((event: any) => event.id);
  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, event_id')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });

  if (attError) {
    console.error('Error fetching attendance records:', attError);
  }

  const safeAttendance = attendance ?? [];

  // Fetch profiles separately to map student names safely
  const studentIds = Array.from(
    new Set(safeAttendance.map((a: any) => a.student_id).filter(Boolean))
  );

  let profileMap: Record<string, string> = {};

  if (studentIds.length > 0) {
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', studentIds);

    if (!profError && profiles) {
      profiles.forEach((p: any) => {
        profileMap[p.id] = p.full_name || p.email || p.id;
      });
    }
  }

  return events.map((e: any) => {
    const rows = safeAttendance.filter(
      (a: any) => a.event_id === e.id || a.event_id === e.event_code
    );

    return {
      eventId: e.id,
      eventCode: e.event_code ?? '',
      title: e.title,
      startTime: e.start_time,
      attendeeCount: rows.length,
      attendees: rows.map((a: any) => ({
        studentId: a.student_id,
        studentName: profileMap[a.student_id],
        scannedAt: a.scanned_at,
      })),
    };
  });
}