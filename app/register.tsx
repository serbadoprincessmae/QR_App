import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signUp } from '@/lib/auth';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    let authenticated = false;

    try {
      const { data, error: authError } = await signUp(
        email.trim(),
        password,
        { full_name: fullName.trim() }
      );

      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        // The root layout observes the Supabase auth state and performs the
        // single redirect into the authenticated route group.
        authenticated = true;
      } else {
        // Email confirmation is enabled → prompt user to check email
        setSuccess(true);
      }
    } catch (err) {
      console.error('Unexpected account registration error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.'
      );
    } finally {
      if (!authenticated) setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Header title="QR Attendance" />
          </View>

          <Text style={styles.title}>Create Account</Text>

          <Text style={styles.subtitle}>
            Register to start recording attendance
          </Text>

          {success ? (
            <View style={styles.successContainer}>
              <Text style={styles.successTitle}>Check your email!</Text>

              <Text style={styles.successText}>
                We sent a confirmation link to {email}. Click the link to verify
                your account, then come back and sign in.
              </Text>

              <Link href="/login" style={styles.link}>
                Back to Sign In
              </Link>
            </View>
          ) : (
            <View style={styles.form}>
              {/* Full Name Field */}
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Jane Doe"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="words"
                editable={!loading}
              />

              {/* Email Field */}
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@school.edu"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />

              <View style={styles.roleNotice}>
                <Text style={styles.roleNoticeText}>
                  New accounts are registered as Students. Teacher and Administrator access must be assigned by the system administrator.
                </Text>
              </View>

              {/* Password Field */}
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
                editable={!loading}
              />

              {/* Confirm Password Field */}
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
                editable={!loading}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              {loading ? (
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                  style={styles.loader}
                />
              ) : (
                <AppButton
                  theme="primary"
                  title="Sign Up"
                  icon="person-add-outline"
                  onPress={handleRegister}
                />
              )}
            </View>
          )}

          {!success && (
            <Link href="/login" style={styles.link}>
              Already have an account? Sign In
            </Link>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  headerContainer: {
    alignItems: 'flex-start', // Left-aligned logo/header area
    marginTop: 20,
    marginBottom: 16,
  },

  title: {
    fontSize: 28,             // 28px bold ink heading
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'left',        // Left-aligned (was center)
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,             // 15px body
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'left',        // Left-aligned (was center)
    marginBottom: 24,
  },

  form: {
    marginBottom: 24,
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
    borderRadius: 10,         // Sharper badge radius (14 -> 10)
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,             // 16px readable font
    color: COLORS.textPrimary,
  },

  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },

  roleChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,         // 10px badge radius
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
  },

  roleChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '14', // Faint green tint
  },

  roleChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  roleChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',        // Bold text when active
  },

  roleNotice: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  roleNoticeText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    fontSize: 14,
    color: COLORS.danger,     // Uses COLORS.danger
    textAlign: 'left',        // Left-aligned (was center)
    marginTop: 12,
    marginBottom: 4,
  },

  loader: {
    marginVertical: 16,
  },

  link: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'left',        // Left-aligned link
    fontWeight: '600',
  },

  successContainer: {
    alignItems: 'flex-start',
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 10,         // 10px badge radius
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'left',
    lineHeight: 20,
    marginBottom: 16,
  },
});