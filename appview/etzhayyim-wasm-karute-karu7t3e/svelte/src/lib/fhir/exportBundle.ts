// FHIR R5 Bundle assembler — runs client-side after encrypted.read decrypts each inner record.
// AT-Lexicon scaled integers (valueScaled / scale) are reconstructed to FHIR decimals here.

import type { PatientRecord, SoapNoteRecord, ObservationRecord, MedicationRequestRecord, ScaledQuantity } from '../api/types';

interface FhirBundleEntry {
  fullUrl: string;
  resource: Record<string, unknown>;
}

interface FhirBundle {
  resourceType: 'Bundle';
  type: 'collection';
  timestamp: string;
  identifier?: { system: string; value: string };
  entry: FhirBundleEntry[];
}

function fromScaled(q: ScaledQuantity | undefined): { value: number; unit: string; system: string; code: string } | undefined {
  if (!q) return undefined;
  return {
    value: q.valueScaled / q.scale,
    unit: q.unit,
    system: 'http://unitsofmeasure.org',
    code: q.unit,
  };
}

export function patientToFhir(rec: PatientRecord, patientDid: string): Record<string, unknown> {
  return {
    resourceType: 'Patient',
    id: patientDid.replace(/[^A-Za-z0-9-]/g, '-'),
    identifier: rec.identifiers,
    name: [
      {
        family: rec.name.family,
        given: rec.name.given,
        use: rec.name.use ?? 'official',
        extension: [
          rec.name.familyKana ? { url: 'http://hl7.org/fhir/StructureDefinition/iso21090-EN-representation', valueCode: 'PHON', valueString: `${rec.name.familyKana} ${rec.name.givenKana ?? ''}`.trim() } : undefined,
        ].filter(Boolean),
      },
    ],
    telecom: rec.telecom,
    gender: rec.gender,
    birthDate: rec.birthDate?.slice(0, 10),
  };
}

export function soapToFhir(rec: SoapNoteRecord, rkey: string): Record<string, unknown> {
  return {
    resourceType: 'Composition',
    id: rkey,
    status: rec.signedAt ? 'final' : 'preliminary',
    type: { coding: [{ system: 'http://loinc.org', code: '11488-4', display: 'Consult note' }] },
    subject: { reference: `Patient/${rec.patientDid}` },
    encounter: { reference: `Encounter/${rec.encounterDid}` },
    date: rec.occurredAt,
    author: [{ reference: rec.authorDid }],
    section: [
      { title: 'Subjective', code: { text: 'SOAP-S' }, text: { status: 'generated', div: `<div>${escapeHtml(rec.subjective)}</div>` } },
      { title: 'Objective', code: { text: 'SOAP-O' }, text: { status: 'generated', div: `<div>${escapeHtml(JSON.stringify(rec.objective))}</div>` } },
      { title: 'Assessment', code: { text: 'SOAP-A' }, entry: rec.assessment.map((a) => ({ display: a.diagnosis, reference: a.icd10 ? `Condition?icd10=${a.icd10}` : undefined })) },
      { title: 'Plan', code: { text: 'SOAP-P' }, text: { status: 'generated', div: `<div>${escapeHtml(JSON.stringify(rec.plan))}</div>` } },
    ],
  };
}

export function observationToFhir(rec: ObservationRecord, rkey: string): Record<string, unknown> {
  return {
    resourceType: 'Observation',
    id: rkey,
    status: rec.status,
    category: rec.category ? [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: rec.category }] }] : undefined,
    code: { coding: [{ system: rec.code.system, code: rec.code.code, display: rec.code.display }] },
    subject: { reference: `Patient/${rec.patientDid}` },
    encounter: rec.encounterDid ? { reference: `Encounter/${rec.encounterDid}` } : undefined,
    effectiveDateTime: rec.occurredAt,
    valueQuantity: fromScaled(rec.valueQuantity),
    valueString: rec.valueString,
    valueCodeableConcept: rec.valueCode ? { coding: [{ code: rec.valueCode }] } : undefined,
    interpretation: rec.interpretation ? [{ coding: [{ code: rec.interpretation }] }] : undefined,
  };
}

export function medicationRequestToFhir(rec: MedicationRequestRecord, rkey: string): Record<string, unknown> {
  return {
    resourceType: 'MedicationRequest',
    id: rkey,
    status: rec.status,
    intent: rec.intent,
    medicationCodeableConcept: {
      coding: [
        rec.medication.rxnorm ? { system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: rec.medication.rxnorm } : undefined,
        rec.medication.yjCode ? { system: 'urn:oid:1.2.392.100495.20.3.21', code: rec.medication.yjCode } : undefined,
      ].filter(Boolean),
      text: rec.medication.display,
    },
    subject: { reference: `Patient/${rec.patientDid}` },
    encounter: rec.encounterDid ? { reference: `Encounter/${rec.encounterDid}` } : undefined,
    authoredOn: rec.authoredOn,
    requester: { reference: rec.prescriberDid },
    dosageInstruction: rec.dosageInstruction?.map((d) => ({
      text: d.text,
      timing: d.timing ? { repeat: { frequency: d.timing.frequency, period: d.timing.periodScaled !== undefined && d.timing.periodScale ? d.timing.periodScaled / d.timing.periodScale : undefined, periodUnit: d.timing.periodUnit } } : undefined,
      route: d.route ? { text: d.route } : undefined,
      doseAndRate: d.doseQuantity ? [{ doseQuantity: fromScaled(d.doseQuantity) }] : undefined,
      asNeededBoolean: d.asNeeded,
    })),
    substitution: rec.substitutionAllowed === undefined ? undefined : { allowedBoolean: rec.substitutionAllowed },
  };
}

export function assembleBundle(entries: Array<{ fullUrl: string; resource: Record<string, unknown> }>): FhirBundle {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: entries,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
