import { GenericSolanaPlatform } from './generic-solana';

export class BirdeyePlatform extends GenericSolanaPlatform {
  constructor() {
    super({
      id: 'birdeye',
      name: 'Birdeye',
      hostPattern: ['*://birdeye.so/*'],
      hostnames: ['birdeye.so'],
      currentAddressPatterns: [
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:address|tokenAddress|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:address|tokenAddress|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
    });
  }
}
