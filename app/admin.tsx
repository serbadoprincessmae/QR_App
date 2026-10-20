import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AdminScreen() {
  const router = useRouter();
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalAttendance, setTotalAttendance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAdminStats = useCallback(async () => {
    try {
      const [users, events, attendance] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('attendance').select('id', { count: 'exact', head: true }),
      ]);
      if (users.error) throw users.error;
      if (events.error) throw events.error;
      if (attendance.error) throw attendance.error;
      setTotalUsers(users.count ?? 0);
      setTotalEvents(events.count ?? 0);
      setTotalAttendance(attendance.count ?? 0);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminStats();
  }, [fetchAdminStats]);

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      Alert.alert('Unable to sign out', error.message);
      return;
    }
    router.replace('/login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.subtitle}>Welcome, System Administrator</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.infoTitle}>Users</Text>
          <Text style={styles.infoText}>{loading ? '—' : totalUsers}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.infoTitle}>Events</Text>
          <Text style={styles.infoText}>{loading ? '—' : totalEvents}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.infoTitle}>Attendance</Text>
          <Text style={styles.infoText}>{loading ? '—' : totalAttendance}</Text>
        </View>
      </View>

      {/* Administrator Management Hub Requirements */}
      <Text style={styles.sectionHeader}>Management Modules</Text>

      {/* 1. Manage Users Route */}
      <TouchableOpacity 
        style={styles.cardButton} 
        onPress={() => router.push('/admin/users' as any)}
      >
        <Text style={styles.cardTitle}>👥 Manage Users</Text>
        <Text style={styles.cardDesc}>View, update roles, or manage accounts</Text>
      </TouchableOpacity>

      {/* 2. Manage Events Route */}
      <TouchableOpacity 
        style={styles.cardButton} 
        onPress={() => router.push('/admin/events' as any)}
      >
        <Text style={styles.cardTitle}>📅 Manage Events</Text>
        <Text style={styles.cardDesc}>Create, edit, or close school events</Text>
      </TouchableOpacity>

      {/* 3. Attendance & Reports Route */}
      <TouchableOpacity 
        style={styles.cardButton} 
        onPress={() => router.push('/admin/attendance' as any)}
      >
        <Text style={styles.cardTitle}>📊 Attendance & Reports</Text>
        <Text style={styles.cardDesc}>View overall attendance logs and correct records</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <View style={{ marginTop: 20 }}>
        <AppButton theme="primary" title="Sign Out" icon="log-out-outline" onPress={handleLogout} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: COLORS.background,
    flexGrow: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  cardButton: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
