// XRPC client for karute. PHI flows through `@etzhayyim/sdk.encryptedWrite`
// before any wire serialization — public meta + the encrypted CID are the
// only things this client posts to the karute backend.
//
// `getSdk()` returns null when the parent app has not yet completed the
// OAuth + libsignal-bootstrap onboarding (Phase 1 reality). In that mode
// the create* helpers route to a deterministic mock encryption that lets
// the UI flow be exercised end-to-end without a live PDS.

import type {
  PatientMeta, EncounterMeta, SoapNoteMeta, ObservationMeta,
  MedicationMeta, OrderMeta, ChartSummary, Severity, DispenseMeta,
} from './types';
import { getSdk } from './sdk-init';

const API_BASE = (() => {
  if (typeof window === 'undefined') return '';
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5174';
  }
  return 'https://karu7t3e.etzhayyim.com';
})();

interface XrpcQueryParams { [k: string]: string | number | undefined; }

async function xrpcQuery<T>(nsid: string, params: XrpcQueryParams = {}): Promise<T> {
  const url = new URL(`${API_BASE}/xrpc/${nsid}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const r = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`XRPC ${nsid} failed: ${r.status}`);
  return r.json() as Promise<T>;
}

async function xrpcProcedure<T>(nsid: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}/xrpc/${nsid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`XRPC ${nsid} failed: ${r.status}`);
  return r.json() as Promise<T>;
}

// ----- Encryption seam — real SDK when available, deterministic mock otherwise -----

interface EncryptedWriteArgs<R extends Record<string, unknown>> {
  innerType: string;
  record: R;
  recipientDids: string[];
}

interface EncryptedWriteResult {
  uri: string;
  cid: string;
  keyId: string;
  keyWraps: Array<{ recipient: string; uri: string; cid: string }>;
  skipped: Array<{ recipient: string; reason: string }>;
}

async function encryptedWrite<R extends Record<string, unknown>>(
  args: EncryptedWriteArgs<R>,
): Promise<EncryptedWriteResult> {
  const sdk = getSdk();
  if (sdk) {
    const receipt = await sdk.e.encryptedWrite({
      collection: 'com.etzhayyim.encrypted.record',
      innerType: args.innerType,
      record: args.record,
      recipients: args.recipientDids,
      wrapToSelf: true,
    });
    return {
      uri: receipt.uri,
      cid: receipt.cid,
      keyId: receipt.keyId,
      keyWraps: receipt.keyWraps,
      skipped: receipt.skipped,
    };
  }

  // Mock fallback — UI development without a live PDS / libsignal session.
  // Cryptographically meaningless; only the structural surface matches.
  const cid = `bafy-mock-${crypto.randomUUID().slice(0, 16)}`;
  const keyId = `kw-${crypto.randomUUID().slice(0, 12)}`;
  return {
    uri: `at://did:web:karute.etzhayyim.com/com.etzhayyim.encrypted.record/${crypto.randomUUID().slice(0, 13)}`,
    cid,
    keyId,
    keyWraps: args.recipientDids.map((r) => ({
      recipient: r,
      uri: `at://did:web:karute.etzhayyim.com/com.etzhayyim.encrypted.keyWrap/${crypto.randomUUID().slice(0, 13)}`,
      cid: `bafy-mock-kw-${crypto.randomUUID().slice(0, 12)}`,
    })),
    skipped: [],
  };
}

// ----- Queries (public meta only) -----

export async function listPatients(opts: { limit?: number; offset?: number; q?: string } = {}) {
  return xrpcQuery<{ items: PatientMeta[]; total: number; offset: number; limit: number }>(
    'com.etzhayyim.apps.karute.listPatients',
    opts as XrpcQueryParams,
  );
}

export async function listEncounters(patientDid: string, opts: { limit?: number; offset?: number; fromDate?: string; toDate?: string } = {}) {
  return xrpcQuery<{ items: EncounterMeta[]; offset: number; limit: number }>(
    'com.etzhayyim.apps.karute.listEncounters',
    { patientDid, ...opts } as XrpcQueryParams,
  );
}

export async function listSoapNotes(patientDid: string, opts: { encounterDid?: string; limit?: number } = {}) {
  return xrpcQuery<{ items: SoapNoteMeta[]; offset: number; limit: number }>(
    'com.etzhayyim.apps.karute.listSoapNotes',
    { patientDid, ...opts } as XrpcQueryParams,
  );
}

export async function listObservations(patientDid: string, opts: { category?: string; loincCode?: string; limit?: number } = {}) {
  return xrpcQuery<{ items: ObservationMeta[]; offset: number; limit: number }>(
    'com.etzhayyim.apps.karute.listObservations',
    { patientDid, ...opts } as XrpcQueryParams,
  );
}

export async function listMedications(patientDid: string, opts: { status?: string; limit?: number } = {}) {
  return xrpcQuery<{ items: MedicationMeta[]; offset: number; limit: number }>(
    'com.etzhayyim.apps.karute.listMedications',
    { patientDid, ...opts } as XrpcQueryParams,
  );
}

export async function listOrders(patientDid: string, opts: { status?: string; category?: string; limit?: number } = {}) {
  return xrpcQuery<{ items: OrderMeta[]; offset: number; limit: number }>(
    'com.etzhayyim.apps.karute.listOrders',
    { patientDid, ...opts } as XrpcQueryParams,
  );
}

export async function listDispenses(opts: { patientDid?: string; pharmacyDid?: string; status?: string; limit?: number } = {}) {
  return xrpcQuery<{ items: DispenseMeta[]; offset: number; limit: number }>(
    'com.etzhayyim.apps.karute.listDispenses',
    opts as XrpcQueryParams,
  );
}

export async function getChartSummary(patientDid: string, limit = 100) {
  return xrpcQuery<ChartSummary>('com.etzhayyim.apps.karute.getChartSummary', { patientDid, limit });
}

// ----- Procedures (write through encryption seam) -----

interface CreatePatientArgs {
  record: Record<string, unknown>;
  recipientDids: string[];
  publicMeta: { patientDid: string; registeredAt: string; facilityDid?: string };
}

export async function createPatient(args: CreatePatientArgs) {
  const enc = await encryptedWrite({
    innerType: 'com.etzhayyim.karute.patient',
    record: args.record,
    recipientDids: args.recipientDids,
  });
  return xrpcProcedure<{ rkey: string; encryptedCid: string; patientDid: string }>(
    'com.etzhayyim.apps.karute.createPatient',
    {
      envelopeUri: enc.uri,
      encryptedCid: enc.cid,
      keyId: enc.keyId,
      keyWraps: enc.keyWraps,
      skipped: enc.skipped,
      recipientDids: args.recipientDids,
      publicMeta: args.publicMeta,
    },
  );
}

interface CreateSoapArgs {
  record: Record<string, unknown>;
  recipientDids: string[];
  publicMeta: {
    patientDid: string; encounterDid: string; authorDid: string;
    occurredAt: string; signed?: boolean;
  };
}

export async function createSoapNote(args: CreateSoapArgs) {
  const enc = await encryptedWrite({
    innerType: 'com.etzhayyim.karute.soapNote',
    record: args.record,
    recipientDids: args.recipientDids,
  });
  return xrpcProcedure<{ rkey: string; encryptedCid: string }>(
    'com.etzhayyim.apps.karute.createSoapNote',
    { envelopeUri: enc.uri, encryptedCid: enc.cid, keyId: enc.keyId, keyWraps: enc.keyWraps,
      skipped: enc.skipped, recipientDids: args.recipientDids, publicMeta: args.publicMeta },
  );
}

interface CreateObsArgs {
  record: Record<string, unknown>;
  recipientDids: string[];
  publicMeta: {
    patientDid: string; encounterDid?: string; loincCode: string;
    category?: string; interpretation?: string; occurredAt: string;
  };
}

export async function createObservation(args: CreateObsArgs) {
  const enc = await encryptedWrite({
    innerType: 'com.etzhayyim.karute.observation',
    record: args.record,
    recipientDids: args.recipientDids,
  });
  return xrpcProcedure<{ rkey: string; encryptedCid: string }>(
    'com.etzhayyim.apps.karute.createObservation',
    { envelopeUri: enc.uri, encryptedCid: enc.cid, keyId: enc.keyId, keyWraps: enc.keyWraps,
      skipped: enc.skipped, recipientDids: args.recipientDids, publicMeta: args.publicMeta },
  );
}

interface CreateRxArgs {
  record: Record<string, unknown>;
  recipientDids: string[];
  publicMeta: {
    patientDid: string; encounterDid?: string; prescriberDid: string;
    status: string; rxnormSummary?: string; yjCodeSummary?: string; authoredOn: string;
  };
  overrideInteractionBlock?: boolean;
  overrideReason?: string;
}

export async function createMedicationRequest(args: CreateRxArgs) {
  const enc = await encryptedWrite({
    innerType: 'com.etzhayyim.karute.medicationRequest',
    record: args.record,
    recipientDids: args.recipientDids,
  });
  return xrpcProcedure<{
    rkey: string;
    encryptedCid: string;
    interactionFlags?: Array<{ severity: Severity; mechanism: string; recommendation: string }>;
    blocked?: boolean;
  }>('com.etzhayyim.apps.karute.createMedicationRequest', {
    envelopeUri: enc.uri, encryptedCid: enc.cid, keyId: enc.keyId, keyWraps: enc.keyWraps,
    skipped: enc.skipped, recipientDids: args.recipientDids, publicMeta: args.publicMeta,
    overrideInteractionBlock: args.overrideInteractionBlock,
    overrideReason: args.overrideReason,
  });
}

interface CreateOrderArgs {
  record: Record<string, unknown>;
  recipientDids: string[];
  publicMeta: {
    patientDid: string; encounterDid?: string; requesterDid: string;
    category: string; status: string; priority?: string; scheduledFor?: string;
  };
}

export async function createServiceRequest(args: CreateOrderArgs) {
  const enc = await encryptedWrite({
    innerType: 'com.etzhayyim.karute.serviceRequest',
    record: args.record,
    recipientDids: args.recipientDids,
  });
  return xrpcProcedure<{ rkey: string; encryptedCid: string }>(
    'com.etzhayyim.apps.karute.createServiceRequest',
    { envelopeUri: enc.uri, encryptedCid: enc.cid, keyId: enc.keyId, keyWraps: enc.keyWraps,
      skipped: enc.skipped, recipientDids: args.recipientDids, publicMeta: args.publicMeta },
  );
}

interface CreateDispenseArgs {
  record: Record<string, unknown>;
  recipientDids: string[];
  publicMeta: {
    patientDid: string;
    medicationRequestUri: string;
    pharmacyDid: string;
    pharmacistDid: string;
    status: string;
    whenHandedOver: string;
  };
}

export async function createDispense(args: CreateDispenseArgs) {
  const enc = await encryptedWrite({
    innerType: 'com.etzhayyim.karute.dispenseRecord',
    record: args.record,
    recipientDids: args.recipientDids,
  });
  return xrpcProcedure<{ rkey: string; encryptedCid: string }>(
    'com.etzhayyim.apps.karute.createDispense',
    { envelopeUri: enc.uri, encryptedCid: enc.cid, keyId: enc.keyId, keyWraps: enc.keyWraps,
      skipped: enc.skipped, recipientDids: args.recipientDids, publicMeta: args.publicMeta },
  );
}

// ----- Patient-portal helpers (role=PATIENT branch) -----

interface RequestIryoBillingArgs {
  patientDid: string;
  encounterDid: string;
  facilityDid: string;
  consentCapabilityUri: string;
}

export async function requestIryoBilling(args: RequestIryoBillingArgs) {
  return xrpcProcedure<{ ack: boolean; iryoClaimRef?: string; error?: string }>(
    'com.etzhayyim.apps.karute.requestIryoBilling',
    args,
  );
}

interface GrantConsentArgs {
  granterDid: string;
  granteeDid: string;
  scope: string[];
  expiresAt: string;
  purpose: 'insurance-billing' | 'second-opinion' | 'data-portability' | 'research-deidentified';
  resourceUris?: string[];
}

export async function grantConsent(args: GrantConsentArgs) {
  // The consent record lives in the granter's PDS as an encrypted capability
  // (the grantee + the verifier hold read-caps). karute exposes a thin
  // procedure wrapper that takes the cleartext params and lets the actor
  // pipeline build + sign the capability via @etzhayyim/sdk on the server.
  return xrpcProcedure<{ capabilityUri: string; capabilityCid: string }>(
    'com.etzhayyim.apps.karute.grantConsent',
    args,
  );
}
