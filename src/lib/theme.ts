import { useEffect, useState } from "react";

/** "system" follows the device; light and dark are a choice remembered on this device. */
export type Theme = "system" | "light" | "dark";

const KEY = "dt6-theme";
const listeners = new Set<(t: Theme) => void>();
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function setTheme(t: Theme) {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(t));
}

/** The chosen setting and what is actually showing. */
export function useTheme(): { theme: Theme; shown: "light" | "dark"; setTheme: (t: Theme) => void } {
  const [theme, set] = useState<Theme>(readTheme);
  const [deviceDark, setDeviceDark] = useState(() => darkQuery().matches);
  useEffect(() => {
    listeners.add(set);
    const mq = darkQuery();
    const onChange = () => setDeviceDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => {
      listeners.delete(set);
      mq.removeEventListener("change", onChange);
    };
  }, []);
  const shown = theme === "system" ? (deviceDark ? "dark" : "light") : theme;
  return { theme, shown, setTheme };
}
