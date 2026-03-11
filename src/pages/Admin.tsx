import React, { Suspense, lazy } from "react";
import { AuthGate } from "@/components/auth/AuthGate";

const AdminConsole = lazy(() => import("@/components/admin/AdminConsole"));

const Admin: React.FC = () => {
  return (
    <AuthGate>
      <Suspense fallback={null}>
        <AdminConsole />
      </Suspense>
    </AuthGate>
  );
};

export default Admin;
