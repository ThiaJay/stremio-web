import {
  preferenceBinding,
  snapshotPreferenceDataRecord as dataRecord,
  subtitlePreferenceSnapshot,
  verifySubtitlePreferenceProvenance,
} from './preference-provenance.mjs';

const digest = /^[0-9a-f]{64}$/;
const surfaces = new Set(['first-run', 'subtitle-settings']);
const revision = (value) => Number.isSafeInteger(value) && value > 0;
const bindingKeys = ['sessionEnabled', 'sessionLanguage', 'globalLanguage', 'sessionSource'];
const issueRequestKeys = [
  'activeInstallationDigest', 'preferenceRevision', 'sessionPreference',
  'globalLanguage', 'localChoiceEvent',
];
const promotionRequestKeys = [
  'activeInstallationDigest', 'sessionPreference', 'globalLanguage',
  'storedReceipt', 'storageReadback',
];
const sameBinding = (left, right) => {
  const leftRecord = dataRecord(left, bindingKeys);
  const rightRecord = dataRecord(right, bindingKeys);
  return leftRecord && rightRecord && bindingKeys.every((key) => leftRecord[key] === rightRecord[key]);
};
const freezeReceipt = (receipt) => Object.freeze({
  ...receipt,
  binding: Object.freeze({ ...receipt.binding }),
});

// The caller must invoke this only from the real local control event. This
// function validates and binds that event; it does not infer a choice from
// hydrated account state, a language or an enabled flag.
export function issueExplicitLocalChoiceReceipt(input = {}) {
  const request = dataRecord(input, issueRequestKeys);
  if (!request) return null;
  const {
    activeInstallationDigest, preferenceRevision, sessionPreference,
    globalLanguage, localChoiceEvent,
  } = request;
  const preference = subtitlePreferenceSnapshot(sessionPreference);
  const choiceEvent = dataRecord(localChoiceEvent, [
    'installationDigest', 'preferenceRevision', 'surface', 'choice',
  ]);
  if (typeof activeInstallationDigest !== 'string' || !digest.test(activeInstallationDigest) ||
      !revision(preferenceRevision)) return null;
  if (!preference || !choiceEvent) return null;
  if (choiceEvent.installationDigest !== activeInstallationDigest ||
      choiceEvent.preferenceRevision !== preferenceRevision ||
      !surfaces.has(choiceEvent.surface) || choiceEvent.choice !== 'enabled' ||
      preference.enabled !== true) return null;
  return freezeReceipt({
    schemaVersion: 1,
    kind: 'explicit-local-choice',
    installationDigest: activeInstallationDigest,
    preferenceRevision,
    surface: choiceEvent.surface,
    choice: 'enabled',
    binding: preferenceBinding({ sessionPreference: preference, globalLanguage }),
  });
}

// Promotion proves only that the exact accepted receipt was read back from
// installation-local storage. It does not prove UI or device acceptance.
export function promoteStoredPreferenceReceipt(input = {}) {
  const request = dataRecord(input, promotionRequestKeys);
  if (!request) return null;
  const {
    activeInstallationDigest, sessionPreference, globalLanguage,
    storedReceipt, storageReadback,
  } = request;
  const preference = subtitlePreferenceSnapshot(sessionPreference);
  let storedOwnKeys = [];
  try {
    storedOwnKeys = storedReceipt && typeof storedReceipt === 'object'
      ? Reflect.ownKeys(Object.getOwnPropertyDescriptors(storedReceipt))
        .filter((key) => typeof key === 'string')
      : [];
  } catch {
    return null;
  }
  const storedKindRecord = dataRecord(storedReceipt, storedOwnKeys);
  if (!preference || !storedKindRecord) return null;
  const storedKeys = storedKindRecord.kind === 'explicit-local-choice'
    ? ['schemaVersion', 'kind', 'installationDigest', 'preferenceRevision', 'surface', 'choice', 'binding']
    : ['schemaVersion', 'kind', 'installationDigest', 'preferenceRevision', 'binding'];
  const stored = dataRecord(storedReceipt, storedKeys);
  const readback = dataRecord(storageReadback, [
    'scope', 'installationDigest', 'preferenceRevision', 'binding',
  ]);
  if (!stored || !readback) return null;
  if (!verifySubtitlePreferenceProvenance({
    activeInstallationDigest, sessionPreference: preference, globalLanguage,
    preferenceRevision: stored.preferenceRevision,
    preferenceProvenance: stored,
  })) return null;
  if (readback.scope !== 'installation-local' ||
      readback.installationDigest !== activeInstallationDigest ||
      readback.preferenceRevision !== stored.preferenceRevision ||
      !sameBinding(readback.binding, stored.binding)) return null;
  return freezeReceipt({
    schemaVersion: 1,
    kind: 'same-installation-setting',
    installationDigest: activeInstallationDigest,
    preferenceRevision: stored.preferenceRevision,
    binding: stored.binding,
  });
}
