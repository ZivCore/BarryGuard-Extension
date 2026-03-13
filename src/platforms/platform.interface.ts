/**
 * Platform Interface
 * Abstraction for multi-platform support
 */

export interface IPlatform {
  /**
   * Platform name
   */
  readonly name: string;

  /**
   * URL patterns to match for this platform
   */
  readonly hostPattern: string[];

  /**
   * Extract all token addresses from current page
   */
  extractTokenAddresses(): string[];

  /**
   * Render score badge for a token
   */
  renderScoreBadge(address: string, score: number, risk: 'high' | 'medium' | 'low'): void;

  /**
   * Observe DOM changes for dynamic content
   */
  observeDOMChanges(callback: () => void): void;
}
