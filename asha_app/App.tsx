/**
 * App.tsx
 *
 * Production ASHA Worker Field Health Application (Jeevanya).
 * 100% Offline Clinical Rule Engine, Multi-Language, Referral State Machine.
 */

import React, { useState, useEffect } from "react";
import { SafeAreaView, StyleSheet, StatusBar, View } from "react-native";
import { THEME } from "./src/constants/theme";
import {
  Language,
  AshaWorkerSession,
  PatientDemographics,
  Vitals,
  TriageEvaluationResponse,
  TriageEvaluationRequest,
} from "./src/types";
import { Header } from "./src/components/Header";
import { SyncBanner } from "./src/components/SyncBanner";
import { AuthScreen } from "./src/screens/AuthScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { PatientDemographicsScreen } from "./src/screens/PatientDemographicsScreen";
import { SymptomCheckScreen } from "./src/screens/SymptomCheckScreen";
import { VitalsScreen } from "./src/screens/VitalsScreen";
import { TriageResultScreen } from "./src/screens/TriageResultScreen";
import { ReferralQueueScreen } from "./src/screens/ReferralQueueScreen";
import { PatientHistoryScreen } from "./src/screens/PatientHistoryScreen";
import { FacilityAvailabilityScreen } from "./src/screens/FacilityAvailabilityScreen";
import { StorageService } from "./src/services/storageService";
import { SyncService } from "./src/services/syncService";
import { evaluateOfflineTriage } from "./src/rules/offlineRulesEngine";
import { StaffService, StaffSessionData } from "./src/services/staffService";
import { StaffHomeScreen } from "./src/screens/StaffHomeScreen";
import { StaffSosScreen } from "./src/screens/StaffSosScreen";

type AppScreen =
  | "auth"
  | "dashboard"
  | "demographics"
  | "symptoms"
  | "vitals"
  | "result"
  | "referrals"
  | "history"
  | "staffHome"
  | "staffSos"
  | "staffReferrals"
  | "facilities";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>("auth");
  const [language, setLanguage] = useState<Language>("en"); // English primary default
  const [session, setSession] = useState<AshaWorkerSession | null>(null);
  const [staffSession, setStaffSession] = useState<StaffSessionData | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Active Screening State
  const [activeDemographics, setActiveDemographics] = useState<PatientDemographics | null>(null);
  const [activeSymptoms, setActiveSymptoms] = useState<string[]>([]);
  const [activeDurationDays, setActiveDurationDays] = useState<number | null>(null);
  const [activeVitals, setActiveVitals] = useState<Vitals>({});
  const [activeTriageResult, setActiveTriageResult] = useState<TriageEvaluationResponse | null>(null);

  useEffect(() => {
    async function init() {
      const savedLang = await StorageService.getLanguage();
      setLanguage(savedLang);
      const savedSession = await StorageService.getSession();
      if (savedSession && savedSession.is_authenticated) {
        setSession(savedSession);
        setCurrentScreen("dashboard");
      }
      const savedStaffSession = await StaffService.getSession();
      if (savedStaffSession && savedStaffSession.token) {
        setStaffSession(savedStaffSession);
        setCurrentScreen("staffHome");
      }
      refreshSyncCount();
    }
    init();
  }, []);

  const refreshSyncCount = async () => {
    const count = await StorageService.getPendingSyncCount();
    setPendingSyncCount(count);
  };

  const handleLanguageChange = async (newLang: Language) => {
    setLanguage(newLang);
    await StorageService.setLanguage(newLang);
  };

  const handleLoginSuccess = (newSession: AshaWorkerSession) => {
    setSession(newSession);
    setCurrentScreen("dashboard");
    refreshSyncCount();
  };

  const handleLogout = async () => {
    setSession(null);
    setCurrentScreen("auth");
  };

  const handleStaffLoginSuccess = (newStaffSession: StaffSessionData) => {
    setStaffSession(newStaffSession);
    setCurrentScreen("staffHome");
  };

  const handleStaffLogout = async () => {
    await StaffService.clearSession();
    setStaffSession(null);
    setCurrentScreen("auth");
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await SyncService.performSync();
    await refreshSyncCount();
    setIsSyncing(false);
  };

  // Screening Flow Handlers
  const handleDemographicsContinue = (demo: PatientDemographics) => {
    setActiveDemographics(demo);
    setCurrentScreen("symptoms");
  };

  const handleSymptomsContinue = (symptoms: string[], durationDays?: number | null) => {
    setActiveSymptoms(symptoms);
    setActiveDurationDays(durationDays ?? null);
    setCurrentScreen("vitals");
  };

  const handleVitalsEvaluate = (vitals: Vitals) => {
    if (!activeDemographics) return;
    setActiveVitals(vitals);

    const triageRequest: TriageEvaluationRequest = {
      ...activeDemographics,
      symptoms: activeSymptoms,
      symptom_duration_days: activeDurationDays,
      vitals,
      language,
      source_tier: "asha_app",
    };

    // Compute 100% Deterministic Offline Triage
    const result = evaluateOfflineTriage(triageRequest);
    setActiveTriageResult(result);
    setCurrentScreen("result");
    refreshSyncCount();
  };

  const handleScreeningFinish = () => {
    setActiveDemographics(null);
    setActiveSymptoms([]);
    setActiveDurationDays(null);
    setActiveVitals({});
    setActiveTriageResult(null);
    setCurrentScreen("dashboard");
    refreshSyncCount();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.surface} />

      {/* Persistent Gov Header (unless on auth) */}
      {currentScreen !== "auth" && (
        <>
          <Header
            language={language}
            onLanguageChange={handleLanguageChange}
            session={session}
            onLogout={handleLogout}
          />
          <SyncBanner
            language={language}
            pendingCount={pendingSyncCount}
            isSyncing={isSyncing}
            onSyncPress={handleManualSync}
          />
        </>
      )}

      {/* Screen Router */}
      <View style={styles.screenContainer}>
        {currentScreen === "auth" && (
          <AuthScreen
            language={language}
            onLoginSuccess={handleLoginSuccess}
            onStaffLoginSuccess={handleStaffLoginSuccess}
          />
        )}

        {currentScreen === "dashboard" && session && (
          <DashboardScreen
            language={language}
            session={session}
            onStartScreening={() => setCurrentScreen("demographics")}
            onViewReferrals={() => setCurrentScreen("referrals")}
            onViewHistory={() => setCurrentScreen("history")}
            onViewFacilities={() => setCurrentScreen("facilities")}
          />
        )}

        {currentScreen === "demographics" && (
          <PatientDemographicsScreen
            language={language}
            onContinue={handleDemographicsContinue}
            onCancel={() => setCurrentScreen("dashboard")}
          />
        )}

        {currentScreen === "symptoms" && activeDemographics && (
          <SymptomCheckScreen
            language={language}
            demographics={activeDemographics}
            onContinue={handleSymptomsContinue}
            onBack={() => setCurrentScreen("demographics")}
          />
        )}

        {currentScreen === "vitals" && (
          <VitalsScreen
            language={language}
            onEvaluate={handleVitalsEvaluate}
            onBack={() => setCurrentScreen("symptoms")}
          />
        )}

        {currentScreen === "result" &&
          activeDemographics &&
          activeTriageResult && (
            <TriageResultScreen
              language={language}
              demographics={activeDemographics}
              symptoms={activeSymptoms}
              vitals={activeVitals}
              triageResult={activeTriageResult}
              workerId={session?.worker_id || "ASHA-MH-7041"}
              onFinish={handleScreeningFinish}
              onViewReferrals={() => setCurrentScreen("referrals")}
            />
          )}

        {currentScreen === "referrals" && (
          <ReferralQueueScreen
            language={language}
            onBack={() => setCurrentScreen("dashboard")}
          />
        )}

        {currentScreen === "history" && (
          <PatientHistoryScreen
            language={language}
            onBack={() => setCurrentScreen("dashboard")}
          />
        )}

        {currentScreen === "facilities" && (
          <FacilityAvailabilityScreen
            language={language}
            onBack={() => setCurrentScreen("dashboard")}
          />
        )}

        {currentScreen === "staffHome" && staffSession && (
          <StaffHomeScreen
            language={language}
            staffSession={staffSession}
            onOpenSos={() => setCurrentScreen("staffSos")}
            onOpenReferrals={() => setCurrentScreen("staffReferrals")}
            onLogout={handleStaffLogout}
          />
        )}

        {currentScreen === "staffSos" && (
          <StaffSosScreen
            language={language}
            onBack={() => setCurrentScreen("staffHome")}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  screenContainer: {
    flex: 1,
  },
});
