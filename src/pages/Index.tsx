
import React from "react";
import AppLayout from "@/components/AppLayout";
import { AuthGate } from "@/components/auth/AuthGate";

const Index: React.FC = () => {
  return (
    <AuthGate>
      <AppLayout />
    </AuthGate>
  );
};

export default Index;
