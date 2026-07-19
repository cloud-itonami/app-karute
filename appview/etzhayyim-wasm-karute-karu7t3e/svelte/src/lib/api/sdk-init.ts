// @etzhayyim/sdk lazy initializer.
//
// Holds a single `Etzhayyim` instance per browser session. The instance binds
// to the clinician's DID and PDS session; PHI never leaves the encrypted
// envelope written through this instance.
//
// PHASE 1 SHAPE: session/auth are passed in by the parent app once the
// clinician completes OAuth + libsignal local-identity setup. For the scaffold
// we expose a `getSdk()` that returns null when no session is configured;
// karute-client.ts uses that to fall back to mock writes.

import { Etzhayyim } from '@etzhayyim/sdk';
import type { LocalStores } from '@etzhayyim/sdk/signal';
import type { RecipientIdentityResolver } from '@etzhayyim/sdk/encrypted';

interface SdkSession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

interface KaruteSdkBundle {
  e: Etzhayyim;
  signalStores: LocalStores;
  resolveRecipientIdentity: RecipientIdentityResolver;
}

let cached: KaruteSdkBundle | null = null;

export function getSdk(): KaruteSdkBundle | null {
  return cached;
}

/**
 * One-shot initializer called by the auth/onboarding flow. Apps with a real
 * OAuth + signal-bootstrap path call this once after sign-in; the SDK then
 * routes every subsequent encryptedWrite/Read through the bound session.
 *
 * PHASE 1 the karute app does not own the onboarding flow yet; this function
 * is exposed so a dev-mode toggle (e.g. `?dev-sdk=1`) can wire it manually
 * during integration testing.
 */
export function initSdk(args: {
  did: string;
  session: SdkSession;
  signalStores: LocalStores;
  resolveRecipientIdentity: RecipientIdentityResolver;
  pdsUrl?: string;
}): KaruteSdkBundle {
  const e = new Etzhayyim({
    did: args.did,
    pdsUrl: args.pdsUrl,
    session: args.session,
  });
  // The encrypted module's class-instance shim looks for these properties.
  // See @etzhayyim/sdk dist/encrypted.d.ts L184-193.
  (e as unknown as { signalStores: LocalStores }).signalStores = args.signalStores;
  (e as unknown as { resolveRecipientIdentity: RecipientIdentityResolver }).resolveRecipientIdentity =
    args.resolveRecipientIdentity;
  cached = { e, signalStores: args.signalStores, resolveRecipientIdentity: args.resolveRecipientIdentity };
  return cached;
}

export function clearSdk() {
  cached = null;
}
