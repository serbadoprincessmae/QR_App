import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: 'primary';
  onPress: () => void;
  disabled?: boolean;
};

export default function AppButton({
  title,
  icon,
  theme,
  onPress,
  disabled = false,
}: Props) {
  const isPrimary = theme === 'primary';

  return (
    <View style={[styles.buttonOuter, disabled && styles.disabled]}>
      <Pressable
        style={[
          styles.buttonInner,
          isPrimary ? styles.primaryFill : styles.secondaryFill,
        ]}
        onPress={onPress}
        disabled={disabled}
      >
        <Ionicons
          name={icon}
          size={22}
          color={isPrimary ? COLORS.textOnPrimary : COLORS.textSecondary}
          style={styles.icon}
        />

        <Text
          style={[
            styles.label,
            isPrimary ? styles.primaryLabel : styles.secondaryLabel,
          ]}
        >
          {title}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonOuter: {
    width: '100%',
    marginBottom: 14,
  },

  buttonInner: {
    borderRadius: 10, // Sharper badge feel (gikan 14/18px)
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  primaryFill: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  secondaryFill: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  icon: {
    paddingRight: 10,
  },

  label: {
    fontSize: 17,
  },

  primaryLabel: {
    color: COLORS.textOnPrimary,
    fontWeight: '700', // 700 weight for primary
  },

  secondaryLabel: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  disabled: {
    opacity: 0.5,
  },
});