import PropTypes from 'prop-types';
import { createContext, useMemo, ReactNode, Context } from 'react';

// project imports
import config, { Config } from 'config';
import { useLocalStorage } from 'hooks/useLocalStorage';

// ==============================|| CONFIG CONTEXT ||============================== //

export interface ConfigContextValue {
  state: Config;
  setState: (state: Config) => void;
  setField: (field: keyof Config, value: any) => void;
  resetState: () => void;
}

export const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

// ==============================|| CONFIG PROVIDER ||============================== //

export interface ConfigProviderProps {
  children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const { state, setState, setField, resetState } = useLocalStorage('berry-config-vite-js', config);

  const memoizedValue = useMemo(() => ({ state, setState, setField, resetState }), [state, setField, setState, resetState]);

  return <ConfigContext.Provider value={memoizedValue}>{children}</ConfigContext.Provider>;
}

ConfigProvider.propTypes = { children: PropTypes.node };

