
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationProvider";
import { GlobalLoadingIndicator } from "@/components/GlobalLoadingIndicator";
import { OfflineSyncIndicator } from "@/components/OfflineSyncIndicator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { hasSupabase } from "@/lib/env";
import { queryClient } from "@/lib/queryClient";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const RoleSelection = lazy(() => import("./pages/RoleSelection"));
const AuthenticationFlow = lazy(() => import("./pages/AuthenticationFlow"));
const ProfileInitialization = lazy(() => import("./pages/ProfileInitialization"));
const Admin = lazy(() => import("./pages/Admin"));
const ImpactDashboard = lazy(() => import("./pages/ImpactDashboard"));

const App = () => (
  <ErrorBoundary>
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OrganizationProvider>
            {!hasSupabase && (
              <div className="px-4 pt-4">
                <Alert variant="warning">
                  <AlertTitle>Supabase not configured</AlertTitle>
                  <AlertDescription>
                    Add VITE_SUPABASE_URL and VITE_SUPABASE_KEY to your .env file to enable
                    authentication.
                  </AlertDescription>
                </Alert>
              </div>
            )}
            <OfflineSyncIndicator />
            <GlobalLoadingIndicator />
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/auth" element={<RoleSelection />} />
                    <Route path="/auth/verify" element={<AuthenticationFlow />} />
                    <Route path="/auth/initialize" element={<ProfileInitialization />} />
                    <Route path="/app" element={<Index />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/impact" element={<ImpactDashboard />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </OrganizationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
