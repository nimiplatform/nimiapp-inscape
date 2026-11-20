import { createContext, useContext, type ReactNode } from 'react';

export type InscapeSettingsControls = {
  readonly open: boolean;
  readonly setOpen: (next: boolean) => void;
  readonly openSettings: () => void;
  readonly runtimeSettingsSlot?: ReactNode;
  readonly accountControlSlot?: ReactNode;
  readonly isWeb: boolean;
};

const SettingsContext = createContext<InscapeSettingsControls | null>(null);

export function InscapeSettingsProvider({
  value,
  children,
}: {
  readonly value: InscapeSettingsControls;
  readonly children: ReactNode;
}) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useInscapeSettings(): InscapeSettingsControls | null {
  return useContext(SettingsContext);
}
