import { use } from 'react';
import { ConfigContext, ConfigContextValue } from 'contexts/ConfigContext';

// ==============================|| CONFIG - HOOKS ||============================== //

export default function useConfig(): ConfigContextValue {
  const context = use(ConfigContext);

  if (!context) throw new Error('useConfig must be use inside ConfigProvider');

  return context;
}
