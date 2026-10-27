import {
  preferenceBinding,
  verifySubtitlePreferenceProvenance,
} from './preference-provenance.mjs';

const digest = /^[0-9a-f]{64}$/;
const surfaces = new Set(['first-run', 'subtitle-settings']);
const exactKeys = (value, keys) => value && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
const revision = (value) => Number.isSafeInteger(value) && value > 0;
const bindingKeys = ['sessionEnabled', 'sessionLanguage', 'globalLanguage', 'sessionSource'];
const sameBinding = (left, right) => exactKeys(left, bindingKeys) && exactKeys(right, bindingKeys) &&
  bindingKeys.every((key) => left[key] === right[key]);
const freezeReceipt = (receipt) => Object.freeze({
  ...receipt,
  binding: Object.freeze({ ...receipt.binding }),
});

// The caller must invoke this only from the real local control event. This
// function validates and binds that event; it does not infer a choice from
// hydrated account state, a language or an enabled flag.
export function issueExplicitLocalChoiceReceipt({
  activeInstallationDigest, preferenceRevision, sessionPreference,
  globalLanguage, localChoiceEvent,
} = {}) {
  if (!digest.test(activeInstallationDigest || '') || !revision(preferenceRevision)) return null;
  if (!exactKeys(localChoiceEvent, [
    'installationDigest', 'preferenceRevision', 'surface', 'choice',
  ])) return null;
  if (localChoiceEvent.installationDigest !== activeInstallationDigest ||
      localChoiceEvent.preferenceRevision !== preferenceRevision ||
      !surfaces.has(localChoiceEvent.surface) || localChoiceEvent.choice !== 'enabled' ||
      sessionPreference?.enabled !== true) return null;
  return freezeReceipt({
    schemaVersion: 1,
    kind: 'explicit-local-choice',
    installationDigest: activeInstallationDigest,
    preferenceRevision,
    surface: localChoiceEvent.surface,
    choice: 'enabled',
    binding: preferenceBinding({ sessionPreference, globalLanguage }),
  });
}

// Promotion proves only that the exact accepted receipt was read back from
// installation-local storage. It does not prove UI or device acceptance.
export function promoteStoredPreferenceReceipt({
  activeInstallationDigest, sessionPreference, globalLanguage,
  storedReceipt, storageReadback,
} = {}) {
  const storedKeys = storedReceipt?.kind === 'explicit-local-choice'
    ? ['schemaVersion', 'kind', 'installationDigest', 'preferenceRevision', 'surface', 'choice', 'binding']
    : ['schemaVersion', 'kind', 'installationDigest', 'preferenceRevision', 'binding'];
  if (!exactKeys(storedReceipt, storedKeys)) return null;
  if (!verifySubtitlePreferenceProvenance({
    activeInstallationDigest, sessionPreference, globalLanguage,
    preferenceProvenance: storedReceipt,
  })) return null;
  if (!exactKeys(storageReadback, [
    'scope', 'installationDigest', 'preferenceRevision', 'binding',
  ])) return null;
  if (storageReadback.scope !== 'installation-local' ||
      storageReadback.installationDigest !== activeInstallationDigest ||
      storageReadback.preferenceRevision !== storedReceipt.preferenceRevision ||
      !sameBinding(storageReadback.binding, storedReceipt.binding)) return null;
  return freezeReceipt({
    schemaVersion: 1,
    kind: 'same-installation-setting',
    installationDigest: activeInstallationDigest,
    preferenceRevision: storedReceipt.preferenceRevision,
    binding: storedReceipt.binding,
  });
}
