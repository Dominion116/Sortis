import * as React from "react";

/**
 * Keyed pending state for async UI actions.
 *
 * The point of this hook is the *timing*. Deriving a button's spinner from
 * wagmi's `isPending` means the button only reacts once the connector plumbing
 * has started, which is visibly after the click. `run` flips its key's flag
 * synchronously, before the handler's first `await`, so the button disables and
 * shows its spinner on the same render as the click.
 *
 * State is keyed rather than a single boolean so one in-flight action does not
 * disable unrelated controls. Withdrawals key on the ticket id, which is why
 * this stores a set instead of one string.
 */
export function useAsyncAction() {
  const [pendingKeys, setPendingKeys] = React.useState<readonly string[]>([]);
  const mounted = React.useRef(true);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const isPending = React.useCallback(
    (key: string) => pendingKeys.includes(key),
    [pendingKeys],
  );

  const run = React.useCallback(
    async (key: string, action: () => Promise<void>): Promise<void> => {
      // Synchronous, so the very next render already shows the spinner.
      setPendingKeys((keys) => (keys.includes(key) ? keys : [...keys, key]));
      try {
        await action();
      } finally {
        // The component can unmount mid-flight (a pool switch unmounts the
        // ticket rows), and setting state after that is a no-op React warns
        // about, so the guard is not decorative.
        if (mounted.current) {
          setPendingKeys((keys) => keys.filter((entry) => entry !== key));
        }
      }
    },
    [],
  );

  return {
    /** True when any keyed action is in flight. */
    busy: pendingKeys.length > 0,
    isPending,
    run,
  };
}
