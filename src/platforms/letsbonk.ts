import { GenericSolanaPlatform } from './generic-solana';

export class LetsBonkPlatform extends GenericSolanaPlatform {
  constructor() {
    super({
      id: 'letsbonk',
      name: 'LetsBonk',
      hostPattern: ['*://letsbonk.fun/*', '*://bonk.fun/*'],
      hostnames: ['letsbonk.fun', 'bonk.fun'],
      currentAddressPatterns: [
        /\/(?:token|trade|coins?)\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:address|tokenAddress|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        /\/(?:token|trade|coins?)\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:address|tokenAddress|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
    });
  }
}
