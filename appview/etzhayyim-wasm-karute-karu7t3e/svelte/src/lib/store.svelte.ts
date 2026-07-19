// Karute app-wide store using Svelte 5 runes.
// NOTE: PHI never lives in this store. Only public-meta projections + locally-decrypted views (held in component-local state, never logged).

import type { PatientMeta, EncounterMeta, MedicationMeta, ObservationMeta, OrderMeta, ChartSummary } from './api/types';

interface Session {
  clinicianDid: string;
  role: 'MD' | 'NP' | 'RN' | 'PHARM' | 'ADMIN' | 'PATIENT';
  facilityDid: string;
  displayName: string;
}

interface NotificationMessage {
  id: string;
  level: 'info' | 'warning' | 'critical';
  text: string;
  at: string;
}

interface KaruteStore {
  session: Session | null;
  patients: PatientMeta[];
  loadingPatients: boolean;
  selectedPatientDid: string | null;
  encounters: EncounterMeta[];
  medications: MedicationMeta[];
  observations: ObservationMeta[];
  orders: OrderMeta[];
  chartSummary: ChartSummary | null;
  notifications: NotificationMessage[];
}

function createStore() {
  let state = $state<KaruteStore>({
    session: {
      clinicianDid: 'did:web:dr-yamada.etzhayyim.com',
      role: 'MD',
      facilityDid: 'did:web:sample-clinic.etzhayyim.com',
      displayName: '山田 太郎 医師',
    },
    patients: [],
    loadingPatients: false,
    selectedPatientDid: null,
    encounters: [],
    medications: [],
    observations: [],
    orders: [],
    chartSummary: null,
    notifications: [],
  });

  return {
    get state() {
      return state;
    },
    setPatients(items: PatientMeta[]) {
      state.patients = items;
    },
    setLoadingPatients(v: boolean) {
      state.loadingPatients = v;
    },
    selectPatient(did: string | null) {
      state.selectedPatientDid = did;
    },
    setEncounters(items: EncounterMeta[]) {
      state.encounters = items;
    },
    setMedications(items: MedicationMeta[]) {
      state.medications = items;
    },
    setObservations(items: ObservationMeta[]) {
      state.observations = items;
    },
    setOrders(items: OrderMeta[]) {
      state.orders = items;
    },
    setChartSummary(s: ChartSummary | null) {
      state.chartSummary = s;
    },
    pushNotification(n: Omit<NotificationMessage, 'id' | 'at'>) {
      state.notifications = [
        ...state.notifications,
        { ...n, id: crypto.randomUUID(), at: new Date().toISOString() },
      ];
    },
    dismissNotification(id: string) {
      state.notifications = state.notifications.filter((n) => n.id !== id);
    },
  };
}

export const store = createStore();
