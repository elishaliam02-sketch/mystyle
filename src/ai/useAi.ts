import { useCallback, useEffect, useState } from "react";
import type { AiState, AskResult } from "./client";

/**
 * Runs one AI request and tracks its state for the UI. Aborts on unmount and
 * whenever the inputs change, so a fast typist never renders a stale answer.
 *
 * `key` is what the request depends on: change it and the request re-runs.
 */
export function useAi<T>(
  key: string | null,
  run: (signal: AbortSignal) => Promise<AskResult<T>>,
): { value: T | null; state: AiState; retry: () => void } {
  const [value, setValue] = useState<T | null>(null);
  const [state, setState] = useState<AiState>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) {
      setValue(null);
      setState("unavailable");
      return;
    }
    const ctl = new AbortController();
    setValue(null);
    setState("checking");

    run(ctl.signal)
      .then((result) => {
        if (ctl.signal.aborted) return;
        if (result.ok) {
          setValue(result.value);
          setState("ready");
        } else {
          setValue(null);
          setState(result.state);
        }
      })
      .catch(() => {
        if (!ctl.signal.aborted) setState("failed");
      });

    return () => ctl.abort();
    // `run` is recreated every render by callers; `key` is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { value, state, retry };
}
