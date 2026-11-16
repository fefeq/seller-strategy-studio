// Fase F: browser-only dictation and read-aloud (Web Speech API, free). Hidden when the browser lacks it.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptDictation, canSpeak } from "@/lib/voice";

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecCtor = new () => Rec;

function recognitionCtor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** «Dictar»: fills the box with what you say; you still press send. */
export function DictateButton({
  onText,
  disabled,
}: {
  onText: (t: string) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const rec = useRef<Rec | null>(null);
  useEffect(() => {
    setSupported(!!recognitionCtor());
    return () => rec.current?.stop();
  }, []);
  if (!supported) return null;
  function toggle() {
    if (on) {
      rec.current?.stop();
      return;
    }
    const C = recognitionCtor();
    if (!C) return;
    const r = new C();
    r.lang = "es-ES";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const t = Array.from(e.results)
        .map((x) => x[0]?.transcript ?? "")
        .join(" ");
      const v = acceptDictation(t);
      if (v.ok) onText(v.text);
      else toast.warning(v.reason);
    };
    r.onerror = (e) => {
      if (e.error !== "aborted" && e.error !== "no-speech")
        toast.error(
          e.error === "not-allowed"
            ? "Permite el micrófono en el navegador para dictar."
            : "No he podido dictar. Prueba otra vez.",
        );
    };
    r.onend = () => setOn(false);
    rec.current = r;
    setOn(true);
    r.start();
  }
  return (
    <Button
      type="button"
      size="sm"
      variant={on ? "default" : "outline"}
      onClick={toggle}
      disabled={disabled}
      aria-pressed={on}
    >
      {on ? "Parar" : "Dictar"}
    </Button>
  );
}

/** «Escuchar»: reads an answer aloud, except secrets and deletions. */
export function SpeakButton({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);
  useEffect(
    () => () => {
      if (on) window.speechSynthesis.cancel();
    },
    [on],
  );
  if (!supported) return null;
  function toggle() {
    if (on) {
      window.speechSynthesis.cancel();
      setOn(false);
      return;
    }
    const v = canSpeak(text);
    if (!v.ok) {
      toast.info(v.reason);
      return;
    }
    const u = new SpeechSynthesisUtterance(v.text);
    u.lang = "es-ES";
    u.onend = () => setOn(false);
    u.onerror = () => setOn(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setOn(true);
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="min-h-9 text-xs text-muted-foreground underline-offset-2 hover:underline md:min-h-0"
    >
      {on ? "Parar lectura" : "Escuchar"}
    </button>
  );
}
