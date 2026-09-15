/**
 * src/screens/AuthScreen.tsx
 *
 * Professional Government ASHA Worker Authentication Portal.
 *
 * Features & Security:
 * 1. Dual Flow: Sign In (Existing Worker) & Register / Sign Up (New Worker).
 * 2. Dual Authentication: 4-Digit MPIN or 6-Digit SMS OTP.
 * 3. Translucent Vector Eye MPIN Visibility Toggle (no platform emojis).
 * 4. Strict Progressive Rate Limiting & Cooldown Protection.
 * 5. Local Session Token Storage with 24-Hour Expiration.
 * 6. Dynamic Worker Roster combining Pre-Authorized + Self-Registered ASHA Personnel.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { THEME } from "../constants/theme";
import { TRANSLATIONS } from "../constants/translations";
import { Language, AshaWorkerSession } from "../types";
import { TouchButton } from "../components/TouchButton";
import {
  AuthService,
  AUTHORIZED_WORKERS,
  AuthorizedWorker,
  LockoutState,
} from "../services/authService";

interface AuthScreenProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
  onLoginSuccess: (session: AshaWorkerSession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  language,
  onLanguageChange,
  onLoginSuccess,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // Main Action: "login" or "register"
  const [authAction, setAuthAction] = useState<"login" | "register">("login");

  // Roster state
  const [workerList, setWorkerList] = useState<AuthorizedWorker[]>(AUTHORIZED_WORKERS);

  // Sign In Mode: "mpin" or "otp"
  const [authMode, setAuthMode] = useState<"mpin" | "otp">("mpin");

  // MPIN Form State
  const [workerId, setWorkerId] = useState("ASHA-MH-7041");
  const [mpin, setMpin] = useState("8391");
  const [showPin, setShowPin] = useState(false);

  // OTP Form State
  const [otpPhone, setOtpPhone] = useState("9823014520");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<"phone" | "verify">("phone");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [debugOtpNotice, setDebugOtpNotice] = useState<string | null>(null);

  // Register Form State
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regRole, setRegRole] = useState<"worker" | "supervisor" | "admin">("worker");
  const [regSubCentre, setRegSubCentre] = useState("Sub-Centre Mandavgan");
  const [regVillageCluster, setRegVillageCluster] = useState("Mandavgan Rural");
  const [regPhcArea, setRegPhcArea] = useState("PHC Shirur");
  const [regMpin, setRegMpin] = useState("");
  const [regConfirmMpin, setRegConfirmMpin] = useState("");
  const [showRegPin, setShowRegPin] = useState(false);
  const [showRegConfirmPin, setShowRegConfirmPin] = useState(false);

  const [loading, setLoading] = useState(false);

  // Lockout & Rate-Limiting State
  const [lockout, setLockout] = useState<LockoutState>({
    isLocked: false,
    remainingSeconds: 0,
    failedAttempts: 0,
    attemptsLeft: 5,
    lockoutTier: 1,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadWorkers();
    checkLockout();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  const loadWorkers = async () => {
    try {
      const list = await AuthService.getAllWorkers();
      setWorkerList(list);
    } catch {
      setWorkerList(AUTHORIZED_WORKERS);
    }
  };

  const checkLockout = async () => {
    const state = await AuthService.getLockoutState();
    setLockout(state);

    if (state.isLocked && state.remainingSeconds > 0) {
      startCountdown(state.remainingSeconds);
    }
  };

  const startCountdown = (initialSeconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);

    let remaining = initialSeconds;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        checkLockout();
      } else {
        setLockout((prev) => ({
          ...prev,
          isLocked: true,
          remainingSeconds: remaining,
        }));
      }
    }, 1000);
  };

  const startResendTimer = () => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    setResendCountdown(30);
    resendTimerRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSelectWorker = (selectedWorker: AuthorizedWorker) => {
    setWorkerId(selectedWorker.worker_id);
    setMpin(selectedWorker.mpin);
    setOtpPhone(selectedWorker.phone_number);
    setOtpStep("phone");
    setOtpCode("");
    setDebugOtpNotice(null);
  };

  // 1. MPIN Login Handler
  const handleMpinLogin = async () => {
    if (lockout.isLocked) {
      Alert.alert(
        t.auth_locked_title || "Security Lockout Active",
        (t.auth_locked_countdown || "Please wait {seconds}s").replace("{seconds}", String(lockout.remainingSeconds))
      );
      return;
    }

    if (!workerId.trim()) {
      Alert.alert("Required", "Please enter your ASHA Worker ID");
      return;
    }
    if (mpin.trim().length !== 4) {
      Alert.alert("Required", "Please enter 4-digit security PIN");
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.loginWithMpin(workerId, mpin);

      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        if (res.lockoutState) {
          setLockout(res.lockoutState);
          if (res.lockoutState.isLocked) {
            startCountdown(res.lockoutState.remainingSeconds);
          }
        }
        Alert.alert("Authentication Failed", res.error || "Invalid credentials");
      }
    } catch (e: any) {
      Alert.alert("Login Error", e?.message || "Please check device connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // 2. OTP Request Handler
  const handleRequestOtp = async () => {
    if (lockout.isLocked) {
      Alert.alert(
        t.auth_locked_title || "Security Lockout",
        `Please wait ${lockout.remainingSeconds}s`
      );
      return;
    }

    const identifier = authMode === "otp" && otpStep === "phone" ? otpPhone : workerId;
    if (!identifier.trim()) {
      Alert.alert("Required", "Please enter phone number or worker ID");
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.requestOtp(identifier);
      if (res.success && res.maskedPhone) {
        setMaskedPhone(res.maskedPhone);
        setOtpStep("verify");
        setDebugOtpNotice(res.debugOtp || null);
        startResendTimer();
      } else {
        Alert.alert("OTP Request Failed", res.error || "Unable to dispatch OTP");
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. OTP Verification Handler
  const handleVerifyOtp = async () => {
    if (otpCode.trim().length !== 6) {
      Alert.alert("Required", "Please enter 6-digit OTP code");
      return;
    }

    setLoading(true);
    try {
      const identifier = otpPhone || workerId;
      const res = await AuthService.verifyOtp(identifier, otpCode);
      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        Alert.alert("OTP Verification Failed", res.error || "Incorrect OTP code");
      }
    } finally {
      setLoading(false);
    }
  };

  // 4. Biometric Quick Unlock Handler
  const handleBiometricAuth = async () => {
    if (lockout.isLocked) {
      Alert.alert(
        t.auth_locked_title || "Security Lockout",
        `Please wait ${lockout.remainingSeconds}s`
      );
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.biometricLogin(workerId);
      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        Alert.alert("Biometric Failed", res.error || "Unable to authenticate with hardware token");
      }
    } finally {
      setLoading(false);
    }
  };

  // 5. Worker Registration Handler
  const handleRegister = async () => {
    if (!regName.trim()) {
      Alert.alert("Required", "Please enter your full official name");
      return;
    }
    const cleanPhone = regPhone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      Alert.alert("Required", "Please enter a valid 10-digit mobile number");
      return;
    }
    if (regMpin.length !== 4) {
      Alert.alert("Required", "Please set a 4-digit MPIN");
      return;
    }
    if (regMpin !== regConfirmMpin) {
      Alert.alert("Mismatch", "MPIN and Confirm MPIN do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await AuthService.registerWorker({
        worker_name: regName.trim(),
        phone_number: cleanPhone,
        role: regRole,
        sub_centre: regSubCentre.trim() || "Sub-Centre Mandavgan",
        village_cluster: regVillageCluster.trim() || "Mandavgan Rural",
        phc_area: regPhcArea.trim() || "PHC Shirur",
        mpin: regMpin,
      });

      if (res.success && res.session) {
        await loadWorkers();
        Alert.alert(
          "Registration Successful",
          `Welcome, ${res.session.worker_name}! Your assigned Worker ID is ${res.session.worker_id}.`,
          [
            {
              text: "Continue to App",
              onPress: () => onLoginSuccess(res.session!),
            },
          ]
        );
      } else {
        Alert.alert("Registration Failed", res.error || "Could not complete registration.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Sub-language Switcher */}
          {onLanguageChange && (
            <View style={styles.langBar}>
              {(["en", "hi", "ta", "mr"] as Language[]).map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.langChip, language === l && styles.langChipActive]}
                  onPress={() => onLanguageChange(l)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${l}`}
                >
                  <Text
                    style={[
                      styles.langChipText,
                      language === l && styles.langChipTextActive,
                    ]}
                  >
                    {l === "en" ? "English" : l === "hi" ? "हिंदी" : l === "ta" ? "தமிழ்" : "मराठी"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Main Authentication Card */}
          <View style={styles.card}>
            {/* Header / Brand */}
            <View style={styles.headerBox}>
              <View style={styles.badgeGov}>
                <Text style={styles.govText}>{t.auth_device_secure || "National Health Mission"}</Text>
              </View>
              <Text style={styles.title}>
                {authAction === "login"
                  ? (t.auth_title || "ASHA Portal Login")
                  : "ASHA Worker Registration"}
              </Text>
              <Text style={styles.subtitle}>{t.app_title || "Jeevanya Clinical Triage"}</Text>
            </View>

            {/* Action Switcher: Sign In vs Register */}
            <View style={styles.actionTabContainer}>
              <TouchableOpacity
                style={[styles.actionTabButton, authAction === "login" && styles.actionTabButtonActive]}
                onPress={() => setAuthAction("login")}
                activeOpacity={0.8}
              >
                <Text style={[styles.actionTabText, authAction === "login" && styles.actionTabTextActive]}>
                  Sign In (लॉगिन)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionTabButton, authAction === "register" && styles.actionTabButtonActive]}
                onPress={() => setAuthAction("register")}
                activeOpacity={0.8}
              >
                <Text style={[styles.actionTabText, authAction === "register" && styles.actionTabTextActive]}>
                  Register / Sign Up (नोंदणी)
                </Text>
              </TouchableOpacity>
            </View>

            {/* ========================================================= */}
            {/* SECTION 1: SIGN IN FLOW                                  */}
            {/* ========================================================= */}
            {authAction === "login" && (
              <View>
                {/* Lockout Warning Banner */}
                {lockout.isLocked && (
                  <View style={styles.lockoutBanner}>
                    <Text style={styles.lockoutTitle}>Security Lockout Active</Text>
                    <Text style={styles.lockoutText}>
                      Progressive rate-limit triggered. Cooldown active for {lockout.remainingSeconds}s.
                    </Text>
                  </View>
                )}

                {/* Rate-Limit Attempts Remaining Badge */}
                {!lockout.isLocked && lockout.failedAttempts > 0 && (
                  <View style={styles.warningBanner}>
                    <Text style={styles.warningText}>
                      Security Warning: {lockout.attemptsLeft} attempt(s) remaining before security cooldown.
                    </Text>
                  </View>
                )}

                {/* Authorized Worker Quick Selector */}
                <View style={styles.selectorSection}>
                  <Text style={styles.sectionLabel}>{t.auth_switch_worker || "Select Authorized Worker:"}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                    {workerList.map((w) => {
                      const isSelected = workerId.toUpperCase() === w.worker_id.toUpperCase();
                      const roleBadge = w.role === "admin" ? "MO" : w.role === "supervisor" ? "SUP" : "ASHA";
                      return (
                        <TouchableOpacity
                          key={w.worker_id}
                          style={[styles.workerChip, isSelected && styles.workerChipActive]}
                          onPress={() => handleSelectWorker(w)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.chipHeaderRow}>
                            <Text style={[styles.workerChipId, isSelected && styles.workerChipIdActive]}>
                              {w.worker_id}
                            </Text>
                            <View style={[styles.roleBadge, w.role === "admin" ? styles.roleBadgeAdmin : styles.roleBadgeWorker]}>
                              <Text style={styles.roleBadgeText}>{roleBadge}</Text>
                            </View>
                          </View>
                          <Text style={[styles.workerChipName, isSelected && styles.workerChipNameActive]}>
                            {w.worker_name.split(" ")[0]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Authentication Mode Tabs */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tabButton, authMode === "mpin" && styles.tabButtonActive]}
                    onPress={() => setAuthMode("mpin")}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tabButtonText, authMode === "mpin" && styles.tabButtonTextActive]}>
                      {t.auth_tab_mpin || "4-Digit MPIN"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabButton, authMode === "otp" && styles.tabButtonActive]}
                    onPress={() => setAuthMode("otp")}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tabButtonText, authMode === "otp" && styles.tabButtonTextActive]}>
                      {t.auth_tab_otp || "SMS OTP"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* ----------------- MODE A: MPIN LOGIN ----------------- */}
                {authMode === "mpin" && (
                  <View>
                    {/* Worker ID Field */}
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>{t.auth_enter_id || "ASHA Worker ID"}</Text>
                      <TextInput
                        style={[styles.input, lockout.isLocked && styles.inputDisabled]}
                        value={workerId}
                        onChangeText={setWorkerId}
                        placeholder="e.g. ASHA-MH-7041"
                        autoCapitalize="characters"
                        editable={!lockout.isLocked}
                        placeholderTextColor={THEME.colors.textMuted}
                      />
                    </View>

                    {/* 4-Digit MPIN Field */}
                    <View style={styles.formGroup}>
                      <View style={styles.labelRow}>
                        <Text style={styles.label}>{t.auth_enter_mpin || "4-Digit MPIN"}</Text>
                        <TouchableOpacity
                          onPress={() => setShowPin(!showPin)}
                          style={styles.togglePinBtn}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={showPin ? "eye-off-outline" : "eye-outline"}
                            size={18}
                            color="#64748B"
                            style={styles.eyeIcon}
                          />
                          <Text style={styles.togglePinText}>
                            {showPin ? (t.auth_hide_pin || "Hide") : (t.auth_show_pin || "Show")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={[
                          styles.input,
                          styles.mpinInput,
                          lockout.isLocked && styles.inputDisabled,
                        ]}
                        value={mpin}
                        onChangeText={setMpin}
                        placeholder="••••"
                        keyboardType="numeric"
                        maxLength={4}
                        secureTextEntry={!showPin}
                        editable={!lockout.isLocked}
                        placeholderTextColor={THEME.colors.textMuted}
                      />
                    </View>

                    {/* Submit MPIN Button */}
                    <TouchButton
                      title={
                        lockout.isLocked
                          ? `Locked (${lockout.remainingSeconds}s)`
                          : t.auth_btn_login || "Unlock App"
                      }
                      onPress={handleMpinLogin}
                      loading={loading}
                      disabled={lockout.isLocked}
                      style={styles.loginBtn}
                    />
                  </View>
                )}

                {/* ----------------- MODE B: OTP LOGIN ----------------- */}
                {authMode === "otp" && (
                  <View>
                    {otpStep === "phone" ? (
                      <View>
                        <View style={styles.formGroup}>
                          <Text style={styles.label}>{t.auth_enter_phone || "Registered Mobile Number"}</Text>
                          <TextInput
                            style={[styles.input, lockout.isLocked && styles.inputDisabled]}
                            value={otpPhone}
                            onChangeText={setOtpPhone}
                            placeholder="10-digit phone number"
                            keyboardType="phone-pad"
                            maxLength={10}
                            editable={!lockout.isLocked}
                            placeholderTextColor={THEME.colors.textMuted}
                          />
                        </View>
                        <TouchButton
                          title={t.auth_btn_get_otp || "Send 6-Digit OTP"}
                          onPress={handleRequestOtp}
                          loading={loading}
                          disabled={lockout.isLocked}
                          style={styles.loginBtn}
                        />
                      </View>
                    ) : (
                      <View>
                        <View style={styles.otpNoticeBox}>
                          <Text style={styles.otpNoticeText}>
                            {(t.auth_otp_sent_to || "OTP sent to {phone}").replace("{phone}", maskedPhone)}
                          </Text>
                          {debugOtpNotice && (
                            <View style={styles.debugOtpPill}>
                              <Text style={styles.debugOtpText}>
                                Demonstration Code: {debugOtpNotice}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.label}>{t.auth_enter_otp || "Enter 6-Digit OTP"}</Text>
                          <TextInput
                            style={[styles.input, styles.otpInput]}
                            value={otpCode}
                            onChangeText={setOtpCode}
                            placeholder="••••••"
                            keyboardType="numeric"
                            maxLength={6}
                            autoFocus
                            placeholderTextColor={THEME.colors.textMuted}
                          />
                        </View>

                        <TouchButton
                          title={t.auth_btn_verify_otp || "Verify & Unlock App"}
                          onPress={handleVerifyOtp}
                          loading={loading}
                          style={styles.loginBtn}
                        />

                        <View style={styles.resendRow}>
                          <TouchableOpacity
                            disabled={resendCountdown > 0}
                            onPress={handleRequestOtp}
                          >
                            <Text style={[styles.resendText, resendCountdown > 0 && styles.resendTextDisabled]}>
                              {resendCountdown > 0
                                ? (t.auth_resend_in || "Resend in {seconds}s").replace("{seconds}", String(resendCountdown))
                                : t.auth_resend_otp || "Resend Code"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setOtpStep("phone")}>
                            <Text style={styles.changePhoneText}>Change Number</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Biometric Quick Unlock Shortcut */}
                <TouchableOpacity
                  style={[
                    styles.biometricBtn,
                    lockout.isLocked && styles.biometricBtnDisabled,
                  ]}
                  onPress={handleBiometricAuth}
                  disabled={lockout.isLocked}
                  activeOpacity={0.7}
                >
                  <Text style={styles.biometricText}>
                    {t.auth_biometric_btn || "Quick Unlock with Biometrics"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================= */}
            {/* SECTION 2: REGISTRATION / SIGN UP FLOW                   */}
            {/* ========================================================= */}
            {authAction === "register" && (
              <View>
                {/* Full Name */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Full Official Name (नाव)</Text>
                  <TextInput
                    style={styles.input}
                    value={regName}
                    onChangeText={setRegName}
                    placeholder="e.g. Smt. Kavita Shinde"
                    placeholderTextColor={THEME.colors.textMuted}
                  />
                </View>

                {/* Mobile Number */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Mobile Number (मोबाईल क्र.)</Text>
                  <TextInput
                    style={styles.input}
                    value={regPhone}
                    onChangeText={setRegPhone}
                    placeholder="10-digit mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholderTextColor={THEME.colors.textMuted}
                  />
                </View>

                {/* Role Selector */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Cadre Role (पद)</Text>
                  <View style={styles.roleSelectorRow}>
                    {(
                      [
                        { id: "worker", label: "ASHA Worker" },
                        { id: "supervisor", label: "Supervisor / ANM" },
                        { id: "admin", label: "Medical Officer" },
                      ] as const
                    ).map((r) => (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          styles.roleSelectChip,
                          regRole === r.id && styles.roleSelectChipActive,
                        ]}
                        onPress={() => setRegRole(r.id)}
                      >
                        <Text
                          style={[
                            styles.roleSelectChipText,
                            regRole === r.id && styles.roleSelectChipTextActive,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Health Center & Village */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Assigned Sub-Centre & Village</Text>
                  <TextInput
                    style={styles.input}
                    value={regSubCentre}
                    onChangeText={setRegSubCentre}
                    placeholder="e.g. Sub-Centre Mandavgan"
                    placeholderTextColor={THEME.colors.textMuted}
                  />
                </View>

                {/* Village Cluster / Area */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Village Cluster / PHC Area</Text>
                  <TextInput
                    style={styles.input}
                    value={regVillageCluster}
                    onChangeText={setRegVillageCluster}
                    placeholder="e.g. Mandavgan Rural (PHC Shirur)"
                    placeholderTextColor={THEME.colors.textMuted}
                  />
                </View>

                {/* 4-Digit MPIN */}
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Create 4-Digit MPIN</Text>
                    <TouchableOpacity
                      onPress={() => setShowRegPin(!showRegPin)}
                      style={styles.togglePinBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showRegPin ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color="#64748B"
                        style={styles.eyeIcon}
                      />
                      <Text style={styles.togglePinText}>{showRegPin ? "Hide" : "Show"}</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, styles.mpinInput]}
                    value={regMpin}
                    onChangeText={setRegMpin}
                    placeholder="••••"
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry={!showRegPin}
                    placeholderTextColor={THEME.colors.textMuted}
                  />
                </View>

                {/* Confirm 4-Digit MPIN */}
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Confirm 4-Digit MPIN</Text>
                    <TouchableOpacity
                      onPress={() => setShowRegConfirmPin(!showRegConfirmPin)}
                      style={styles.togglePinBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showRegConfirmPin ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color="#64748B"
                        style={styles.eyeIcon}
                      />
                      <Text style={styles.togglePinText}>{showRegConfirmPin ? "Hide" : "Show"}</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, styles.mpinInput]}
                    value={regConfirmMpin}
                    onChangeText={setRegConfirmMpin}
                    placeholder="••••"
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry={!showRegConfirmPin}
                    placeholderTextColor={THEME.colors.textMuted}
                  />
                </View>

                {/* Register & Submit Button */}
                <TouchButton
                  title="Complete Registration & Log In"
                  onPress={handleRegister}
                  loading={loading}
                  style={styles.loginBtn}
                />
              </View>
            )}

            {/* Security Indicator Footer */}
            <View style={styles.securityFooter}>
              <Text style={styles.securityFooterText}>
                {t.auth_session_token_active || "Encrypted Local Session Tokens (24h Expiry) · Audit-Ready"}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: THEME.spacing.lg,
    paddingTop: 12,
    justifyContent: "center",
  },
  langBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: THEME.spacing.md,
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  langChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primaryDark,
  },
  langChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.textSecondary,
  },
  langChipTextActive: {
    color: "#FFFFFF",
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerBox: {
    alignItems: "center",
    marginBottom: THEME.spacing.md,
  },
  badgeGov: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.borderRadius.sm,
    marginBottom: 6,
  },
  govText: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  actionTabContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: THEME.borderRadius.md,
    padding: 3,
    marginBottom: THEME.spacing.md,
  },
  actionTabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: THEME.borderRadius.sm,
  },
  actionTabButtonActive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: THEME.colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionTabText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textMuted,
  },
  actionTabTextActive: {
    color: THEME.colors.primary,
  },
  lockoutBanner: {
    backgroundColor: THEME.colors.emergencyBg,
    borderColor: THEME.colors.emergencyBorder,
    borderWidth: 1,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: THEME.spacing.md,
    alignItems: "center",
  },
  lockoutTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.emergencyText,
    marginBottom: 2,
  },
  lockoutText: {
    fontSize: 12,
    color: THEME.colors.emergencyText,
    textAlign: "center",
  },
  warningBanner: {
    backgroundColor: THEME.colors.highBg,
    borderColor: THEME.colors.highBorder,
    borderWidth: 1,
    borderRadius: THEME.borderRadius.md,
    padding: 8,
    marginBottom: THEME.spacing.md,
    alignItems: "center",
  },
  warningText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.highText,
  },
  selectorSection: {
    marginBottom: THEME.spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  chipsScroll: {
    flexDirection: "row",
  },
  workerChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    marginRight: 8,
  },
  workerChipActive: {
    backgroundColor: THEME.colors.primaryLight,
    borderColor: THEME.colors.primary,
  },
  chipHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  workerChipId: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
  },
  workerChipIdActive: {
    color: THEME.colors.primaryDark,
  },
  roleBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  roleBadgeWorker: {
    backgroundColor: "#E2E8F0",
  },
  roleBadgeAdmin: {
    backgroundColor: "#FEF3C7",
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: THEME.colors.textPrimary,
  },
  workerChipName: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  workerChipNameActive: {
    color: THEME.colors.primary,
    fontWeight: "700",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: THEME.colors.surfaceSubtle,
    borderRadius: THEME.borderRadius.md,
    padding: 3,
    marginBottom: THEME.spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: THEME.borderRadius.sm,
  },
  tabButtonActive: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textMuted,
  },
  tabButtonTextActive: {
    color: THEME.colors.primary,
  },
  formGroup: {
    marginBottom: THEME.spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  togglePinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  eyeIcon: {
    opacity: 0.65,
  },
  togglePinText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  input: {
    minHeight: THEME.touchTarget.minHeight,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    fontSize: 15,
    color: THEME.colors.textPrimary,
    fontWeight: "600",
  },
  inputDisabled: {
    backgroundColor: "#F1F5F9",
    color: "#94A3B8",
  },
  mpinInput: {
    letterSpacing: 8,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
  },
  otpInput: {
    letterSpacing: 10,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
  },
  roleSelectorRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleSelectChip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  roleSelectChipActive: {
    backgroundColor: THEME.colors.primaryLight,
    borderColor: THEME.colors.primary,
  },
  roleSelectChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.textSecondary,
    textAlign: "center",
  },
  roleSelectChipTextActive: {
    color: THEME.colors.primaryDark,
  },
  loginBtn: {
    marginTop: 4,
  },
  otpNoticeBox: {
    backgroundColor: THEME.colors.accentBlueLight,
    borderColor: THEME.colors.accentBlue,
    borderWidth: 1,
    borderRadius: THEME.borderRadius.md,
    padding: 10,
    marginBottom: THEME.spacing.md,
  },
  otpNoticeText: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
    fontWeight: "600",
    textAlign: "center",
  },
  debugOtpPill: {
    marginTop: 6,
    backgroundColor: "#FFFFFF",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: THEME.colors.accentBlue,
  },
  debugOtpText: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.accentBlue,
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  resendText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.primary,
  },
  resendTextDisabled: {
    color: THEME.colors.textMuted,
  },
  changePhoneText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.textSecondary,
  },
  biometricBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 12,
    marginTop: 12,
  },
  biometricBtnDisabled: {
    opacity: 0.5,
  },
  biometricText: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textPrimary,
  },
  securityFooter: {
    marginTop: THEME.spacing.md,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    alignItems: "center",
  },
  securityFooterText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: "center",
  },
});
