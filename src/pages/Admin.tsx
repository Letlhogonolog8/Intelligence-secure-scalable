import React, { Suspense, lazy } from "react";
import { AuthGate } from "@/components/auth/AuthGate";

const AdminConsole = lazy(() => import("@/components/admin/AdminConsole"));

const Admin: React.FC = () => {
  return (
    <AuthGate requiredRoles={["admin"]} loginRole="admin" unauthorizedRedirect="/auth/verify?role=admin">
      <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
        <AdminConsole />
      </Suspense>
    </AuthGate>
  );
};

export default Admin;
