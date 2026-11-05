"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AudioEngine, type EngineSnapshot } from "@/audio/AudioEngine";
import { DEFAULT_EQ, normalizationGainDb, normalizeEq, type EqSettings } from "@/audio/eq";
import * as Q from "@/audio/queue";
import type { Track } from "@/lib/types";
import { useSession } from "@/state/session";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/I18nProvider";

export type PlaybackSettings = {
  crossfade: number; // seconds, 0 = off
  normalize: boolean;
  gapless: boolean;
  quality: "auto" | "high" | "original";
};
export const DEFAULT_PLAYBACK: PlaybackSettings = { crossfade: 0, normalize: true, gapless: true, quality: "auto" };

type PlayerContextValue = {
  engine: AudioEngine | null;
  queue: Q.QueueState<Track>;
  current: Track | null;
  snapshot: EngineSnapshot;
  source: string | null;
  playTracks: (tracks: Track[], startIndex?: number, source?: string) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  jumpTo: (position: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setRate: (r: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  enqueue: (tracks: Track[]) => void;
  enqueueNext: (tracks: Track[]) => void;
  removeAt: (position: number) => void;
  move: (from: number, to: number) => void;
  clearUpcoming: () => void;
  settings: PlaybackSettings;
  setSettings: (patch: Partial<PlaybackSettings>) => void;
  eq: EqSettings;
  setEq: (patch: Partial<EqSettings>) => void;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  queueOpen: boolean;
  setQueueOpen: (v: boolean) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);
const STORAGE_KEY = "auralis_player";
const SETTINGS_KEY = "auralis_playback";
const EQ_KEY = "auralis_eq";

const IDLE: EngineSnapshot = { status: "idle", trackId: null, duration: 0, volume: 0.8, muted: false, rate: 1 };

function readJSON<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}
function writeJSON(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

function streamSrc(t: Track, quality: PlaybackSettings["quality"]) {
  if (quality === "auto" || !t.qualities?.includes(quality)) return t.streamUrl;
  return `${t.streamUrl}?quality=${quality}`;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus, preferences, savePreferences } = useSession();
  const toast = useToast();
  const t = useT();
  const engineRef = useRef<AudioEngine | null>(null);
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [queue, setQueue] = useState<Q.QueueState<Track>>(Q.emptyQueue());
  const queueRef = useRef(queue);
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(IDLE);
  const [settings, setSettingsState] = useState<PlaybackSettings>(DEFAULT_PLAYBACK);
  const settingsRef = useRef(settings);
  const [eq, setEqState] = useState<EqSettings>(DEFAULT_EQ);
  const [expanded, setExpanded] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const listen = useRef<{ trackId: string; ms: number; last: number | null; duration: number; source: string | null } | null>(null);
  const authRef = useRef(authStatus);
  authRef.current = authStatus;

  const commitQueue = useCallback((q: Q.QueueState<Track>) => {
    queueRef.current = q;
    setQueue(q);
  }, []);

  // ───── listening history reporting ─────
  const flushListen = useCallback((completed: boolean, beacon = false) => {
    const l = listen.current;
    if (!l) return;
    if (l.last !== null) {
      l.ms += performance.now() - l.last;
      l.last = null;
    }
    listen.current = null;
    if (authRef.current !== "authenticated") return;
    const ms = Math.round(l.ms);
    const threshold = Math.min(30_000, Math.max(5_000, (l.duration * 1000) / 2));
    if (ms < threshold && !completed) return;
    const body = JSON.stringify({ msPlayed: ms, completed, source: l.source });
    const url = `/api/v1/tracks/${l.trackId}/plays`;
    if (beacon && navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    else void fetch(url, { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  }, []);

  const beginListen = useCallback((track: Track, src: string | null) => {
    listen.current = { trackId: track.id, ms: 0, last: null, duration: track.durationMs / 1000, source: src };
  }, []);

  // ───── engine lifecycle ─────
  useEffect(() => {
    const e = new AudioEngine();
    engineRef.current = e;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEngine(e);

    const s = { ...DEFAULT_PLAYBACK, ...(readJSON<Partial<PlaybackSettings>>(SETTINGS_KEY) ?? {}) };
    settingsRef.current = s;
    setSettingsState(s);
    e.setCrossfade(s.crossfade);
    const storedEq = normalizeEq(readJSON(EQ_KEY));
    setEqState(storedEq);
    e.setEq(storedEq);

    const offState = e.events.on("state", (snap) => {
      setSnapshot(snap);
      const l = listen.current;
      if (l) {
        if (snap.status === "playing" && l.last === null) l.last = performance.now();
        else if (snap.status !== "playing" && l.last !== null) {
          l.ms += performance.now() - l.last;
          l.last = null;
        }
      }
    });
    const offAdvance = e.events.on("advance", () => {
      flushListen(true);
      const q = Q.next(queueRef.current, true);
      if (q) {
        commitQueue(q);
        const cur = Q.currentItem(q);
        if (cur) beginListen(cur, null);
      }
    });
    const offEnded = e.events.on("ended", () => flushListen(true));
    const offError = e.events.on("error", () => {
      flushListen(false);
      toast(t("player.error"), "error");
    });

    // Restore the previous session (paused, at the saved position).
    const saved = readJSON<{ q: Q.QueueState<Track>; time: number; volume: number; muted: boolean; rate: number }>(STORAGE_KEY);
    if (saved?.q?.items?.length) {
      commitQueue(saved.q);
      e.setVolume(saved.volume ?? 0.8);
      e.setMuted(Boolean(saved.muted));
      e.setRate(saved.rate ?? 1);
      const cur = Q.currentItem(saved.q);
      if (cur) e.load(streamSrc(cur, s.quality), cur.id, { autoplay: false, startAt: saved.time, gainDb: s.normalize ? normalizationGainDb(cur.loudnessDb) : 0 });
    }

    const onHide = () => flushListen(false, true);
    window.addEventListener("pagehide", onHide);
    return () => {
      offState();
      offAdvance();
      offEnded();
      offError();
      window.removeEventListener("pagehide", onHide);
      e.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server-side preferences win after login.
  useEffect(() => {
    if (!preferences || !engineRef.current) return;
    if (preferences.playback && Object.keys(preferences.playback).length) {
      const s = { ...DEFAULT_PLAYBACK, ...(preferences.playback as Partial<PlaybackSettings>) };
      settingsRef.current = s;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettingsState(s);
      engineRef.current.setCrossfade(s.crossfade);
    }
    if (preferences.equalizer && Object.keys(preferences.equalizer).length) {
      const q = normalizeEq(preferences.equalizer);
      setEqState(q);
      engineRef.current.setEq(q);
    }
  }, [preferences]);

  // Keep the idle slot preloaded with whatever plays next.
  const current = Q.currentItem(queue);
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const nxt = Q.peekNext(queue, true);
    const s = settingsRef.current;
    e.setNext(
      nxt && (s.gapless || s.crossfade > 0)
        ? { src: streamSrc(nxt, s.quality), trackId: nxt.id, gainDb: s.normalize ? normalizationGainDb(nxt.loudnessDb) : 0 }
        : null,
    );
  }, [queue, settings]);

  // Persist queue + position periodically and on change.
  useEffect(() => {
    const save = () => {
      const e = engineRef.current;
      const q = queueRef.current;
      if (!e || !q.items.length) return;
      // Bound the stored queue to keep localStorage small.
      const trimmed = q.items.length > 300 ? Q.createQueue(q.order.slice(q.position, q.position + 300).map((i) => q.items[i]), 0, q) : q;
      writeJSON(STORAGE_KEY, { q: trimmed, time: e.currentTime, volume: snapshot.volume, muted: snapshot.muted, rate: snapshot.rate });
    };
    save();
    const id = setInterval(save, 5000);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", save);
    };
  }, [queue, snapshot.volume, snapshot.muted, snapshot.rate]);

  // ───── actions ─────
  const loadCurrent = useCallback(
    (q: Q.QueueState<Track>, autoplay = true) => {
      const e = engineRef.current;
      const cur = Q.currentItem(q);
      if (!e || !cur) return;
      flushListen(false);
      const s = settingsRef.current;
      e.load(streamSrc(cur, s.quality), cur.id, { autoplay, gainDb: s.normalize ? normalizationGainDb(cur.loudnessDb) : 0 });
      beginListen(cur, source);
    },
    [flushListen, beginListen, source],
  );

  const playTracks = useCallback(
    (tracks: Track[], startIndex = 0, src?: string) => {
      const playable = tracks.filter((x) => x.status === "READY");
      if (!playable.length) return;
      const start = Math.max(0, playable.findIndex((x) => x.id === tracks[startIndex]?.id));
      const q = Q.createQueue(playable, start, queueRef.current);
      setSource(src ?? null);
      commitQueue(q);
      loadCurrent(q);
    },
    [commitQueue, loadCurrent],
  );

  const toggle = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    if (e.snapshot().status === "idle" || !e.snapshot().trackId) {
      if (Q.currentItem(queueRef.current)) loadCurrent(queueRef.current);
      return;
    }
    e.toggle();
  }, [loadCurrent]);

  const next = useCallback(() => {
    const q = Q.next(queueRef.current, false);
    if (!q) return;
    commitQueue(q);
    loadCurrent(q);
  }, [commitQueue, loadCurrent]);

  const previous = useCallback(() => {
    const e = engineRef.current;
    if (e && e.currentTime > 3) return e.seek(0);
    const q = Q.previous(queueRef.current);
    if (q === queueRef.current) return e?.seek(0);
    commitQueue(q);
    loadCurrent(q);
  }, [commitQueue, loadCurrent]);

  const jumpTo = useCallback(
    (position: number) => {
      const q = Q.goTo(queueRef.current, position);
      commitQueue(q);
      loadCurrent(q);
    },
    [commitQueue, loadCurrent],
  );

  const seek = useCallback((s: number) => engineRef.current?.seek(s), []);
  const setVolume = useCallback((v: number) => {
    engineRef.current?.setVolume(v);
    if (v > 0) engineRef.current?.setMuted(false);
  }, []);
  const toggleMute = useCallback(() => {
    const e = engineRef.current;
    if (e) e.setMuted(!e.snapshot().muted);
  }, []);
  const setRate = useCallback((r: number) => engineRef.current?.setRate(r), []);
  const toggleShuffle = useCallback(() => commitQueue(Q.setShuffle(queueRef.current, !queueRef.current.shuffle)), [commitQueue]);
  const cycleRepeat = useCallback(() => commitQueue(Q.cycleRepeat(queueRef.current)), [commitQueue]);

  const enqueue = useCallback(
    (tracks: Track[]) => {
      const wasEmpty = !Q.currentItem(queueRef.current);
      const q = Q.enqueue(queueRef.current, tracks.filter((x) => x.status === "READY"));
      commitQueue(q);
      if (wasEmpty) loadCurrent(q);
    },
    [commitQueue, loadCurrent],
  );
  const enqueueNext = useCallback(
    (tracks: Track[]) => {
      const wasEmpty = !Q.currentItem(queueRef.current);
      const q = Q.enqueueNext(queueRef.current, tracks.filter((x) => x.status === "READY"));
      commitQueue(q);
      if (wasEmpty) loadCurrent(q);
    },
    [commitQueue, loadCurrent],
  );
  const removeAt = useCallback((p: number) => commitQueue(Q.removeAt(queueRef.current, p)), [commitQueue]);
  const move = useCallback((a: number, b: number) => commitQueue(Q.move(queueRef.current, a, b)), [commitQueue]);
  const clearUpcoming = useCallback(() => commitQueue(Q.clearUpcoming(queueRef.current)), [commitQueue]);

  const setSettings = useCallback(
    (patch: Partial<PlaybackSettings>) => {
      const s = { ...settingsRef.current, ...patch };
      settingsRef.current = s;
      setSettingsState(s);
      writeJSON(SETTINGS_KEY, s);
      engineRef.current?.setCrossfade(s.crossfade);
      const cur = Q.currentItem(queueRef.current);
      if ("normalize" in patch && cur) engineRef.current?.setCurrentGainDb(s.normalize ? normalizationGainDb(cur.loudnessDb) : 0);
      if (authRef.current === "authenticated") void savePreferences({ playback: s }).catch(() => {});
    },
    [savePreferences],
  );

  const eqSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setEq = useCallback(
    (patch: Partial<EqSettings>) => {
      setEqState((prev) => {
        const nextEq = normalizeEq({ ...prev, ...patch });
        engineRef.current?.setEq(nextEq);
        writeJSON(EQ_KEY, nextEq);
        if (authRef.current === "authenticated") {
          if (eqSaveTimer.current) clearTimeout(eqSaveTimer.current);
          eqSaveTimer.current = setTimeout(() => void savePreferences({ equalizer: nextEq }).catch(() => {}), 700);
        }
        return nextEq;
      });
    },
    [savePreferences],
  );

  // ───── Media Session (lock screen / hardware keys / background playback) ─────
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (current) {
      ms.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artistName,
        album: current.album?.title ?? "AURALIS",
        artwork: current.coverUrl
          ? [{ src: new URL(current.coverUrl, location.origin).href, sizes: "1000x1000", type: "image/webp" }]
          : [{ src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" }],
      });
    }
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => toggle()],
      ["pause", () => engineRef.current?.pause()],
      ["nexttrack", () => next()],
      ["previoustrack", () => previous()],
      ["seekto", (d) => d.seekTime != null && engineRef.current?.seek(d.seekTime)],
      ["seekforward", () => engineRef.current && engineRef.current.seek(engineRef.current.currentTime + 10)],
      ["seekbackward", () => engineRef.current && engineRef.current.seek(engineRef.current.currentTime - 10)],
    ];
    for (const [a, h] of handlers) {
      try {
        ms.setActionHandler(a, h);
      } catch {}
    }
  }, [current, toggle, next, previous]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = snapshot.status === "playing" ? "playing" : "paused";
  }, [snapshot.status]);

  // ───── keyboard shortcuts ─────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const eng = engineRef.current;
      if (!eng) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          toggle();
          break;
        case "ArrowRight":
          if (e.shiftKey) next();
          else eng.seek(eng.currentTime + 5);
          break;
        case "ArrowLeft":
          if (e.shiftKey) previous();
          else eng.seek(eng.currentTime - 5);
          break;
        case "ArrowUp":
          if (e.shiftKey) {
            e.preventDefault();
            setVolume(Math.min(1, eng.snapshot().volume + 0.05));
          }
          break;
        case "ArrowDown":
          if (e.shiftKey) {
            e.preventDefault();
            setVolume(Math.max(0, eng.snapshot().volume - 0.05));
          }
          break;
        case "m":
          toggleMute();
          break;
        case "s":
          toggleShuffle();
          break;
        case "r":
          cycleRepeat();
          break;
        case "f":
          setExpanded((v) => !v);
          break;
        case "q":
          setQueueOpen((v) => !v);
          break;
        case "Escape":
          setExpanded(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, next, previous, setVolume, toggleMute, toggleShuffle, cycleRepeat]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      engine, queue, current, snapshot, source,
      playTracks, toggle, next, previous, seek, jumpTo, setVolume, toggleMute, setRate, toggleShuffle, cycleRepeat,
      enqueue, enqueueNext, removeAt, move, clearUpcoming,
      settings, setSettings, eq, setEq, expanded, setExpanded, queueOpen, setQueueOpen,
    }),
    [engine, queue, current, snapshot, source, playTracks, toggle, next, previous, seek, jumpTo, setVolume, toggleMute, setRate,
      toggleShuffle, cycleRepeat, enqueue, enqueueNext, removeAt, move, clearUpcoming, settings, setSettings, eq, setEq, expanded, queueOpen],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

/** Smooth playhead position (rAF while playing), isolated so only consumers re-render. */
export function usePlaybackTime() {
  const { engine, snapshot } = usePlayer();
  const subscribe = useCallback(
    (cb: () => void) => {
      if (!engine) return () => {};
      let raf = 0;
      let iv: ReturnType<typeof setInterval> | null = null;
      if (snapshot.status === "playing") {
        const loop = () => {
          cb();
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } else iv = setInterval(cb, 500);
      return () => {
        cancelAnimationFrame(raf);
        if (iv) clearInterval(iv);
      };
    },
    [engine, snapshot.status],
  );
  return useSyncExternalStore(
    subscribe,
    () => (engine ? Math.floor(engine.currentTime * 10) / 10 : 0),
    () => 0,
  );
}
