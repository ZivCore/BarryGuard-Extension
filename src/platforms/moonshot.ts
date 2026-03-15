import { GenericSolanaPlatform } from './generic-solana';

export class MoonshotPlatform extends GenericSolanaPlatform {
  constructor() {
    super({
      id: 'moonshot',
      name: 'Moonshot',
      hostPattern: ['*://moonshot.money/*'],
      hostnames: ['moonshot.money'],
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
