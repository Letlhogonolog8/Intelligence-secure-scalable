import React from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import AdminConsole from "@/components/admin/AdminConsole";

const Admin: React.FC = () => {
  return (
    <AuthGate>
      <AdminConsole />
    </AuthGate>
  );
};

export default Admin;
