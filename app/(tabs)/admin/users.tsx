import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { type Role, updateManagedProfile } from '@/lib/profiles';
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

type ManagedUser = {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  is_active: boolean;
};

const ROLES: Role[] = ['student', 'teacher', 'admin'];

export default function UserManagementScreen() {
  const { user: signedInUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');

  const fetchUsers = useCallback(async () => {
    setErrorMessage('');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, is_active')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers((data ?? []) as ManagedUser[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      setErrorMessage('Unable to load users. Check administrator access and run the latest database migration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchUsers();
    }, [fetchUsers])
  );

  const saveAccount = async (
    managedUser: ManagedUser,
    role: Role,
    isActive: boolean,
    fullName = managedUser.full_name ?? ''
  ) => {
    if (managedUser.id === signedInUser?.id && !isActive) {
      Alert.alert('Account protected', 'You cannot deactivate your own administrator account.');
      return;
    }

    setUpdatingUserId(managedUser.id);
    try {
      const { error } = await updateManagedProfile(
        managedUser.id,
        role,
        isActive,
        fullName
      );
      if (error) {
        Alert.alert('Unable to update account', error);
        return;
      }
      await fetchUsers();
    } catch (error) {
      console.error('Unexpected account update error:', error);
      Alert.alert('Unable to update account', 'Please try again.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const chooseRole = (managedUser: ManagedUser) => {
    if (managedUser.id === signedInUser?.id) {
      Alert.alert('Role protected', 'You cannot change your own administrator role.');
      return;
    }

    Alert.alert(`Manage ${managedUser.full_name || managedUser.email}`, 'Select an account role.', [
      { text: 'Cancel', style: 'cancel' },
      ...ROLES.filter((role) => role !== managedUser.role).map((role) => ({
        text: `Set ${role}`,
        onPress: () => saveAccount(managedUser, role, managedUser.is_active),
      })),
    ]);
  };

  const toggleActive = (managedUser: ManagedUser) => {
    const nextActive = !managedUser.is_active;
    Alert.alert(
      nextActive ? 'Reactivate account?' : 'Deactivate account?',
      `${managedUser.full_name || managedUser.email} will ${
        nextActive ? 'be able to sign in' : 'be blocked at sign-in'
      }.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextActive ? 'Reactivate' : 'Deactivate',
          style: nextActive ? 'default' : 'destructive',
          onPress: () => saveAccount(managedUser, managedUser.role, nextActive),
        },
      ]
    );
  };

  const editUserName = (managedUser: ManagedUser) => {
    setEditedName(managedUser.full_name ?? '');
    setEditingUserId(managedUser.id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>User Management</Text>
      </View>

      <Text style={styles.subtitle}>Registered accounts: {users.length}</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfo}>
                {editingUserId === item.id ? (
                  <View style={styles.nameEditRow}>
                    <TextInput
                      style={styles.nameInput}
                      value={editedName}
                      onChangeText={setEditedName}
                      placeholder="Full name"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                    <Pressable
                      style={styles.nameSave}
                      onPress={() => {
                        setEditingUserId(null);
                        saveAccount(item, item.role, item.is_active, editedName);
                      }}
                    >
                      <Text style={styles.nameSaveText}>Save</Text>
                    </Pressable>
                    <Pressable
                      style={styles.nameCancel}
                      onPress={() => setEditingUserId(null)}
                    >
                      <Text style={styles.nameCancelText}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.userName}>
                    {item.full_name || 'Name not provided'}
                    {item.id === signedInUser?.id ? ' (you)' : ''}
                  </Text>
                )}
                <Text style={styles.userEmail}>{item.email}</Text>
                <Text style={styles.userStatus}>
                  {item.is_active ? 'Active account' : 'Deactivated'}
                </Text>
              </View>
              {updatingUserId === item.id ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => chooseRole(item)}
                  >
                    <Text style={styles.actionText}>{item.role}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => editUserName(item)}
                  >
                    <Text style={styles.actionText}>Edit name</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.actionButton,
                      item.is_active ? styles.deactivateButton : styles.activateButton,
                    ]}
                    onPress={() => toggleActive(item)}
                  >
                    <Text style={styles.actionText}>
                      {item.is_active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No registered profiles were found.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  loader: {
    marginTop: 30,
  },
  list: {
    paddingBottom: 24,
  },
  userCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userInfo: {
    marginBottom: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  userStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  nameInput: {
    minWidth: 140,
    flex: 1,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    color: COLORS.textPrimary,
  },
  nameSave: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  nameSaveText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  nameCancel: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  nameCancelText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  deactivateButton: {
    backgroundColor: '#F7E9E3',
  },
  activateButton: {
    backgroundColor: '#E9F0E4',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    marginTop: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 30,
    fontSize: 14,
  },
});
