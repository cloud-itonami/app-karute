// Vitest setup — installs minimal browser globals jsdom doesn't ship by default.
import { webcrypto } from 'node:crypto';

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

// jsdom omits URL.createObjectURL by default — components that export FHIR
// Bundles rely on it. Stub returns a deterministic blob URL string for tests.
if (typeof URL.createObjectURL === 'undefined') {
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (_b: Blob) =>
    `blob:test-${Math.random().toString(16).slice(2)}`;
}
if (typeof URL.revokeObjectURL === 'undefined') {
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
}
