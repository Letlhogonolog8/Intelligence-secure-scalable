import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ModuleType,
  MODULE_LIST,
  MODULE_METADATA,
  useAlertsFeed,
  useJusticeCases,
  useRegions,
  useSystemMetrics,
  useUserProfile,
} from "@/data/aegisData";
import {
  BellIcon,
  SearchIcon,
  MenuIcon,
  ClockIcon,
  SettingsIcon,
} from "@/components/ui/AegisIcons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useOrganizationContext } from "@/contexts/organizationContext";
import { ROLE_DEFINITIONS, UserRole } from "@/lib/roleConfig";
import { useAppStore } from "@/store/appStore";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PresenceIndicator from "@/components/presence/PresenceIndicator";

interface HeaderProps {
  activeModule: ModuleType;
  onToggleSidebar: () => void;
}

const moduleLabels = MODULE_METADATA;

const getSafeLocale = (value?: string | null) => {
  if (!value || typeof value !== "string") {
    return "en-US";
  }

  try {
    return Intl.getCanonicalLocales(value)[0] ?? "en-US";
  } catch {
    return "en-US";
  }
};

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  moduleId?: ModuleType;
};

const Header: React.FC<HeaderProps> = ({ activeModule, onToggleSidebar }) => {
  const [showAlerts, setShowAlerts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [showSearch, setShowSearch] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [activeAlertIndex, setActiveAlertIndex] = useState(0);
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);
  const alertsPanelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const { setActiveModule } = useAppStore();
  const { user, signOut } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const { organizationName } = useOrganizationContext();
  const { data: regions = [] } = useRegions({ staleTime: 60000 });
  const { data: justiceCases = [] } = useJusticeCases({ staleTime: 60000 });
  const { data: alertsFeed = [] } = useAlertsFeed({
    staleTime: 5000,
    refetchInterval: 15000,
  });
  const { data: systemMetricsData } = useSystemMetrics({
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const locale = getSafeLocale(
    typeof navigator === "undefined" ? "en-US" : navigator.language,
  );
  const mod = moduleLabels[activeModule] ?? moduleLabels.command_center;
  const userUsername = user?.email ? user.email.split("@")[0] : "Admin";
  const roleKey = (profile?.role ?? "analyst") as UserRole;
  const roleLabel = ROLE_DEFINITIONS[roleKey]?.label ?? "Analyst";
  const userInitials = useMemo(
    () => (userUsername ? userUsername.slice(0, 2).toUpperCase() : "AD"),
    [userUsername],
  );
  const isAdmin = profile?.role === "admin";
  const systemMetrics = systemMetricsData ?? null;
  const criticalAlerts = useMemo(
    () => alertsFeed.filter((alert) => alert.type === "critical").length,
    [alertsFeed],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    [locale],
  );
  const formattedTime = useMemo(
    () => timeFormatter.format(currentTime),
    [currentTime, timeFormatter],
  );
  const deferredQuery = useDeferredValue(debouncedQuery);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const desktopListboxId = "aegis-search-results-desktop";
  const mobileListboxId = "aegis-search-results-mobile";
  const alertsPanelId = "aegis-alerts-panel";
  const mobileSearchId = "aegis-mobile-search";
  const shouldShowResults = normalizedQuery.length >= 2;

  const resolveModuleId = useCallback((value?: string) => {
    if (!value) {
      return undefined;
    }
    const normalized = value.toLowerCase().trim().replace(/\s+/g, "_");
    return MODULE_LIST.find((moduleId) => moduleId === normalized);
  }, []);

  const getAlertButtons = useCallback(
    () =>
      Array.from(
        alertsPanelRef.current?.querySelectorAll<HTMLButtonElement>(
          'button[data-alert-item="true"]',
        ) ?? [],
      ),
    [],
  );

  const getAlertFocusables = useCallback(
    () =>
      Array.from(
        alertsPanelRef.current?.querySelectorAll<HTMLButtonElement>(
          'button[data-alert-focusable="true"]',
        ) ?? [],
      ),
    [],
  );

  const focusAlertAt = useCallback(
    (index: number) => {
      const buttons = getAlertButtons();
      if (!buttons.length) {
        return;
      }
      const nextIndex = Math.max(0, Math.min(index, buttons.length - 1));
      setActiveAlertIndex(nextIndex);
      buttons[nextIndex]?.focus();
    },
    [getAlertButtons],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    if (showSearch) {
      mobileSearchRef.current?.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (showAlerts) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setActiveAlertIndex(0);
      window.setTimeout(() => {
        const buttons = getAlertButtons();
        if (buttons.length) {
          buttons[0]?.focus();
          return;
        }
        alertsPanelRef.current?.focus();
      }, 0);
      return;
    }
    previousFocusRef.current?.focus();
  }, [showAlerts, getAlertButtons]);

  const searchResults = useMemo(() => {
    if (normalizedQuery.length < 2) {
      return [];
    }
    const regionResults: SearchResult[] = regions
      .filter(
        (region) =>
          region.name.toLowerCase().includes(normalizedQuery) ||
          region.country.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 3)
      .map((region) => ({
        id: `region-${region.id}`,
        title: region.name,
        subtitle: `${region.country} · Risk Score ${region.riskScore.toFixed(2)}`,
        category: "Region",
        moduleId: "prediction" as ModuleType,
      }));

    const caseResults: SearchResult[] = justiceCases
      .filter(
        (item) =>
          item.caseNumber.toLowerCase().includes(normalizedQuery) ||
          item.type.toLowerCase().includes(normalizedQuery) ||
          item.region.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 3)
      .map((item) => ({
        id: `case-${item.id}`,
        title: item.caseNumber,
        subtitle: `${item.type} · ${item.region}`,
        category: "Case",
        moduleId: "justice" as ModuleType,
      }));

    const alertResults: SearchResult[] = alertsFeed
      .filter((alert) => alert.message.toLowerCase().includes(normalizedQuery))
      .slice(0, 2)
      .map((alert) => ({
        id: `alert-${alert.id}`,
        title: alert.message,
        subtitle: `${alert.time} · ${alert.module.replace("_", " ")}`,
        category: "Alert",
        moduleId: resolveModuleId(alert.module),
      }));

    return [...regionResults, ...caseResults, ...alertResults].slice(0, 6);
  }, [normalizedQuery, regions, justiceCases, alertsFeed, resolveModuleId]);

  useEffect(() => {
    if (searchResults.length) {
      setActiveResultIndex(0);
    } else {
      setActiveResultIndex(-1);
    }
  }, [searchResults.length]);

  const highlightText = (value: string) => {
    if (!normalizedQuery) {
      return value;
    }
    const index = value.toLowerCase().indexOf(normalizedQuery);
    if (index === -1) {
      return value;
    }
    return (
      <>
        <span>{value.slice(0, index)}</span>
        <span className="text-indigo-300">
          {value.slice(index, index + normalizedQuery.length)}
        </span>
        <span>{value.slice(index + normalizedQuery.length)}</span>
      </>
    );
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (!searchResults.length) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResultIndex((prev) => (prev + 1) % searchResults.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResultIndex(
        (prev) => (prev - 1 + searchResults.length) % searchResults.length,
      );
    }
    if (event.key === "Enter" && activeResultIndex >= 0) {
      event.preventDefault();
      const selected = searchResults[activeResultIndex];
      if (selected) {
        handleResultSelect(selected);
      }
    }
  };

  const handleResultSelect = (result: SearchResult) => {
    if (result.moduleId) {
      setActiveModule(result.moduleId);
    }
    setSearchQuery(result.title);
    setShowSearch(false);
    setShowAlerts(false);
  };

  const handleAlertSelect = useCallback(
    (moduleValue: string) => {
      const moduleId = resolveModuleId(moduleValue);
      if (moduleId) {
        setActiveModule(moduleId);
      }
      setShowAlerts(false);
    },
    [resolveModuleId, setActiveModule],
  );

  const handleAlertsKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!showAlerts) {
        return;
      }
      if (event.key === "Tab") {
        const focusables = getAlertFocusables();
        if (!focusables.length) {
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        const buttons = getAlertButtons();
        if (!buttons.length) {
          return;
        }
        event.preventDefault();
        const currentIndex = buttons.findIndex(
          (button) => button === document.activeElement,
        );
        const baseIndex = currentIndex >= 0 ? currentIndex : activeAlertIndex;
        if (event.key === "Home") {
          focusAlertAt(0);
          return;
        }
        if (event.key === "End") {
          focusAlertAt(buttons.length - 1);
          return;
        }
        const nextIndex =
          event.key === "ArrowDown"
            ? (baseIndex + 1) % buttons.length
            : (baseIndex - 1 + buttons.length) % buttons.length;
        focusAlertAt(nextIndex);
      }
    },
    [
      showAlerts,
      getAlertButtons,
      getAlertFocusables,
      activeAlertIndex,
      focusAlertAt,
    ],
  );

  const activeResultDesktopId =
    activeResultIndex >= 0
      ? `${desktopListboxId}-item-${activeResultIndex}`
      : undefined;
  const activeResultMobileId =
    activeResultIndex >= 0
      ? `${mobileListboxId}-item-${activeResultIndex}`
      : undefined;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAlerts(false);
        setShowSearch(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="relative z-10 flex h-14 items-center justify-between border-b border-slate-800/50 bg-slate-950/80 px-3 backdrop-blur-xl sm:h-16 sm:px-4 lg:px-6">
      {/* Left */}
      <div className="min-w-0 flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          aria-label="Toggle sidebar"
          onClick={onToggleSidebar}
          className="lg:hidden text-slate-400 hover:text-white transition-colors"
        >
          <MenuIcon size={20} />
        </button>
        <div className="min-w-0">
          <h2 className="max-w-[46vw] truncate text-sm font-semibold text-white sm:max-w-none lg:text-base">
            {mod.title}
          </h2>
          <p className="hidden text-xs text-slate-400 sm:block">
            {mod.subtitle}
          </p>
        </div>
      </div>

      {/* Center - Search */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <SearchIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            size={16}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search incidents, regions, models..."
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls={desktopListboxId}
            aria-expanded={shouldShowResults}
            aria-activedescendant={activeResultDesktopId}
            aria-haspopup="listbox"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-lg pl-10 pr-12 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
          {shouldShowResults && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-xl p-3 z-50"
              aria-live="polite"
              aria-atomic="true"
            >
              {searchResults.length ? (
                <ul role="listbox" id={desktopListboxId} className="space-y-1">
                  {searchResults.map((result, index) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        role="option"
                        id={`${desktopListboxId}-item-${index}`}
                        aria-selected={index === activeResultIndex}
                        onMouseEnter={() => setActiveResultIndex(index)}
                        onClick={() => handleResultSelect(result)}
                        className={`w-full text-left px-3 py-2 rounded transition-colors ${
                          index === activeResultIndex
                            ? "bg-slate-800/80 text-white"
                            : "hover:bg-slate-800/60 text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">
                            {highlightText(result.title)}
                          </p>
                          <span className="text-[10px] uppercase tracking-widest text-slate-500">
                            {result.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {highlightText(result.subtitle)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500" role="status">
                  No results found.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Mobile search */}
        <button
          type="button"
          aria-label="Toggle search"
          aria-expanded={showSearch}
          aria-controls={mobileSearchId}
          onClick={() => setShowSearch(!showSearch)}
          className="md:hidden text-slate-400 hover:text-white transition-colors"
        >
          <SearchIcon size={18} />
        </button>

        {/* Live indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-800">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-medium">LIVE</span>
          {systemMetrics?.agentsOnline !== undefined ? (
            <span className="text-[10px] text-slate-500">
              {systemMetrics.agentsOnline} agents
            </span>
          ) : (
            <Skeleton className="h-3 w-10 bg-slate-800/60" />
          )}
        </div>

        {/* Clock */}
        <div className="hidden lg:flex items-center gap-1.5 text-slate-500">
          <ClockIcon size={14} />
          <span className="text-xs font-mono">{formattedTime}</span>
        </div>

        <div className="hidden sm:block border-l border-slate-800 pl-3">
          <LanguageSwitcher />
        </div>

        {/* Alerts */}
        <div className="relative">
          <button
            type="button"
            aria-label="Toggle alerts"
            aria-expanded={showAlerts}
            aria-controls={alertsPanelId}
            aria-haspopup="dialog"
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative p-2 text-slate-400 hover:text-white transition-colors"
          >
            <BellIcon size={18} />
            {criticalAlerts > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold animate-pulse">
                {criticalAlerts}
              </span>
            )}
          </button>

          {showAlerts && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAlerts(false)}
              />
              <div
                id={alertsPanelId}
                ref={alertsPanelRef}
                role="dialog"
                aria-label="System alerts"
                aria-modal="false"
                tabIndex={-1}
                onKeyDown={handleAlertsKeyDown}
                className="absolute right-0 top-full z-50 mt-2 max-h-[78vh] w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl sm:w-96"
              >
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-white font-semibold text-sm">
                    System Alerts
                  </h3>
                  <span className="text-xs text-slate-500">
                    {alertsFeed.length} alerts
                  </span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {alertsFeed.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      data-alert-item="true"
                      data-alert-focusable="true"
                      onClick={() => handleAlertSelect(alert.module)}
                      className="w-full text-left px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                            alert.type === "critical"
                              ? "bg-red-500 animate-pulse"
                              : alert.type === "high"
                                ? "bg-orange-500"
                                : alert.type === "warning"
                                  ? "bg-amber-500"
                                  : "bg-blue-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white leading-relaxed">
                            {alert.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-500">
                              {alert.time}
                            </span>
                            <span className="text-[10px] text-slate-600">
                              |
                            </span>
                            <span className="text-[10px] text-indigo-400">
                              {alert.module.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="p-3 border-t border-slate-800">
                  <button
                    type="button"
                    data-alert-focusable="true"
                    className="w-full text-center text-xs text-indigo-400 hover:text-indigo-300 transition-colors py-1"
                  >
                    View All Alerts
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {isAdmin && (
          <button
            type="button"
            aria-label="Open admin console"
            onClick={() => setActiveModule("admin_console")}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <SettingsIcon size={18} />
          </button>
        )}

        <PresenceIndicator className="hidden sm:block" />

        {/* User */}
        <div className="flex items-center gap-2 border-l border-slate-800 pl-2 sm:pl-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 sm:h-8 sm:w-8">
            <span className="text-white text-xs font-bold">{userInitials}</span>
          </div>
          <div className="hidden lg:block">
            <p className="text-xs text-white font-medium truncate max-w-[140px]">
              {userUsername}
            </p>
            <p className="text-[10px] text-slate-500">
              {user
                ? `${roleLabel} · ${organizationName}`
                : "Level 5 Clearance"}
            </p>
          </div>
          {user && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="hidden text-slate-400 hover:text-white md:inline-flex"
            >
              Sign out
            </Button>
          )}
        </div>
      </div>

      {showSearch && (
        <div
          id={mobileSearchId}
          className="absolute left-0 right-0 top-full md:hidden bg-slate-950/95 border-b border-slate-800/60 px-4 py-3"
        >
          <div className="relative">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              size={16}
            />
            <input
              ref={mobileSearchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search incidents, regions, models..."
              aria-label="Search"
              aria-autocomplete="list"
              aria-controls={mobileListboxId}
              aria-expanded={shouldShowResults}
              aria-activedescendant={activeResultMobileId}
              aria-haspopup="listbox"
              role="combobox"
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-lg pl-10 pr-12 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>
          {shouldShowResults && (
            <div
              className="mt-2 bg-slate-900 border border-slate-800 rounded-lg shadow-xl p-3"
              aria-live="polite"
              aria-atomic="true"
            >
              {searchResults.length ? (
                <ul role="listbox" id={mobileListboxId} className="space-y-1">
                  {searchResults.map((result, index) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        role="option"
                        id={`${mobileListboxId}-item-${index}`}
                        aria-selected={index === activeResultIndex}
                        onMouseEnter={() => setActiveResultIndex(index)}
                        onClick={() => handleResultSelect(result)}
                        className={`w-full text-left px-3 py-2 rounded transition-colors ${
                          index === activeResultIndex
                            ? "bg-slate-800/80 text-white"
                            : "hover:bg-slate-800/60 text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">
                            {highlightText(result.title)}
                          </p>
                          <span className="text-[10px] uppercase tracking-widest text-slate-500">
                            {result.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {highlightText(result.subtitle)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500" role="status">
                  No results found.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
