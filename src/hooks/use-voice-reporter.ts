import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceReporterStatus = "idle" | "listening" | "processing" | "done" | "error" | "unsupported";

export interface UseVoiceReporterReturn {
  status: VoiceReporterStatus;
  transcript: string;
  interimTranscript: string;
  errorMessage: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
  isSupported: boolean;
}

type VoiceRecognitionAlternative = {
  transcript: string;
};

type VoiceRecognitionResult = {
  isFinal: boolean;
  0: VoiceRecognitionAlternative;
};

type VoiceRecognitionResultList = {
  length: number;
  [index: number]: VoiceRecognitionResult;
};

type VoiceRecognitionEvent = Event & {
  resultIndex: number;
  results: VoiceRecognitionResultList;
};

type VoiceRecognitionErrorEvent = Event & {
  error: string;
};

declare global {
  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onresult: ((event: VoiceRecognitionEvent) => void) | null;
    onerror: ((event: VoiceRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
  }

  interface SpeechRecognitionConstructor {
    new (): SpeechRecognition;
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useVoiceReporter(lang = "en-ZA"): UseVoiceReporterReturn {
  const [status, setStatus] = useState<VoiceReporterStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const SpeechRecognitionAPI: SpeechRecognitionConstructor | null =
    typeof window !== "undefined"
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
      : null;

  const isSupported = !!SpeechRecognitionAPI;

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setStatus("unsupported");
      setErrorMessage("Voice recognition is not supported in this browser.");
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus("listening");
      setErrorMessage(null);
    };

    recognition.onresult = (event: VoiceRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) setTranscript((prev) => (prev + final).trim());
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: VoiceRecognitionErrorEvent) => {
      const msg =
        event.error === "not-allowed"
          ? "Microphone access denied. Please allow microphone access and try again."
          : event.error === "network"
            ? "Network error during voice recognition."
            : `Voice recognition error: ${event.error}`;
      setErrorMessage(msg);
      setStatus("error");
    };

    recognition.onend = () => {
      setInterimTranscript("");
      setStatus((prev) => (prev === "listening" ? "done" : prev));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognitionAPI, lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setStatus("done");
    setInterimTranscript("");
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    setStatus("idle");
    setTranscript("");
    setInterimTranscript("");
    setErrorMessage(null);
  }, []);

  return { status, transcript, interimTranscript, errorMessage, start, stop, reset, isSupported };
}
