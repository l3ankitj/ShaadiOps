import React, { createContext, useContext } from 'react';

export type AccessLevel = 'full' | 'readonly';

export const ACCESS_STORAGE_KEY = 'shaadiops_access';

const AccessContext = createContext<AccessLevel>('full');

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const level = (sessionStorage.getItem(ACCESS_STORAGE_KEY) as AccessLevel) || 'full';
  return <AccessContext.Provider value={level}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessLevel {
  return useContext(AccessContext);
}

export function useIsReadOnly(): boolean {
  return useContext(AccessContext) === 'readonly';
}
