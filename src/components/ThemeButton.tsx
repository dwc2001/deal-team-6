import { MoonIcon, SunIcon } from "./icons";
import { useTheme } from "../lib/theme";

/** One tap between light and dark. "Auto" (follow the device) lives in the name menu. */
export function ThemeButton() {
  const { shown, setTheme } = useTheme();
  const next = shown === "dark" ? "light" : "dark";
  return (
    <button className="icon-btn" onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {shown === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
