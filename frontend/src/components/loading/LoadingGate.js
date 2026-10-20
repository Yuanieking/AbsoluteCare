import { useEffect, useState } from "react";

export function useLoadingGate(loading, delay = 150, minimum = 400) {
  const [visible, setVisible] = useState(loading);

  useEffect(() => {
    let hideTimer;
    let showTimer;
    const startedAt = Date.now();

    if (loading) {
      showTimer = window.setTimeout(() => setVisible(true), delay);
    } else {
      const remaining = Math.max(minimum - (Date.now() - startedAt), 0);
      hideTimer = window.setTimeout(() => setVisible(false), remaining);
    }

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [delay, loading, minimum]);

  return loading || visible;
}
