// e2e-style tests for the karute XRPC client.
// Strategy: stub global fetch; assert that the encryption seam (mock path,
// because @etzhayyim/sdk is workspace-only) produces the expected envelope
// shape and that the procedure body forwards public meta correctly.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createSoapNote,
  createMedicationRequest,
  createObservation,
  createDispense,
  grantConsent,
  listPatients,
  listSoapNotes,
} from '../src/lib/api/karute-client';

interface CapturedCall { url: string; init: RequestInit | undefined; bodyJson?: unknown; }

let captured: CapturedCall[] = [];
let nextResponse: { ok: boolean; status?: number; body: unknown } = { ok: true, body: {} };

beforeEach(() => {
  captured = [];
  nextResponse = { ok: true, body: {} };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      let bodyJson: unknown = undefined;
      if (init?.body && typeof init.body === 'string') {
        try { bodyJson = JSON.parse(init.body); } catch { /* ignore */ }
      }
      captured.push({ url, init, bodyJson });
      return {
        ok: nextResponse.ok,
        status: nextResponse.status ?? 200,
        json: async () => nextResponse.body,
      } as unknown as Response;
    }) as unknown as typeof fetch,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSoapNote', () => {
  it('encrypts via the seam and posts envelope + public meta', async () => {
    nextResponse = { ok: true, body: { rkey: '3lzw1', encryptedCid: 'bafy-x' } };
    const occurredAt = '2026-05-23T10:00:00Z';
    await createSoapNote({
      record: {
        fhirResourceType: 'Composition',
        compositionType: 'SOAP',
        patientDid: 'did:plc:p',
        encounterDid: 'enc1',
        authorDid: 'did:web:dr.example',
        subjective: 'PHI text',
        objective: {},
        assessment: [],
        plan: {},
        occurredAt,
        createdAt: occurredAt,
      } as unknown as Record<string, unknown>,
      recipientDids: ['did:plc:p', 'did:web:dr.example'],
      publicMeta: {
        patientDid: 'did:plc:p',
        encounterDid: 'enc1',
        authorDid: 'did:web:dr.example',
        occurredAt,
        signed: false,
      },
    });
    expect(captured.length).toBe(1);
    expect(captured[0].url).toMatch(/com\.etzhayyim\.apps\.karute\.createSoapNote$/);

    const body = captured[0].bodyJson as { encryptedCid: string; publicMeta: { patientDid: string }; keyId: string; keyWraps: Array<{ recipient: string }> };
    // Mock encryption produced a CID and a keyId.
    expect(body.encryptedCid).toMatch(/^bafy-mock-/);
    expect(body.keyId).toMatch(/^kw-/);
    // KeyWraps are produced for every recipient.
    expect(body.keyWraps.length).toBe(2);
    expect(body.keyWraps.map((k) => k.recipient).sort()).toEqual(['did:plc:p', 'did:web:dr.example']);
    // Public meta is forwarded as-is — no PHI fields included.
    expect(body.publicMeta.patientDid).toBe('did:plc:p');
    expect((body.publicMeta as unknown as { subjective?: string }).subjective).toBeUndefined();
  });
});

describe('createMedicationRequest', () => {
  it('forwards overrideInteractionBlock + reason on contraindication override', async () => {
    nextResponse = { ok: true, body: { rkey: 'rx-x', encryptedCid: 'bafy-rx', interactionFlags: [], blocked: false } };
    await createMedicationRequest({
      record: { fhirResourceType: 'MedicationRequest' } as unknown as Record<string, unknown>,
      recipientDids: ['did:plc:p', 'did:web:dr.example'],
      publicMeta: {
        patientDid: 'did:plc:p',
        prescriberDid: 'did:web:dr.example',
        status: 'active',
        rxnormSummary: '197361',
        authoredOn: '2026-05-23T10:00:00Z',
      },
      overrideInteractionBlock: true,
      overrideReason: 'Patient declined alternative (documented in SOAP).',
    });
    const body = captured[0].bodyJson as { overrideInteractionBlock: boolean; overrideReason: string };
    expect(body.overrideInteractionBlock).toBe(true);
    expect(body.overrideReason).toMatch(/Patient declined alternative/);
  });
});

describe('createObservation', () => {
  it('public meta carries the LOINC code but no value', async () => {
    nextResponse = { ok: true, body: { rkey: 'obs1', encryptedCid: 'bafy-obs' } };
    await createObservation({
      record: {
        fhirResourceType: 'Observation',
        status: 'final',
        patientDid: 'did:plc:p',
        category: 'vital-signs',
        code: { system: 'http://loinc.org', code: '8480-6' },
        valueQuantity: { valueScaled: 162, scale: 1, unit: 'mm[Hg]' },
        occurredAt: '2026-05-23T10:00:00Z',
      } as unknown as Record<string, unknown>,
      recipientDids: ['did:plc:p', 'did:web:dr.example'],
      publicMeta: {
        patientDid: 'did:plc:p',
        loincCode: '8480-6',
        category: 'vital-signs',
        interpretation: 'high',
        occurredAt: '2026-05-23T10:00:00Z',
      },
    });
    const body = captured[0].bodyJson as { publicMeta: { loincCode: string; valueQuantity?: unknown; interpretation: string } };
    expect(body.publicMeta.loincCode).toBe('8480-6');
    expect(body.publicMeta.interpretation).toBe('high');
    // valueQuantity (the actual reading) MUST stay inside ciphertext.
    expect(body.publicMeta.valueQuantity).toBeUndefined();
  });
});

describe('createDispense', () => {
  it('points to the source MedicationRequest URI in public meta', async () => {
    nextResponse = { ok: true, body: { rkey: 'd1', encryptedCid: 'bafy-d1' } };
    await createDispense({
      record: { fhirResourceType: 'MedicationDispense' } as unknown as Record<string, unknown>,
      recipientDids: ['did:web:dr.example', 'did:web:ph-suzuki.etzhayyim.com'],
      publicMeta: {
        patientDid: 'did:plc:p',
        medicationRequestUri: 'at://did:plc:p/com.etzhayyim.encrypted.record/rx-x',
        pharmacyDid: 'did:web:pharmacy.etzhayyim.com',
        pharmacistDid: 'did:web:ph-suzuki.etzhayyim.com',
        status: 'completed',
        whenHandedOver: '2026-05-23T11:00:00Z',
      },
    });
    const body = captured[0].bodyJson as { publicMeta: { medicationRequestUri: string; pharmacistDid: string } };
    expect(body.publicMeta.medicationRequestUri).toMatch(/^at:\/\//);
    expect(body.publicMeta.pharmacistDid).toBe('did:web:ph-suzuki.etzhayyim.com');
  });
});

describe('grantConsent', () => {
  it('forwards cleartext fields to the server (signature happens server-side)', async () => {
    nextResponse = { ok: true, body: { capabilityUri: 'at://cap', capabilityCid: 'bafy-cap' } };
    await grantConsent({
      granterDid: 'did:plc:p',
      granteeDid: 'did:web:iryo.etzhayyim.com',
      scope: ['com.etzhayyim.karute.encounter', 'com.etzhayyim.karute.serviceRequest'],
      expiresAt: '2026-08-23T00:00:00Z',
      purpose: 'insurance-billing',
    });
    const body = captured[0].bodyJson as { purpose: string; granteeDid: string; scope: string[] };
    expect(body.purpose).toBe('insurance-billing');
    expect(body.granteeDid).toBe('did:web:iryo.etzhayyim.com');
    expect(body.scope).toContain('com.etzhayyim.karute.encounter');
  });
});

describe('list queries', () => {
  it('listPatients composes the query string', async () => {
    nextResponse = { ok: true, body: { items: [], total: 0, offset: 0, limit: 50 } };
    await listPatients({ limit: 25, q: 'tanaka' });
    expect(captured[0].url).toMatch(/limit=25/);
    expect(captured[0].url).toMatch(/q=tanaka/);
  });

  it('listSoapNotes includes patientDid + encounterDid filters', async () => {
    nextResponse = { ok: true, body: { items: [], offset: 0, limit: 50 } };
    await listSoapNotes('did:plc:p', { encounterDid: 'enc1', limit: 10 });
    expect(captured[0].url).toMatch(/patientDid=did%3Aplc%3Ap/);
    expect(captured[0].url).toMatch(/encounterDid=enc1/);
  });
});
