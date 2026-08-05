// src/ProContext.tsx
// Single source of truth for entitlement state across the app, plus the hook
// screens use to trigger the paywall from an upsell.
import React, { createContext, useContext } from 'react';

export interface ProState {
  isPro: boolean;
  /** Called after a successful purchase or restore. */
  setPro: (value: boolean) => void;
  /** Opens the paywall modal. `reason` is shown as the headline. */
  showPaywall: (reason?: string) => void;
}

export const ProContext = createContext<ProState>({
  isPro: false,
  setPro: () => {},
  showPaywall: () => {},
});

export function usePro(): ProState {
  return useContext(ProContext);
}
