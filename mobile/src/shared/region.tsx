import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  COUNTRIES,
  CountryEmergency,
  DEFAULT_COUNTRY,
  getCountry,
} from "@/shared/emergencyNumbers";

const COUNTRY_KEY = "aegis.country";

/** Best-effort device region (e.g. "ZA", "US"). Null if unavailable. */
function deviceRegion(): string | null {
  try {
    const locales = Localization.getLocales();
    return locales[0]?.regionCode ?? null;
  } catch {
    return null;
  }
}

/** Resolve initial country: device region if we have numbers for it, else INTL. */
function initialCountryCode(): string {
  const region = deviceRegion();
  if (region && COUNTRIES.some((c) => c.code === region)) return region;
  return DEFAULT_COUNTRY;
}

interface RegionState {
  country: CountryEmergency;
  countries: CountryEmergency[];
  setCountry: (code: string) => void;
}

const RegionContext = createContext<RegionState | undefined>(undefined);

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [code, setCode] = useState<string>(initialCountryCode);

  // Load a saved override (overrides device detection) after mount.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(COUNTRY_KEY)
      .then((saved) => {
        if (active && saved && COUNTRIES.some((c) => c.code === saved)) setCode(saved);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setCountry = useCallback((next: string) => {
    setCode(next);
    void AsyncStorage.setItem(COUNTRY_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<RegionState>(
    () => ({ country: getCountry(code), countries: COUNTRIES, setCountry }),
    [code, setCountry],
  );

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion(): RegionState {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within RegionProvider");
  return ctx;
}
