"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Tone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--player-height)+76px)] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-[calc(var(--player-height)+20px)]"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              className={cn(
                "pointer-events-auto flex items-center gap-2.5 rounded-full border bg-elevated px-4 py-2.5 text-sm shadow-2xl",
                t.tone === "error" ? "border-danger/40" : t.tone === "success" ? "border-success/40" : "border-line",
              )}
            >
              {t.tone === "error" ? (
                <AlertTriangle size={16} className="text-danger" />
              ) : t.tone === "success" ? (
                <CheckCircle2 size={16} className="text-success" />
              ) : (
                <Info size={16} className="text-primary" />
              )}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
