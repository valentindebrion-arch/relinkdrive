import { useEffect, useState } from "react";

/** Indique si l'onglet est visible (permet de mettre les animations décoratives en pause). */
export function usePageVisible() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return visible;
}
