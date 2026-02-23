import { useMemo, type ReactNode } from "react";
import { OrganizationContext } from "@/contexts/organizationContext";
import { useAuth } from "@/hooks/use-auth";
import { useOrganization, useUserProfile } from "@/data/aegisData";

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id);
  const organizationId = profile?.organizationId ?? null;
  const { data: organization, isLoading: organizationLoading } = useOrganization(organizationId);
  const value = useMemo(
    () => ({
      organizationId,
      organizationName: organization?.name ?? "Independent",
      loading: profileLoading || organizationLoading,
    }),
    [organizationId, organization?.name, profileLoading, organizationLoading]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
};
