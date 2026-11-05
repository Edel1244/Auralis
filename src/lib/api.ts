"use client";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  /** Field errors from a VALIDATION response, keyed by path. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as { path?: string; message?: string }[]) {
        if (d.path && d.message && !out[d.path]) out[d.path] = d.message;
      }
    } else if (this.details && typeof this.details === "object" && "field" in this.details) {
      out[String((this.details as { field: string }).field)] = this.message;
    }
    return out;
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
};

/** Typed fetch for the AURALIS REST API (/api/v1). Throws ApiClientError. */
export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    credentials: "same-origin",
    signal: opts.signal,
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  };
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, init);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(0, "NETWORK", "Network error");
  }
  const text = await res.text();
  const data = text ? safeParse(text) : null;
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string; details?: unknown } } | null)?.error;
    throw new ApiClientError(res.status, err?.code ?? "INTERNAL", err?.message ?? res.statusText, err?.details);
  }
  return data as T;
}

function safeParse(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/** Upload with progress reporting (fetch has no upload progress). */
export function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1${path}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const data = safeParse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else {
        const err = data?.error;
        reject(new ApiClientError(xhr.status, err?.code ?? "INTERNAL", err?.message ?? "Upload failed", err?.details));
      }
    };
    xhr.onerror = () => reject(new ApiClientError(0, "NETWORK", "Network error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(form);
  });
}
