"use client";

import { useState } from "react";
import { ApiClientError } from "@/lib/api";
import { useT } from "@/i18n/I18nProvider";

/** Minimal form-state helper: values, field errors, a form error and a pending flag. */
export function useForm<T extends Record<string, string | boolean>>(initial: T) {
  const t = useT();
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key as string]: "" }));
  };

  async function submit(fn: (v: T) => Promise<void>) {
    setPending(true);
    setFormError(null);
    setErrors({});
    try {
      await fn(values);
    } catch (e) {
      if (e instanceof ApiClientError) {
        const fe = e.fieldErrors();
        setErrors(fe);
        if (!Object.keys(fe).length || e.code !== "VALIDATION") setFormError(e.code === "NETWORK" ? t("errors.network") : e.message);
      } else setFormError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  return { values, set, errors, setErrors, formError, setFormError, pending, submit };
}
