import { useEffect, useState } from "react";

export function useDelayedLoading(loading, delay = 150, minimum = 300) {
  const [visible, setVisible] = useState(false);
  const [startedAt, setStartedAt] = useState(null);

  useEffect(() => {
    if (loading) {
      const timer = window.setTimeout(() => {
        setStartedAt(Date.now());
        setVisible(true);
      }, delay);
      return () => window.clearTimeout(timer);
    }

    const elapsed = startedAt ? Date.now() - startedAt : minimum;
    const timer = window.setTimeout(
      () => {
        setVisible(false);
        setStartedAt(null);
      },
      Math.max(0, minimum - elapsed),
    );
    return () => window.clearTimeout(timer);
  }, [delay, loading, minimum, startedAt]);

  return visible;
}
