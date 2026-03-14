// src/config/selectors.ts
// DOM selectors per platform — update here when platform layouts change

export interface PlatformSelectors {
  tokenLink: string;
  addressPattern: RegExp;
  cardContainer: string;
  insertionPoint: string;
}

export const PLATFORM_SELECTORS: Record<string, PlatformSelectors> = {
  pumpfun: {
    tokenLink: 'a[href^="/coin/"]',
    addressPattern: /^\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})$/,
    cardContainer: '[class*="flex"]',
    insertionPoint: 'div, span, p',
  },
};
