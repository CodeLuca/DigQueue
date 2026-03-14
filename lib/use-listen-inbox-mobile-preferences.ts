"use client";

import { useEffect, useState } from "react";

const QUICK_RAIL_COLLAPSED_KEY = "digqueue:mobile-quick-rail-collapsed";
const COMPACT_ROWS_KEY = "digqueue:mobile-compact-rows";
const AUTO_ADVANCE_PLAY_KEY = "digqueue:mobile-auto-advance-play";

function readSessionBoolean(key: string, fallback: boolean, options?: { trueWhen?: string; falseWhen?: string }) {
  if (typeof window === "undefined") return fallback;
  const stored = window.sessionStorage.getItem(key);
  if (stored === options?.trueWhen) return true;
  if (stored === options?.falseWhen) return false;
  return fallback;
}

function writeSessionBoolean(
  key: string,
  value: boolean,
  options?: { trueWhen?: string; falseWhen?: string; clearWhenFalse?: boolean },
) {
  if (typeof window === "undefined") return;
  if (!value && options?.clearWhenFalse) {
    window.sessionStorage.removeItem(key);
    return;
  }
  window.sessionStorage.setItem(key, value ? (options?.trueWhen ?? "1") : (options?.falseWhen ?? "0"));
}

export function useListenInboxMobilePreferences() {
  const [mobileQuickRailCollapsed, setMobileQuickRailCollapsed] = useState(() =>
    readSessionBoolean(QUICK_RAIL_COLLAPSED_KEY, false, { trueWhen: "1" }),
  );
  const [compactMobileRows, setCompactMobileRows] = useState(() =>
    readSessionBoolean(COMPACT_ROWS_KEY, true, { falseWhen: "0" }),
  );
  const [mobileAutoAdvancePlay, setMobileAutoAdvancePlay] = useState(() =>
    readSessionBoolean(AUTO_ADVANCE_PLAY_KEY, true, { falseWhen: "0" }),
  );

  useEffect(() => {
    writeSessionBoolean(QUICK_RAIL_COLLAPSED_KEY, mobileQuickRailCollapsed, { trueWhen: "1", clearWhenFalse: true });
  }, [mobileQuickRailCollapsed]);

  useEffect(() => {
    writeSessionBoolean(COMPACT_ROWS_KEY, compactMobileRows, { trueWhen: "1", falseWhen: "0" });
  }, [compactMobileRows]);

  useEffect(() => {
    writeSessionBoolean(AUTO_ADVANCE_PLAY_KEY, mobileAutoAdvancePlay, { trueWhen: "1", falseWhen: "0" });
  }, [mobileAutoAdvancePlay]);

  return {
    mobileQuickRailCollapsed,
    setMobileQuickRailCollapsed,
    compactMobileRows,
    setCompactMobileRows,
    mobileAutoAdvancePlay,
    setMobileAutoAdvancePlay,
  };
}
