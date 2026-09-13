/**
 * src/components/TouchButton.tsx
 *
 * One-Handed Ergonomics: Min 52-56dp Touch Target.
 * High-Contrast Colors (WCAG AAA >= 7:1) for outdoor rural sunlight.
 */

import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { THEME } from "../constants/theme";

interface TouchButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "danger" | "secondary" | "outline" | "success";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const TouchButton: React.FC<TouchButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const getContainerStyle = () => {
    switch (variant) {
      case "danger":
        return styles.dangerContainer;
      case "success":
        return styles.successContainer;
      case "secondary":
        return styles.secondaryContainer;
      case "outline":
        return styles.outlineContainer;
      case "primary":
      default:
        return styles.primaryContainer;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "outline":
        return styles.outlineText;
      case "secondary":
        return styles.secondaryText;
      default:
        return styles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.baseContainer,
        getContainerStyle(),
        disabled && styles.disabledContainer,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" ? THEME.colors.primary : "#FFFFFF"}
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.baseText, getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    minHeight: THEME.touchTarget.largeHeight,
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    borderRadius: THEME.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryContainer: {
    backgroundColor: THEME.colors.primary,
    borderWidth: 1,
    borderColor: THEME.colors.primaryDark,
  },
  dangerContainer: {
    backgroundColor: THEME.colors.emergencyBorder,
    borderWidth: 1,
    borderColor: THEME.colors.emergencyText,
  },
  successContainer: {
    backgroundColor: THEME.colors.lowBorder,
    borderWidth: 1,
    borderColor: THEME.colors.lowText,
  },
  secondaryContainer: {
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
  },
  outlineContainer: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 2,
    borderColor: THEME.colors.primary,
  },
  disabledContainer: {
    backgroundColor: THEME.colors.border,
    borderColor: THEME.colors.borderStrong,
    opacity: 0.6,
  },
  baseText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  primaryText: {
    color: THEME.colors.textInverse,
  },
  secondaryText: {
    color: THEME.colors.textPrimary,
  },
  outlineText: {
    color: THEME.colors.primary,
  },
});
