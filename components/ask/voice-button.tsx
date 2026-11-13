"use client";

import { Mic, MicOff } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/stores/ui";

/** Minimal typing for the Web Speech API (not in TypeScript's DOM lib). */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function useVoiceSupported(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => Boolean(recognitionCtor()),
    () => false,
  );
}

/**
 * Dictation via the browser's speech recognition, where available. Some
 * browsers process speech on their servers; the typed text is what Owwy uses.
 */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  const toggle = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-PH";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) onText(transcript);
    };
    r.onerror = (event) => {
      if (event.error === "not-allowed") toast.error(new Error("Microphone access is off. You can still type."));
      else if (event.error === "network") toast.error(new Error("Dictation needs internet on this browser. Typing works offline."));
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    setListening(true);
    r.start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Stop dictation" : "Dictate"}
      aria-pressed={listening}
      className={cn("press flex size-12 shrink-0 items-center justify-center rounded-2xl border", listening ? "animate-pulse border-negative bg-negative-soft text-negative" : "border-line text-ink-2 hover:bg-surface-2")}
    >
      {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
    </button>
  );
}
