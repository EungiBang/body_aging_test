import { useState, useEffect, useCallback, useRef } from "react";

interface VoiceCommandOptions {
  onCommand: (command: string) => void;
  enabled?: boolean;
}

interface VoiceCommandResult {
  isListening: boolean;
  isSupported: boolean;
  lastCommand: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

// Command mappings
const COMMAND_MAP: Record<string, string> = {
  다음: "next",
  넥스트: "next",
  next: "next",
  시작: "start",
  준비: "start",
  start: "start",
  촬영: "capture",
  캡처: "capture",
  찍어: "capture",
  capture: "capture",
};

const useVoiceCommand = ({
  onCommand,
  enabled = true,
}: VoiceCommandOptions): VoiceCommandResult => {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognition;

  const processTranscript = useCallback(
    (transcript: string) => {
      const lowerTranscript = transcript.toLowerCase().trim();

      for (const [keyword, command] of Object.entries(COMMAND_MAP)) {
        if (lowerTranscript.includes(keyword)) {
          setLastCommand(keyword);
          onCommand(command);
          return;
        }
      }
    },
    [onCommand],
  );

  const startListening = useCallback(() => {
    if (!isSupported || !enabled) return;

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "ko-KR";
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const last = event.results[event.results.length - 1];
        if (last.isFinal) {
          processTranscript(last[0].transcript);
        }
      };

      recognition.onstart = () => setIsListening(true);

      recognition.onend = () => {
        setIsListening(false);
        // Auto-restart if still enabled
        if (enabled && recognitionRef.current === recognition) {
          try {
            recognition.start();
          } catch (e) {
            // ignore - may fail if page is navigating
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "aborted" && event.error !== "no-speech") {
          console.warn("Voice recognition error:", event.error);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn("Failed to start voice recognition:", e);
    }
  }, [isSupported, enabled, SpeechRecognition, processTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      ref.stop();
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    lastCommand,
    startListening,
    stopListening,
    toggleListening,
  };
};

export default useVoiceCommand;
