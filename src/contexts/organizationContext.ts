import { createContext, useContext } from "react";

type OrganizationContextValue = {
  organizationId: string | null;
  organizationName: string;
  loading: boolean;
};

const OrganizationContext = createContext<OrganizationContextValue>({
  organizationId: null,
  organizationName: "Independent",
  loading: false,
});

export const useOrganizationContext = () => useContext(OrganizationContext);

export { OrganizationContext };
