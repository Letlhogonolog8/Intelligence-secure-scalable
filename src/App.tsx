
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationProvider";
import { logError } from "@/lib/logger";
import { GlobalLoadingIndicator } from "@/components/GlobalLoadingIndicator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { hasSupabase } from "@/lib/env";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import RoleSelection from "./pages/RoleSelection";
import AuthenticationFlow from "./pages/AuthenticationFlow";
import ProfileInitialization from "./pages/ProfileInitialization";
import Admin from "./pages/Admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => logError(error, { source: "react-query" }),
  }),
  mutationCache: new MutationCache({
    onError: (error) => logError(error, { source: "react-query" }),
  }),
});

const App = () => (
  <ThemeProvider defaultTheme="light">
    <ErrorBoundary>
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
          <GlobalLoadingIndicator />
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<RoleSelection />} />
                <Route path="/auth/verify" element={<AuthenticationFlow />} />
                <Route path="/auth/initialize" element={<ProfileInitialization />} />
                <Route path="/app" element={<Index />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
          </OrganizationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </ThemeProvider>
);

export default App;
