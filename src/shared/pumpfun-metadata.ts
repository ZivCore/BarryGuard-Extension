import type { TokenMetadata } from './types';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodePumpFunValue(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
    .trim();
}

function normalizePumpFunSource(source: string): string {
  return source
    .replace(/\\"/g, '"')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
}

export function extractPumpFunEmbeddedMetadata(address: string, source: string): TokenMetadata {
  const normalizedSource = normalizePumpFunSource(source);
  const escapedAddress = escapeRegExp(address);
  const patterns = [
    new RegExp(
      `"coin":\\{"mint":"${escapedAddress}"[\\s\\S]{0,3200}?"name":"([^"]{1,160})"[\\s\\S]{0,500}?"symbol":"([^"]{1,40})"[\\s\\S]{0,1400}?"image_uri":"([^"]{1,1200})"`,
      'i',
    ),
    new RegExp(
      `"mint":"${escapedAddress}"[\\s\\S]{0,3200}?"name":"([^"]{1,160})"[\\s\\S]{0,500}?"symbol":"([^"]{1,40})"[\\s\\S]{0,1400}?"image_uri":"([^"]{1,1200})"`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = normalizedSource.match(pattern);
    if (!match) {
      continue;
    }

    return {
      name: decodePumpFunValue(match[1]),
      symbol: decodePumpFunValue(match[2]),
      imageUrl: decodePumpFunValue(match[3]),
    };
  }

  return {};
}
