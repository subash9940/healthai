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
      {isPlaying ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      )}
      <span>{isPlaying ? t("results.stopAudio") : t("results.listenAudio")}</span>
    </button>
  );
}
