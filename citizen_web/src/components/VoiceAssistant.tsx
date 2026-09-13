"use client";

import { useState, useEffect } from "react";
import { Language, useI18n } from "@/lib/useTranslation";
import { trackEvent } from "@/lib/analytics";

interface VoiceAssistantProps {
  textToSpeak: string;
  language: Language;
}

export default function VoiceAssistant({ textToSpeak, language }: VoiceAssistantProps) {
  const { t } = useI18n();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);
    }
  }, []);

  const handleToggleSpeak = () => {
    if (!isSupported || !textToSpeak) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if (language === "mr") {
      utterance.lang = "mr-IN";
    } else if (language === "hi") {
      utterance.lang = "hi-IN";
    } else if (language === "ta") {
      utterance.lang = "ta-IN";
    } else {
      utterance.lang = "en-IN";
    }

    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    trackEvent("audio_playback_triggered", { language });
  };

  if (!isSupported) return null;

  return (
    <button
      type="button"
      className="audio-btn"
      onClick={handleToggleSpeak}
      aria-label="Listen to medical guidance out loud"
    >
      <span>🔊</span>
      <span>{isPlaying ? t("results.stopAudio") : t("results.listenAudio")}</span>
    </button>
  );
}
