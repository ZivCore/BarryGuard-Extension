interface ImportMetaEnv {
  readonly [key: string]: string | undefined;
  readonly BARRYGUARD_API_URL?: string;
  readonly BARRYGUARD_APP_URL?: string;
  readonly BARRYGUARD_PRICING_URL?: string;
  readonly BARRYGUARD_ACCOUNT_URL?: string;
  readonly BARRYGUARD_FORGOT_PASSWORD_URL?: string;
  readonly WXT_BARRYGUARD_API_URL?: string;
  readonly WXT_BARRYGUARD_APP_URL?: string;
  readonly WXT_BARRYGUARD_PRICING_URL?: string;
  readonly WXT_BARRYGUARD_ACCOUNT_URL?: string;
  readonly WXT_BARRYGUARD_FORGOT_PASSWORD_URL?: string;
  readonly VITE_BARRYGUARD_API_URL?: string;
  readonly VITE_BARRYGUARD_APP_URL?: string;
  readonly VITE_BARRYGUARD_PRICING_URL?: string;
  readonly VITE_BARRYGUARD_ACCOUNT_URL?: string;
  readonly VITE_BARRYGUARD_FORGOT_PASSWORD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
