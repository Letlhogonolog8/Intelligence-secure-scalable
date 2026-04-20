@echo off
cd /d "C:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable"

echo === Staging competition feature files ===

git add server/index.ts
git add server/routes/whatsappRoutes.ts
git add src/App.tsx
git add src/components/AppLayout.tsx
git add src/components/dashboard/SurvivorDashboard.tsx
git add src/components/survivor/SurvivorFeatureWorkspace.tsx
git add src/lib/roleAuthPolicy.ts
git add src/lib/roleConfig.ts
git add src/pages/ImpactDashboard.tsx
git add src/pages/RoleSelection.tsx
git add src/types/auth.ts
git add vite.config.ts
git add src/components/OfflineSyncIndicator.tsx
git add src/components/dashboard/CHWDashboard.tsx
git add src/components/survivor/EvidenceVault.tsx
git add src/components/survivor/SurvivorAIChat.tsx
git add src/hooks/useImpactMetrics.ts
git add src/hooks/useOfflineSync.ts

echo === Staged files ===
git diff --cached --name-only

echo.
echo === Committing ===
git commit -m "feat: Ele-vate AI Africa competition enhancements

- perf: vite manualChunks code splitting (13 named chunks, ~2.1MB -> lazy-loaded)
- feat: live ImpactDashboard with Supabase queries and skeleton loading
- feat: PWA offline sync (IndexedDB queue, auto-flush on reconnect, OfflineSyncIndicator)
- feat: AI Survivor Support Chatbot (claude-haiku-4-5, voice input, crisis detection, POPIA)
- feat: WhatsApp AI bot rewrite (AI chat tier, multi-language EN/ZU/AF/XH/ST, HMAC verification)
- feat: CHW (Community Health Worker) role - dashboard, referrals, visit log, offline capable
- feat: Anonymous Evidence Vault (encrypted upload, access codes, offline fallback, drag-and-drop)
- chore: CHW wired into AppLayout, roleConfig, roleAuthPolicy, MODULE_ACCESS, FEATURE_FLAGS"

echo.
echo === Pushing to origin/main ===
git push origin main

echo.
echo === Done ===
git log --oneline -5
