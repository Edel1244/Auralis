"use client";

import { useEffect, useState, useSyncExternalStore, useCallback } from "react";
import type { Deck, DeckState } from "@/audio/studio/Deck";

export function useDeckState(deck: Deck | null): DeckState | null {
  const [state, setState] = useState<DeckState | null>(deck?.state ?? null);
  useEffect(() => {
    if (!deck) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(deck.state);
    return deck.events.on("state", setState);
  }, [deck]);
  return state;
}

/** Playhead position via rAF while playing. */
export function useDeckPosition(deck: Deck | null, playing: boolean) {
  const subscribe = useCallback(
    (cb: () => void) => {
      let raf = 0;
      const loop = () => {
        cb();
        raf = requestAnimationFrame(loop);
      };
      if (playing) raf = requestAnimationFrame(loop);
      const iv = playing ? null : setInterval(cb, 300);
      return () => {
        cancelAnimationFrame(raf);
        if (iv) clearInterval(iv);
      };
    },
    [playing],
  );
  return useSyncExternalStore(subscribe, () => (deck ? deck.position : 0), () => 0);
}
