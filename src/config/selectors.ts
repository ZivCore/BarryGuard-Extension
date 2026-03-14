// src/config/selectors.ts
// DOM selectors per platform — update here when platform layouts change

export interface PlatformSelectors {
  tokenLink: string;
  addressPattern: RegExp;
  cardContainerSelectors: string[];
  insertionPointSelectors: string[];
  nameSelectors: string[];
  symbolSelectors: string[];
}

export const PLATFORM_SELECTORS: Record<string, PlatformSelectors> = {
  pumpfun: {
    tokenLink: 'a[href^="/coin/"]',
    addressPattern: /^\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})$/,
    cardContainerSelectors: [
      '[data-testid*="coin"]',
      '[class*="group"]',
      '[class*="card"]',
      '[class*="flex"]',
    ],
    insertionPointSelectors: [
      '[class*="symbol"]',
      '[class*="name"]',
      'div',
      'span',
      'p',
    ],
    nameSelectors: [
      '[data-testid*="name"]',
      '[class*="name"]',
      'h1',
      'h2',
      'strong',
    ],
    symbolSelectors: [
      '[data-testid*="symbol"]',
      '[class*="symbol"]',
      '[class*="ticker"]',
      'span',
      'p',
    ],
  },
};
