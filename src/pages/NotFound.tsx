import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { logError } from "@/lib/logger";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logError("404: User attempted to access non-existent route", { path: location.pathname });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <main className="text-center p-8 rounded-lg border border-border bg-card shadow-md animate-slide-in">
        <h1 className="text-5xl font-bold mb-6 text-primary">404</h1>
        <p className="text-xl text-card-foreground mb-6">Page not found</p>
        <a href="/" className="text-primary hover:text-primary/80 underline transition-colors">
          Return to Home
        </a>
      </main>
    </div>
  );
};

export default NotFound;
