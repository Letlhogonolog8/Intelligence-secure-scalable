import { useEffect, useState } from "react";

/**
 * Tracks `document.visibilityState` so dashboards can pause polling while the tab is hidden.
 */
export function useDocumentVisibility(): boolean {
  const [visible, setVisible] = useState(() =>
    typeof document !== "undefined" ? document.visibilityState === "visible" : true
  );

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}
