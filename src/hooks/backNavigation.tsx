// src/hooks/backNavigation.tsx
// Makes the phone's back button / back gesture behave like a normal app instead of leaving the app:
//   - useBackClose(open, onClose)  : an open drawer / sheet / sub-screen is closed by Back
//   - <ModalBackGuard />           : any open page modal (the fixed full-screen z-50 overlays) is closed by Back
//   - App.tsx pushes a history entry per page, so Back walks back through the pages you visited
// Back only exits the app from the first screen with nothing left open.
import React, { useEffect } from 'react';

const LAYER_FLAG = 'backLayer';

/** How much "back" there is left to do inside the app; read by the Android hardware-back handler in App.tsx. */
export const backState = { layers: 0, pages: 0 };

// The "drop my history entry" step is deferred one tick so React Strict Mode's mount -> unmount -> mount
// cycle (and quick close/reopen) reuses the entry instead of popping it and closing the layer again.
let pendingBackTimer: ReturnType<typeof setTimeout> | null = null;

/** While `open` is true, a Back press calls `onClose` (and closing it by hand removes the extra history entry). */
export function useBackClose(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;
    backState.layers++;
    if (pendingBackTimer) {
      clearTimeout(pendingBackTimer);
      pendingBackTimer = null; // entry from the previous run is still there: reuse it
    } else {
      window.history.pushState({ [LAYER_FLAG]: true }, '');
    }
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      backState.layers = Math.max(0, backState.layers - 1);
      // Closed with a button (not Back): drop the entry we added so the next Back isn't a no-op
      pendingBackTimer = setTimeout(() => {
        pendingBackTimer = null;
        if (window.history.state && window.history.state[LAYER_FLAG]) window.history.back();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

const OVERLAY_SELECTOR = '.fixed.inset-0.z-50:not([data-back-managed])';

const closeOverlay = (el: HTMLElement) => {
  const buttons = Array.from(el.querySelectorAll('button'));
  const byLabel = buttons.find(b => /close|cancel|dismiss/i.test(`${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''}`));
  const byText = buttons.find(b => /^\s*(cancel|close|discard|back|no)\s*$/i.test(b.textContent || ''));
  const target = byLabel || byText;
  if (target) target.click();
  else el.dispatchEvent(new MouseEvent('click', { bubbles: true })); // backdrop click
};

/** Lets Back close whichever page modal is open (the pages render their own modals, so this watches the DOM). */
export const ModalBackGuard: React.FC = () => {
  useEffect(() => {
    let pushed = false;
    const findOverlay = () => document.querySelector<HTMLElement>(OVERLAY_SELECTOR);

    const sync = () => {
      const open = !!findOverlay();
      if (open && !pushed) {
        window.history.pushState({ [LAYER_FLAG]: true, overlayGuard: true }, '');
        pushed = true;
        backState.layers++;
      } else if (!open && pushed) {
        pushed = false;
        backState.layers = Math.max(0, backState.layers - 1);
        if (window.history.state && window.history.state.overlayGuard) window.history.back();
      }
    };

    const onPop = () => {
      if (!pushed) return;
      pushed = false; // the browser already removed our entry
      backState.layers = Math.max(0, backState.layers - 1);
      const el = findOverlay();
      if (!el) return;
      closeOverlay(el);
      // Nothing closed (e.g. a form that refused)? Re-arm so the next Back still works
      window.setTimeout(() => {
        if (findOverlay()) {
          window.history.pushState({ [LAYER_FLAG]: true, overlayGuard: true }, '');
          pushed = true;
          backState.layers++;
        }
      }, 150);
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', onPop);
    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  return null;
};
