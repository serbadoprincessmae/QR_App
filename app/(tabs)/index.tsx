
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';

export default function Index() {
  const { user } = useAuth();
  const [role, setRole] = useState<string>('student');

  useEffect(() => {
    let active = true;

    if (user?.id) {
      getProfile(user.id)
        .then((profile) => {
          if (active && profile?.role) {
            setRole(profile.role);
          }
        })
        .catch((error) => {
          console.error('Failed to load user role:', error);
        });
    }

    return () => {
      active = false;
    };
  }, [user?.id]);

  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin';

  const dashboardTitle = isAdmin
    ? 'ADMIN DASHBOARD'
    : isTeacher
      ? 'TEACHER DASHBOARD'
      : 'STUDENT DASHBOARD';

  const welcomeMessage = isAdmin
    ? 'Manage users, events, and attendance records.'
    : isTeacher
      ? 'Create events, generate QR codes, and monitor student attendance.'
      : 'Make your event attendance simple. Scan your event QR code and keep track of your attendance records.';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Header title="QR Attendance" />
        </View>

        <View style={styles.welcomeCard}>
          <Text style={styles.eyebrow}>{dashboardTitle}</Text>
          <Text style={styles.mainTitle}>Welcome back!</Text>
          <Text style={styles.subtitle}>{welcomeMessage}</Text>

          <View style={styles.badge}>
            <View style={styles.statusDot} />
            <Text style={styles.badgeText}>
              {isAdmin
                ? 'System management'
                : isTeacher
                  ? 'Event management made easy'
                  : 'Attendance made easy'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Text style={styles.sectionSubtitle}>
            Choose what you want to do today.
          </Text>

          {isTeacher || isAdmin ? (
            <>
              <View style={styles.actionCard}>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>Manage Events</Text>
                  <Text style={styles.actionDescription}>
                    Create events and generate QR codes for attendance.
                  </Text>
                </View>
                <AppButton
                  theme="primary"
                  title="Open Events"
                  icon="calendar-outline"
                  onPress={() =>
                    router.push(isAdmin ? '/admin/events' : '/teacher')
                  }
                />
              </View>

              <View style={styles.actionCard}>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>Attendance Records</Text>
                  <Text style={styles.actionDescription}>
                    Review and monitor attendance records.
                  </Text>
                </View>
                <AppButton
                  title="View Attendance"
                  icon="people-outline"
                  onPress={() =>
                    router.push(isAdmin ? '/admin/attendance' : '/history')
                  }
                />
              </View>

              {isAdmin && (
                <View style={styles.actionCard}>
                  <View style={styles.actionText}>
                    <Text style={styles.actionTitle}>Manage Users</Text>
                    <Text style={styles.actionDescription}>
                      View and manage student and teacher accounts.
                    </Text>
                  </View>
                  <AppButton
                    title="Open Users"
                    icon="person-outline"
                    onPress={() => router.push('/admin/users')}
                  />
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.actionCard}>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>Scan Event QR</Text>
                  <Text style={styles.actionDescription}>
                    Record your attendance at a school event.
                  </Text>
                </View>
                <AppButton
                  theme="primary"
                  title="Scan QR Code"
                  icon="qr-code-outline"
                  onPress={() => router.push('/scan')}
                />
              </View>

              <View style={styles.actionCard}>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>Attendance History</Text>
                  <Text style={styles.actionDescription}>
                    Review your previously recorded attendance.
                  </Text>
                </View>
                <AppButton
                  title="View History"
                  icon="time-outline"
                  onPress={() => router.push('/history')}
                />
              </View>
            </>
          )}

          <View style={styles.actionCard}>
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>My Profile</Text>
              <Text style={styles.actionDescription}>
                View your account and sign-out options.
              </Text>
            </View>
            <AppButton
              title="Open Profile"
              icon="person-outline"
              onPress={() => router.push('/profile')}
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            {isAdmin
              ? 'Administrator reminder'
              : isTeacher
                ? 'Teacher reminder'
                : 'Remember'}
          </Text>
          <Text style={styles.infoText}>
            {isAdmin
              ? 'Manage accounts and attendance records carefully. Only authorized changes should be made.'
              : isTeacher
                ? 'Create and save an event before sharing its QR code with students.'
                : 'Scan the correct QR code for your event. Duplicate attendance records should not be accepted.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  headerContainer: {
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 20,
  },
  welcomeCard: {
    marginHorizontal: 20,
    padding: 22,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: COLORS.primary,
    marginBottom: 12,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSecondary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  actionCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  actionText: {
    marginBottom: 14,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  actionDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },
  infoCard: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
});
