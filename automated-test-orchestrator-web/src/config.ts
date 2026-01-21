export const DASHBOARD_PATH = '/sample-page';
export const DEFAULT_THEME_MODE = 'system';

export const CSS_VAR_PREFIX = '';

export interface Config {
  fontFamily: string;
  borderRadius: number;
  outlinedFilled?: boolean;
  presetColor?: string;
  locale?: string;
  rtlLayout?: boolean;
  miniDrawer?: boolean;
  container?: boolean;
}

const config: Config = {
  fontFamily: `'Roboto', sans-serif`,
  borderRadius: 8
};

export default config;
