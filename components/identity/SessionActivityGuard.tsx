"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function SessionActivityGuard({ children }: { children: ReactNode }) {
  const lastInteraction = useRef(Date.now());

  useEffect(() => {
    const noteActivity = () => { lastInteraction.current = Date.now(); };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, noteActivity, { passive: true }));

    async function checkSession() {
      const recentInteraction = Date.now() - lastInteraction.current < 90_000;
      const response = await fetch("/api/auth/session", { method: recentInteraction ? "PATCH" : "GET", cache: "no-store" }).catch(() => null);
      if (response && response.status === 401) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/login/session-expired?returnTo=${encodeURIComponent(returnTo)}`);
      }
    }

    void checkSession();
    const interval = window.setInterval(() => void checkSession(), 60_000);
    return () => {
      window.clearInterval(interval);
      events.forEach((event) => window.removeEventListener(event, noteActivity));
    };
  }, []);

  return <>{children}</>;
}
