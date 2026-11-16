"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Минимальные типы Web Speech API: в стандартной библиотеке DOM их нет. */
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

/** Поддерживает ли браузер распознавание речи. На сервере всегда false, чтобы разметка совпала при гидрации. */
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(noopSubscribe, () => getCtor() !== null, () => false);
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Нет доступа к микрофону. Разрешите его в настройках браузера и попробуйте снова.",
  "service-not-allowed": "Распознавание речи запрещено настройками браузера.",
  "no-speech": "Речь не слышна. Проверьте микрофон и говорите чуть громче.",
  "audio-capture": "Микрофон не найден.",
  network: "Распознаванию нужен интернет: браузер отправляет речь на сервер распознавания.",
};

/**
 * Распознавание английской речи. transcript накапливается между start() и stop(); interim показывает
 * ещё не закреплённый хвост фразы. Ошибка «нет речи» не считается сбоем, а просто завершает запись.
 */
export function useSpeechRecognition() {
  const supported = useSpeechSupported();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");

  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    recRef.current?.abort();
    finalRef.current = "";
    interimRef.current = "";
    setTranscript("");
    setInterim("");
    setError(null);

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current = `${finalRef.current} ${r[0].transcript}`.trim();
        else live += r[0].transcript;
      }
      interimRef.current = live.trim();
      setTranscript(finalRef.current);
      setInterim(interimRef.current);
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      setError(ERRORS[e.error] ?? "Не удалось распознать речь. Попробуйте ещё раз.");
    };
    rec.onend = () => {
      setListening(false);
      // То, что не успело закрепиться, не теряем.
      if (interimRef.current) {
        finalRef.current = `${finalRef.current} ${interimRef.current}`.trim();
        setTranscript(finalRef.current);
        interimRef.current = "";
      }
      setInterim("");
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Не удалось запустить запись. Попробуйте ещё раз.");
    }
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported, listening, transcript, interim, error, start, stop };
}
