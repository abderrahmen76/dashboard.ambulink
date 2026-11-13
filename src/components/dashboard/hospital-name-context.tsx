"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Hospital name resolved once by the clinic layout, so tab content does not
 * need the manager session object just to render its header.
 */
const HospitalNameContext = createContext<string | null>(null);

export function HospitalNameProvider({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return (
    <HospitalNameContext.Provider value={value}>
      {children}
    </HospitalNameContext.Provider>
  );
}

export function useHospitalName(): string {
  return useContext(HospitalNameContext) ?? "";
}
