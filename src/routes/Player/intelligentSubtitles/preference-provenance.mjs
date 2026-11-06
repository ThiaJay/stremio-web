// A side-by-side Stremio Enhanced installation cannot assume it inherited
// another application's private subtitle preference. This pure guard performs
// no reads, writes or player actions.
const digest = /^[0-9a-f]{64}$/;
const kinds = new Set(['same-installation-setting', 'explicit-local-choice']);
const surfaces = new Set(['first-run', 'subtitle-settings']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const preferenceKeys = ['enabled', 'language', 'source'];
const evidenceKeys = [
  'schemaVersion', 'kind', 'installationDigest', 'preferenceRevision',
  'surface', 'choice', 'binding',
];
const bindingKeys = ['sessionEnabled', 'sessionLanguage', 'globalLanguage', 'sessionSource'];
const provenanceRequestKeys = [
  'sessionPreference', 'globalLanguage', 'preferenceProvenance', 'activeInstallationDigest',
];

const closedPlainDataClone = (value) => {
  try {
    if (typeof globalThis.structuredClone !== 'function') return null;
    const visited = new Set();
    const inspect = (candidate) => {
      if (candidate == null || ['string', 'number', 'boolean', 'undefined'].includes(typeof candidate)) {
        return true;
      }
      if (typeof candidate !== 'object' || Array.isArray(candidate)) return false;
      if (visited.has(candidate)) return true;
      visited.add(candidate);
      const prototype = Object.getPrototypeOf(candidate);
      if (prototype !== Object.prototype && prototype !== null) return false;
      const descriptors = Object.getOwnPropertyDescriptors(candidate);
      const keys = Reflect.ownKeys(descriptors);
      return keys.every((key) => typeof key === 'string' &&
        descriptors[key].enumerable && own(descriptors[key], 'value') &&
        inspect(descriptors[key].value));
    };
    if (!inspect(value)) return null;
    // Structured clone rejects Proxy values even when their reflection traps
    // impersonate a plain record. The descriptor walk above rejects accessors
    // throughout the graph before cloning can evaluate them.
    return globalThis.structuredClone(value);
  } catch {
    return null;
  }
};

export const snapshotPreferenceDataRecord = (
  value,
  allowedKeys = undefined,
  requiredKeys = undefined,
) => {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const detached = closedPlainDataClone(value);
    if (!detached) return null;
    const prototype = Object.getPrototypeOf(detached);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(detached);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some((key) => typeof key !== 'string' ||
        (allowedKeys && !allowedKeys.includes(key)) ||
        !descriptors[key].enumerable || !own(descriptors[key], 'value'))) return null;
    if (requiredKeys && (keys.length !== requiredKeys.length ||
        requiredKeys.some((key) => !keys.includes(key)))) return null;
    return Object.freeze(Object.fromEntries(keys.map((key) => [key, descriptors[key].value])));
  } catch {
    return null;
  }
};
const dataRecord = snapshotPreferenceDataRecord;
const text = (value) => typeof value === 'string' && value.trim()
  ? value.trim().toLowerCase().replaceAll('_', '-') : null;
const source = (value) => ['embedded', 'external'].includes(value) ? value : null;

export function subtitlePreferenceSnapshot(value) {
  if (value == null) return Object.freeze({});
  const preference = dataRecord(value, preferenceKeys);
  if (!preference) return null;
  if (own(preference, 'enabled') && preference.enabled !== null &&
      typeof preference.enabled !== 'boolean') return null;
  if (own(preference, 'language') && preference.language !== null &&
      text(preference.language) == null) return null;
  if (own(preference, 'source') && preference.source !== null &&
      source(preference.source) == null) return null;
  return preference;
}

const bindingFromPreference = (sessionPreference, globalLanguage) => Object.freeze({
  sessionEnabled: own(sessionPreference, 'enabled') ? sessionPreference.enabled : null,
  sessionLanguage: text(sessionPreference.language),
  globalLanguage: text(globalLanguage),
  sessionSource: source(sessionPreference.source),
});

export function preferenceBinding(input = {}) {
  const request = dataRecord(input);
  if (!request) return bindingFromPreference(Object.freeze({}), null);
  const { sessionPreference, globalLanguage } = request;
  const preference = subtitlePreferenceSnapshot(sessionPreference);
  return bindingFromPreference(preference || Object.freeze({}), globalLanguage);
}

const sameBinding = (candidate, expected) => {
  const snapshot = dataRecord(candidate, bindingKeys, bindingKeys);
  return snapshot && bindingKeys.every((key) => snapshot[key] === expected[key]);
};

export function verifySubtitlePreferenceProvenance(input = {}) {
  const request = dataRecord(input, provenanceRequestKeys);
  if (!request) return false;
  const {
    sessionPreference, globalLanguage, preferenceProvenance, activeInstallationDigest,
  } = request;
  const preference = subtitlePreferenceSnapshot(sessionPreference);
  if (!preference) return false;
  const expected = bindingFromPreference(preference, globalLanguage);
  // A language-only or partially hydrated preference is not proof that the
  // user enabled automatic subtitles, even when an otherwise valid local
  // receipt binds that incomplete state.
  if (expected.sessionEnabled !== true) return false;
  const evidence = dataRecord(preferenceProvenance, evidenceKeys);
  if (!evidence) return false;
  if (evidence.schemaVersion !== 1 || !kinds.has(evidence.kind)) return false;
  const requiredEvidenceKeys = evidence.kind === 'explicit-local-choice'
    ? ['schemaVersion', 'kind', 'installationDigest', 'preferenceRevision', 'surface', 'choice', 'binding']
    : ['schemaVersion', 'kind', 'installationDigest', 'preferenceRevision', 'binding'];
  if (Reflect.ownKeys(evidence).length !== requiredEvidenceKeys.length ||
      requiredEvidenceKeys.some((key) => !own(evidence, key))) return false;
  if (typeof activeInstallationDigest !== 'string' || !digest.test(activeInstallationDigest) ||
      evidence.installationDigest !== activeInstallationDigest) return false;
  if (!Number.isSafeInteger(evidence.preferenceRevision) || evidence.preferenceRevision < 1) return false;
  if (!sameBinding(evidence.binding, expected)) return false;
  if (evidence.kind === 'explicit-local-choice') {
    if (!surfaces.has(evidence.surface) || evidence.choice !== 'enabled') return false;
  } else if (own(evidence, 'surface') || own(evidence, 'choice')) {
    return false;
  }
  return true;
}

export function needsSubtitlePreferenceChoice(input = {}) {
  const request = dataRecord(input, provenanceRequestKeys);
  if (!request) return true;
  const {
    sessionPreference, globalLanguage, preferenceProvenance, activeInstallationDigest,
  } = request;
  const preference = subtitlePreferenceSnapshot(sessionPreference);
  if (!preference) return globalLanguage != null;
  // Explicit Off is authoritative. An enabled flag without proven origin
  // might be a default or a hydrated value from a separate installation.
  if (preference.enabled === false) return false;
  // No automatic track should be chosen when subtitles are disabled already.
  if (preference.enabled !== true && globalLanguage == null) return false;
  // A preferred language by itself is not proof that captions were enabled.
  return !verifySubtitlePreferenceProvenance({
    sessionPreference: preference, globalLanguage, preferenceProvenance, activeInstallationDigest,
  });
}

