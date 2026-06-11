# AEGIS Support — Survivor Mobile App

A dedicated, trauma-informed **React Native (Expo)** app for survivors. It is the
mobile half of the AEGIS-AI platform; professionals continue to use the web
portal. Both share the same Supabase + Express backend — this app makes **no**
backend changes (see `docs/MOBILE_APP_REPLICATION_SPEC.md`).

## Stack

- Expo SDK 56 + TypeScript, file-based routing via **expo-router**
- Supabase (`@supabase/supabase-js` + AsyncStorage session)
- `@tanstack/react-query`, `i18next`/`react-i18next`
- `expo-location` (SOS), `expo-secure-store`

## Setup

```bash
cd mobile
npm install --legacy-peer-deps        # React 19 peers
cp .env.example .env                  # fill in values (already set for this project)
```

`.env` keys (publishable only):

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` — same as the web `VITE_SUPABASE_*`
- `EXPO_PUBLIC_API_URL` — backend base URL (no trailing `/api`). For local dev use
  `http://<your-lan-ip>:5000` so a physical device can reach your machine.

## Run

```bash
npx expo start            # then scan the QR with Expo Go, or press a/i for emulator
npm run typecheck         # tsc --noEmit
npx expo export -p android  # verify the production bundle builds
```

## Structure

```
app/                        expo-router screens
  index.tsx                 launch gate (language → auth → survivor)
  (onboarding)/language     first-run language picker
  (auth)/                   sign-in, sign-up, public resources
  (survivor)/               tabbed app: home, sos, support, report, resources, profile, case-status
src/
  auth/                     AuthProvider, survivor-only guard, buildAuthEmail
  features/sos              escalation_events SOS (mirrors web PanicButton)
  features/chat             AI support chat (/api/ai/survivor-chat) + offline fallback
  features/offline          local draft queue for incident reports
  components/               UI kit, QuickExit, ResourcesView, Icon
  shared/                   table types + offline emergency directory
  i18n/                     i18next setup + English strings (other locales fall back)
  lib/                      env, supabase client, api, query client
```

## What works (this iteration)

Survivor onboarding/auth (survivor-only — staff are redirected to the web portal),
Home, **SOS** (location + `escalation_events`, 5s confirm, hotline fallback),
**Support** (AI chat + anonymous peer feed), **Report** (with offline draft queue),
**Case status**, offline **Resources**, and **Profile** (language, notification
privacy, app-lock preference, sign-out). Quick-exit on every survivor screen.

## Deferred (next iterations — see spec §19)

Voice incident reporter, BLE silent SOS, push notifications, evidence upload,
Socket.IO realtime alerts, biometric app-lock enforcement (`expo-local-authentication`),
and full translations for the non-English locales.
