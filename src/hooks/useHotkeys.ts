"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

export type HotkeyOptions = {
  enabled?: boolean;
  preventDefault?: boolean;
  enableOnFormTags?: boolean;
};

export type HotkeyCallback = (event: KeyboardEvent) => void;

/**
 * Custom hook to register keyboard shortcuts with:
 * 1. Stable listener cleanup on unmount.
 * 2. Zero re-subscribing on state changes by using stable refs.
 * 3. Prevention during IME composition.
 * 4. Safe exclusion of form inputs (unless enableOnFormTags is true).
 * 5. Dialog safety (slash shortcut disabled when modal dialog is open).
 */
export function useHotkeys(
  keyCombo: string,
  callback: HotkeyCallback,
  options: HotkeyOptions = {}
) {
  const { enabled = true, preventDefault = false, enableOnFormTags = false } = options;

  const callbackRef = useRef(callback);
  const optionsRef = useRef({ enabled, preventDefault, enableOnFormTags });

  useLayoutEffect(() => {
    callbackRef.current = callback;
    optionsRef.current = { enabled, preventDefault, enableOnFormTags };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const currentOpts = optionsRef.current;
      if (!currentOpts.enabled) return;

      // Ignore IME composition
      if (event.isComposing || event.keyCode === 229) return;

      const target = event.target as HTMLElement | null;
      const isFormTag =
        target !== null &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // By default, ignore hotkeys when typing in editable elements
      if (isFormTag && !currentOpts.enableOnFormTags) {
        return;
      }

      const hasModifier = event.ctrlKey || event.metaKey || event.altKey;

      const combo = keyCombo.toLowerCase().trim();

      if (combo === "/" || combo === "slash") {
        // Rule: Not active if focus is in input/textarea/select/contenteditable
        if (isFormTag) return;

        // Rule: Not active if Ctrl, Alt, or Meta is pressed
        if (hasModifier) return;

        // Match key
        if (event.key !== "/") return;

        // Rule: Not active if a modal dialog is currently open in the DOM
        if (typeof document !== "undefined") {
          const hasOpenModal = document.querySelector('[role="dialog"]') !== null;
          if (hasOpenModal) return;
        }

        if (currentOpts.preventDefault) {
          event.preventDefault();
        }
        callbackRef.current(event);
      } else if (
        combo === "ctrl+enter" ||
        combo === "cmd+enter" ||
        combo === "mod+enter"
      ) {
        // Rule: Ctrl+Enter (Cmd+Enter on Mac)
        const isModKey = event.ctrlKey || event.metaKey;
        if (!isModKey || event.altKey || event.key !== "Enter") return;

        // Do not alter regular Enter inside textarea (only Ctrl+Enter triggers submit)
        if (currentOpts.preventDefault) {
          event.preventDefault();
        }
        callbackRef.current(event);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [keyCombo]);
}

/**
 * Convenient hook for focusing a search input when "/" is pressed on list pages.
 * Only runs if the input ref is provided and enabled.
 */
export function useSearchHotkey(
  inputRef: React.RefObject<HTMLInputElement | null>,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;

  useHotkeys(
    "/",
    (event) => {
      const el = inputRef.current;
      if (!el) return;
      // preventDefault ONLY when shortcut is really executed on an existing input
      event.preventDefault();
      el.focus();
      if (typeof el.select === "function") {
        el.select();
      }
    },
    {
      enabled,
      preventDefault: false,
      enableOnFormTags: false,
    }
  );
}

/**
 * Convenient hook for submitting forms with Ctrl+Enter (Cmd+Enter on Mac).
 * Can be used inside inputs, dialogs, and forms.
 */
export function useSubmitHotkey(
  onSubmit: () => void,
  options: { enabled?: boolean; loading?: boolean } = {}
) {
  const { enabled = true, loading = false } = options;

  useHotkeys(
    "mod+enter",
    (event) => {
      if (loading || !enabled) return;
      // preventDefault ONLY when shortcut is truly executed
      event.preventDefault();
      onSubmit();
    },
    {
      enabled: enabled && !loading,
      preventDefault: false,
      enableOnFormTags: true,
    }
  );
}
