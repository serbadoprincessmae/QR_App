
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';

export default function TabLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let active = true;

    setRole(null);
    setRoleLoading(true);

    if (!user) {
      setRoleLoading(false);
      return () => {
        active = false;
      };
    }

    getProfile(user.id)
      .then((profile) => {
        if (active) setRole(profile?.role ?? null);
      })
      .catch((error) => {
        console.error('Failed to load user role:', error);
        if (active) setRole(null);
      })
      .finally(() => {
        if (active) setRoleLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const student = !roleLoading && role === 'student';
  const teacher = !roleLoading && role === 'teacher';
  const admin = !roleLoading && role === 'admin';

  const icon = (
    focused: boolean,
    activeName: React.ComponentProps<typeof Ionicons>['name'],
    inactiveName: React.ComponentProps<typeof Ionicons>['name'],
    color: string
  ) => (
    <Ionicons
      name={focused ? activeName : inactiveName}
      color={color}
      size={23}
    />
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerShadowVisible: false,
        headerTintColor: COLORS.textPrimary,
        tabBarActiveTintColor: COLORS.textPrimary,
        tabBarInactiveTintColor: COLORS.shadow,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.warning,
          borderTopWidth: 2,
          height: 70 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          elevation: 10,
          shadowColor: COLORS.shadow,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
        },
        tabBarItemStyle: {
          minHeight: 60,
          marginHorizontal: 2,
          borderRadius: 12,
        },
        tabBarActiveBackgroundColor: COLORS.surface,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: roleLoading || !role ? null : undefined,
          tabBarActiveBackgroundColor: COLORS.surface,
          tabBarIcon: ({ color, focused }) =>
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              color={color}
              size={25}
            />,
        }}
      />

      <Tabs.Screen
        name="events"
        options={{
          title: 'Available Events',
          href: student ? undefined : null,
          tabBarActiveBackgroundColor: COLORS.surface,
          tabBarIcon: ({ color, focused }) =>
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              color={color}
              size={25}
            />,
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          href: student ? undefined : null,
          tabBarActiveBackgroundColor: COLORS.surface,
          tabBarIcon: ({ color, focused }) =>
            <Ionicons
              name={focused ? 'qr-code' : 'qr-code-outline'}
              color={color}
              size={25}
            />,
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          href: student || teacher ? undefined : null,
          tabBarActiveBackgroundColor: COLORS.surface,
          tabBarIcon: ({ color, focused }) =>
            <Ionicons
              name={focused ? 'time' : 'time-outline'}
              color={color}
              size={25}
            />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: roleLoading || !role ? null : undefined,
          tabBarActiveBackgroundColor: COLORS.surface,
          tabBarIcon: ({ color, focused }) =>
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              color={color}
              size={25}
            />,
        }}
      />

      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Manage Events',
          href: teacher || admin ? undefined : null,
          tabBarActiveBackgroundColor: COLORS.surface,
          tabBarIcon: ({ color, focused }) =>
            icon(focused, 'clipboard', 'clipboard-outline', color),
        }}
      />

      <Tabs.Screen name="admin" options={{ href: null }} />
      <Tabs.Screen name="admin/users" options={{ href: null }} />
      <Tabs.Screen name="admin/events" options={{ href: null }} />
      <Tabs.Screen name="admin/attendance" options={{ href: null }} />
    </Tabs>
  );
}
