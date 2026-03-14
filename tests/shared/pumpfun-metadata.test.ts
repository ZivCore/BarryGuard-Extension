import { describe, expect, it } from 'vitest';
import { extractPumpFunEmbeddedMetadata } from '../../src/shared/pumpfun-metadata';

describe('extractPumpFunEmbeddedMetadata', () => {
  it('parses escaped embedded coin metadata from Pump.fun page payload', () => {
    const address = 'D9g3NFv4qCeDFbj35DxB4aa53oDudfUtbv6S8Umdpump';
    const source = `
      <script>
        self.__next_f.push([1,"1c:[\\"$\\",\\"$L43\\",null,{\\"mint\\":\\"${address}\\",\\"children\\":[\\"$\\",\\"$L4a\\",null,{\\"coin\\":{\\"mint\\":\\"${address}\\",\\"name\\":\\"Agent W\\",\\"symbol\\":\\"WHALE\\",\\"image_uri\\":\\"https://ipfs.io/ipfs/bafkreigravkelqw53yxy5ysruy6jf5jujjew6tt7lvlwb6uhxhddjusw6y\\"}}]}]"]);
      </script>
    `;

    expect(extractPumpFunEmbeddedMetadata(address, source)).toEqual({
      name: 'Agent W',
      symbol: 'WHALE',
      imageUrl: 'https://ipfs.io/ipfs/bafkreigravkelqw53yxy5ysruy6jf5jujjew6tt7lvlwb6uhxhddjusw6y',
    });
  });

  it('parses raw embedded coin metadata when quotes are not escaped', () => {
    const address = 'EncFm8nRh1VBwcRmGugTUzoGsC1n2srWesKDkiMAYWLt';
    const source = `
      {"coin":{"mint":"${address}","name":"TeraFab","symbol":"TERRAFAB","image_uri":"https://ipfs.io/ipfs/example-terafab"}}
    `;

    expect(extractPumpFunEmbeddedMetadata(address, source)).toEqual({
      name: 'TeraFab',
      symbol: 'TERRAFAB',
      imageUrl: 'https://ipfs.io/ipfs/example-terafab',
    });
  });

  it('returns empty object when address is not in source', () => {
    const result = extractPumpFunEmbeddedMetadata('NotThisAddr11111111111111111111111', '<html>some content</html>');
    expect(result).toEqual({});
  });

  it('returns empty object for empty source string', () => {
    const result = extractPumpFunEmbeddedMetadata('pump1addr111111111111111111111111111', '');
    expect(result).toEqual({});
  });

  it('returns empty object when a different address is present but not the requested one', () => {
    const source = `"mint":"OtherAddr11111111111111111111111111","name":"Other Token","symbol":"OTH","image_uri":"https://example.com/img.png"`;
    const result = extractPumpFunEmbeddedMetadata('RequestedAddr11111111111111111111111', source);
    expect(result).toEqual({});
  });

  it('does not catastrophically backtrack on large malformed input', () => {
    const bigSource = 'x'.repeat(50000);
    const start = Date.now();
    extractPumpFunEmbeddedMetadata('pump1addr111111111111111111111111111', bigSource);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
