import { GenericEvmPlatform } from './generic-evm';

export class VirtualsPlatform extends GenericEvmPlatform {
  constructor() {
    const prototypeAddressPattern = /\/prototypes\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'virtuals',
      name: 'Virtuals',
      hostPattern: [
        '*://app.virtuals.io/*',
        '*://www.virtuals.io/*',
        '*://virtuals.io/*',
      ],
      hostnames: ['app.virtuals.io', 'www.virtuals.io', 'virtuals.io'],
      chain: 'base',
      chains: ['base'],
      currentAddressExtractor: (location) => {
        // /prototypes/{address} — address directly in URL
        const protoMatch = location.pathname.match(prototypeAddressPattern);
        if (protoMatch?.[1]) {
          return protoMatch[1];
        }
        // /virtuals/{id} — address is in the DOM, not the URL; skip DOM extraction
        return null;
      },
      linkAddressPatterns: [prototypeAddressPattern],
      anchorSelectors: ['a[href*="/prototypes/"]', '[data-token-address]'],
      compactBadge: true,
    });
  }
}
