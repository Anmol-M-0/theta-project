import React, { createContext, useContext, useEffect, useMemo } from "react";
import { createStoreAdapter } from "../../adapter.js";

const ThetaContext = createContext(null);

/**
 * Provides an IntakeEngine and its reactive StoreAdapter to the React component tree.
 * Automatically manages adapter lifecycle and teardown on unmount.
 *
 * @param {Object} props
 * @param {import("../../engine.js").IntakeEngine} props.engine - Theta IntakeEngine instance
 * @param {import("../../adapter.js").StoreAdapter} [props.adapter] - Optional pre-created StoreAdapter
 * @param {React.ReactNode} props.children
 */
export function ThetaProvider({ engine, adapter, children }) {
  if (!engine) {
    throw new Error("[ThetaProvider] 'engine' prop is required.");
  }

  const storeAdapter = useMemo(() => {
    return adapter || createStoreAdapter(engine);
  }, [engine, adapter]);

  useEffect(() => {
    return () => {
      // Clean up adapter subscriptions when unmounting if internally managed
      if (!adapter && storeAdapter && !storeAdapter.isDestroyed()) {
        storeAdapter.destroy();
      }
    };
  }, [adapter, storeAdapter]);

  const value = useMemo(() => ({
    engine,
    adapter: storeAdapter,
  }), [engine, storeAdapter]);

  return React.createElement(ThetaContext.Provider, { value }, children);
}

/**
 * Accesses the current ThetaContext containing the engine and store adapter.
 *
 * @returns {{ engine: import("../../engine.js").IntakeEngine, adapter: import("../../adapter.js").StoreAdapter }}
 */
export function useThetaContext() {
  const context = useContext(ThetaContext);
  if (!context) {
    throw new Error("[useThetaContext] Must be used within a <ThetaProvider>.");
  }
  return context;
}
