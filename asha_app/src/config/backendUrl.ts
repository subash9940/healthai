/**
 * src/config/backendUrl.ts
 *
 * Centralized backend URL resolution for ASHA app across platforms.
 * Prioritizes explicit EXPO_PUBLIC_BACKEND_URL environment variable,
 * then resolves Android emulator bridge (10.0.2.2) vs Web/iOS/Desktop (localhost).
 */

import { Platform } from "react-native";

export const getBackendUrl = (): string => {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  // Android emulator loopback bridge is 10.0.2.2; Web, iOS, and local environments use localhost
  return Platform.OS === "android" ? "http://10.0.2.2:8001" : "http://localhost:8001";
};
