import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { signOut, useAuth } from '@/lib/auth';
import { getProfile, updateProfile, type Profile } from '@/lib/profiles';

export default function ProfileScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [signOutLoading, setSignOutLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    try {
      const p = await getProfile(user.id);
      setProfile(p);
      setDraftName(p?.full_name ?? '');
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleSaveName = async () => {
    if (!user) return;

    setSaving(true);
    const { error } = await updateProfile(user.id, {
      full_name: draftName.trim(),
    });
    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      setProfile((prev) =>
        prev ? { ...prev, full_name: draftName.trim() } : prev
      );
      setEditing(false);
    }
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    try {
      const { error } = await signOut();
      if (error) {
        Alert.alert('Error', error.message || 'Failed to sign out.');
        setSignOutLoading(false);
        return;
      }
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
      setSignOutLoading(false);
    }
  };

  if (loadingProfile || authLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      {/* Role Badge */}
      {profile?.role === 'teacher' ? (
        <View style={[styles.roleBadge, styles.roleBadgeTeacher]}>
          <Text style={styles.roleBadgeText}>Teacher</Text>
        </View>
      ) : profile?.role === 'admin' ? (
        <View style={[styles.roleBadge, styles.roleBadgeTeacher]}>
          <Text style={styles.roleBadgeText}>Administrator</Text>
        </View>
      ) : (
        <View style={[styles.roleBadge, styles.roleBadgeStudent]}>
          <Text style={styles.roleBadgeText}>Student</Text>
        </View>
      )}

      {/* Profile Details Card */}
      <View style={styles.infoCard}>
        <Text style={styles.label}>Full Name</Text>
        {editing ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.editInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textSecondary}
              autoFocus
            />
            <Pressable
              style={styles.saveButton}
              onPress={handleSaveName}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setEditing(true)} style={styles.nameRow}>
            <Text style={styles.value}>
              {profile?.full_name || 'Tap to add your name'}
            </Text>
            <Text style={styles.editHint}>Edit</Text>
          </Pressable>
        )}

        <View style={styles.divider} />

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email || 'N/A'}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>User ID</Text>
        <Text style={styles.valueSmall}>{user?.id || 'N/A'}</Text>
      </View>

      <AppButton
        title="Sign Out"
        icon="log-out-outline"
        onPress={handleSignOut}
        disabled={signOutLoading}
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
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  roleBadgeTeacher: {
    backgroundColor: COLORS.primary,
  },
  roleBadgeStudent: {
    backgroundColor: '#C5A059',
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  valueSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editHint: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  nameEditRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  editInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  saveButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
});