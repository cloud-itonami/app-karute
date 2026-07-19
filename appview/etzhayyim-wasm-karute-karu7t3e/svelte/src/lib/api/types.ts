// TypeScript types mirroring the karute XRPC + FHIR R5 inner-type schemas.
// Numeric values use {valueScaled, scale, unit} because AT Lexicon has no float.

export type Severity = 'minor' | 'moderate' | 'major' | 'contraindicated';

export interface ScaledQuantity {
  valueScaled: number;
  scale: 1 | 10 | 100 | 1000;
  unit: string;
}

export interface PatientMeta {
  rkey: string;
  patientDid: string;
  encryptedCid: string;
  registeredAt: string;
  facilityDid?: string;
  publicAlias?: string;
}

export interface EncounterMeta {
  rkey: string;
  encounterDid: string;
  encryptedCid: string;
  occurredAt: string;
  endedAt?: string;
  encounterClass: string;
  department?: string;
  facilityDid?: string;
  attendingDids?: string[];
}

export interface SoapNoteMeta {
  rkey: string;
  encryptedCid: string;
  encounterDid: string;
  authorDid: string;
  occurredAt: string;
  signed: boolean;
}

export interface ObservationMeta {
  rkey: string;
  encryptedCid: string;
  loincCode: string;
  category: string;
  interpretation?: string;
  occurredAt: string;
}

export interface MedicationMeta {
  rkey: string;
  encryptedCid: string;
  encounterDid?: string;
  prescriberDid: string;
  status: string;
  rxnormSummary?: string;
  yjCodeSummary?: string;
  interactionSeverityMax?: Severity | '';
  authoredOn: string;
}

export interface OrderMeta {
  rkey: string;
  encryptedCid: string;
  encounterDid?: string;
  requesterDid: string;
  category: string;
  status: string;
  priority?: string;
  scheduledFor?: string;
}

export interface DispenseMeta {
  rkey: string;
  encryptedCid: string;
  patientDid: string;
  medicationRequestUri: string;
  pharmacyDid: string;
  pharmacistDid: string;
  status: string;
  whenHandedOver: string;
}

export interface ConsentCapabilityMeta {
  capabilityUri: string;
  granterDid: string;
  granteeDid: string;
  scope: string[];
  purpose: 'insurance-billing' | 'second-opinion' | 'data-portability' | 'research-deidentified';
  status: 'active' | 'revoked' | 'expired';
  issuedAt: string;
  expiresAt: string;
  resourceUris?: string[];
}

export interface ChartSummary {
  summary: string;
  stats: {
    encountersTotal: number;
    activeConditions: number;
    activeMedications: number;
    pendingOrders: number;
    interactionFlagsMaxSeverity?: Severity;
  };
  timeline: Array<{
    innerType: string;
    rkey: string;
    encryptedCid: string;
    occurredAt: string;
  }>;
}

// --- Decrypted inner-type shapes (after @etzhayyim/sdk.encryptedRead) ---

export interface PatientRecord {
  fhirResourceType: 'Patient';
  identifiers: Array<{ system: string; value: string; use?: string }>;
  name: { family?: string; given?: string[]; familyKana?: string; givenKana?: string; use?: string };
  telecom?: Array<{ system: string; value: string; use?: string }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  patientDid?: string;
  allergies?: Array<{
    substance: string;
    rxnormCode?: string;
    severity?: 'mild' | 'moderate' | 'severe' | 'life-threatening';
    reaction?: string;
  }>;
  insuranceCoverage?: Array<{
    payerSystem: string;
    subscriberId: string;
    validFrom?: string;
    validTo?: string;
  }>;
  createdAt: string;
}

export interface SoapNoteRecord {
  fhirResourceType: 'Composition';
  compositionType: 'SOAP';
  patientDid: string;
  encounterDid: string;
  authorDid: string;
  subjective: string;
  objective: {
    vitals?: {
      bloodPressureSystolic?: number;
      bloodPressureDiastolic?: number;
      heartRate?: number;
      respiratoryRate?: number;
      temperatureCelsius10?: number;
      spo2Percent?: number;
      weightKg10?: number;
    };
    physicalExam?: string;
  };
  assessment: Array<{
    diagnosis: string;
    icd10?: string;
    snomedCt?: string;
    probabilityPercent?: number;
    rationale?: string;
  }>;
  plan: {
    medicationRequestRefs?: string[];
    serviceRequestRefs?: string[];
    patientEducation?: string;
    followUp?: { intervalDays?: number; modality?: string; department?: string };
  };
  occurredAt: string;
  signedAt?: string;
  createdAt: string;
}

export interface MedicationRequestRecord {
  fhirResourceType: 'MedicationRequest';
  patientDid: string;
  encounterDid?: string;
  prescriberDid: string;
  status: string;
  intent: string;
  medication: {
    rxnorm?: string;
    yjCode?: string;
    display: string;
    form?: string;
    strength?: ScaledQuantity;
  };
  dosageInstruction?: Array<{
    text?: string;
    timing?: { frequency?: number; periodScaled?: number; periodScale?: 1 | 10 | 100; periodUnit?: string };
    route?: string;
    doseQuantity?: ScaledQuantity;
    asNeeded?: boolean;
  }>;
  dispenseRequest?: {
    quantityScaled?: number;
    quantityScale?: 1 | 10 | 100;
    quantityUnit?: string;
    supplyDurationDays?: number;
    refillsAllowed?: number;
  };
  substitutionAllowed?: boolean;
  authoredOn: string;
  interactionFlags?: Array<{
    withMedicationRxnorm?: string;
    severity?: Severity;
    mechanism?: string;
    recommendation?: string;
  }>;
}

export interface ObservationRecord {
  fhirResourceType: 'Observation';
  status: string;
  patientDid: string;
  encounterDid?: string;
  category?: string;
  code: { system?: string; code: string; display?: string };
  valueQuantity?: ScaledQuantity;
  valueCode?: string;
  valueString?: string;
  interpretation?: string;
  referenceRange?: { lowScaled?: number; highScaled?: number; unit?: string; scale?: number };
  occurredAt: string;
}
