import { useCallback, useState } from "react";

const CONSENT_KEY = "fleet-geo-consent-v1";

interface ConsentRecord {
  granted: boolean;
  date: string;
}

function read(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as ConsentRecord) : null;
  } catch {
    return null;
  }
}

/** Consentement RGPD à la géolocalisation, persistant et révocable. */
export function useGeoConsent() {
  const [record, setRecord] = useState<ConsentRecord | null>(read);

  const grant = useCallback(() => {
    const r = { granted: true, date: new Date().toISOString() };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(r));
    setRecord(r);
  }, []);

  const revoke = useCallback(() => {
    localStorage.removeItem(CONSENT_KEY);
    setRecord(null);
  }, []);

  return { granted: record?.granted ?? false, since: record?.date ?? null, grant, revoke };
}
