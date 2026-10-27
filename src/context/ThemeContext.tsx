"use client";

import { useEffect, useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "bukuflow-theme";

interface ThemeStoreState {
  pref: ThemePreference;
  resolved: ResolvedTheme;
}

let listeners: Array<() => void> = [];

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredPref(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === "light" || val === "dark" || val === "system") {
      return val;
    }
  } catch {
    // ignore
  }
  return "system";
}

let currentState: ThemeStoreState = {
  pref: "system",
  resolved: "light",
};

// Initialize in browser
if (typeof window !== "undefined") {
  const initialPref = getStoredPref();
  const initialResolved = initialPref === "system" ? getSystemTheme() : initialPref;
  currentState = { pref: initialPref, resolved: initialResolved };
  // Pastikan atribut tema di documentElement terpasang saat script browser dimuat
  applyTheme(initialPref, initialResolved, false);

  // Listen to system prefers-color-scheme changes
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handleMqlChange = (e: MediaQueryListEvent) => {
    if (currentState.pref === "system") {
      const newResolved: ResolvedTheme = e.matches ? "dark" : "light";
      applyTheme("system", newResolved, false);
    }
  };
  mql.addEventListener("change", handleMqlChange);

  // Listen to cross-tab storage changes
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      const newPref = getStoredPref();
      const newResolved = newPref === "system" ? getSystemTheme() : newPref;
      applyTheme(newPref, newResolved, false);
    }
  });
}

function applyTheme(pref: ThemePreference, resolved: ResolvedTheme, writeStorage = true) {
  currentState = { pref, resolved };

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-theme-pref", pref);
    root.style.colorScheme = resolved;
  }

  if (writeStorage && typeof window !== "undefined") {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      // ignore
    }
  }

  listeners.forEach((l) => l());
}

export function setThemePreference(pref: ThemePreference): void {
  const resolved = pref === "system" ? getSystemTheme() : pref;
  applyTheme(pref, resolved, true);
}

function subscribe(callback: () => void): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function getSnapshot(): ThemeStoreState {
  return currentState;
}

const SERVER_SNAPSHOT: ThemeStoreState = {
  pref: "system",
  resolved: "light",
};

function getServerSnapshot(): ThemeStoreState {
  return SERVER_SNAPSHOT;
}

export function useTheme() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Sinkronisasi proaktif ke DOM saat mount/navigasi client-side
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (root.getAttribute("data-theme") !== state.resolved) {
        root.setAttribute("data-theme", state.resolved);
        root.setAttribute("data-theme-pref", state.pref);
        root.style.colorScheme = state.resolved;
      }
    }
  }, [state.resolved, state.pref]);

  return {
    theme: state.resolved,
    themePref: state.pref,
    setTheme: setThemePreference,
  };
}

