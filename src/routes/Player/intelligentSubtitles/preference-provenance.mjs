// A side-by-side Stremio Enhanced installation cannot assume it inherited
// another application's private subtitle preference. This pure guard performs
// no reads, writes or player actions.
const digest = /^[0-9a-f]{64}$/;
const kinds = new Set(['same-installation-setting', 'explicit-local-choice']);
const surfaces = new Set(['first-run', 'subtitle-settings']);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const exactKeys = (value, keys) => Object.keys(value).sort().join('\0') ===
  [...keys].sort().join('\0');
const text = (value) => typeof value === 'string' && value.trim()
  ? value.trim().toLowerCase().replaceAll('_', '-') : null;
const source = (value) => ['embedded', 'external'].includes(value) ? value : null;

export function preferenceBinding({ sessionPreference, globalLanguage } = {}) {
  return Object.freeze({
    sessionEnabled: own(sessionPreference, 'enabled') && typeof sessionPreference.enabled === 'boolean'
      ? sessionPreference.enabled : null,
    sessionLanguage: text(sessionPreference?.language),
    globalLanguage: text(globalLanguage),
    sessionSource: source(sessionPreference?.source),
  });
}

const sameBinding = (candidate, expected) => candidate && typeof candidate === 'object' &&
  !Array.isArray(candidate) &&
  Object.keys(candidate).length === 4 &&
  candidate.sessionEnabled === expected.sessionEnabled &&
  candidate.sessionLanguage === expected.sessionLanguage &&
  candidate.globalLanguage === expected.globalLanguage &&
  candidate.sessionSource === expected.sessionSource;

export function verifySubtitlePreferenceProvenance({
  sessionPreference, globalLanguage, preferenceProvenance, activeInstallationDigest,
} = {}) {
  const expected = preferenceBinding({ sessionPreference, globalLanguage });
  const evidence = preferenceProvenance;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return false;
  if (evidence.schemaVersion !== 1 || !kinds.has(evidence.kind)) return false;
  const evidenceKeys = evidence.kind === 'explicit-local-choice'
    ? ['schemaVersion', 'kind', 'installationDigest', 'preferenceRevision', 'surface', 'choice', 'binding']
    : ['schemaVersion', 'kind', 'installationDigest', 'preferenceRevision', 'binding'];
  if (!exactKeys(evidence, evidenceKeys)) return false;
  if (!digest.test(activeInstallationDigest || '') ||
      evidence.installationDigest !== activeInstallationDigest) return false;
  if (!Number.isSafeInteger(evidence.preferenceRevision) || evidence.preferenceRevision < 1) return false;
  if (!sameBinding(evidence.binding, expected)) return false;
  if (evidence.kind === 'explicit-local-choice') {
    if (!surfaces.has(evidence.surface) || evidence.choice !== 'enabled') return false;
    if (expected.sessionEnabled !== true) return false;
  } else if (own(evidence, 'surface') || own(evidence, 'choice')) {
    return false;
  }
  return true;
}

export function needsSubtitlePreferenceChoice({
  sessionPreference, globalLanguage, preferenceProvenance, activeInstallationDigest,
} = {}) {
  // Explicit Off is authoritative. An enabled flag without proven origin
  // might be a default or a hydrated value from a separate installation.
  if (sessionPreference?.enabled === false) return false;
  // No automatic track should be chosen when subtitles are disabled already.
  if (sessionPreference?.enabled !== true && globalLanguage == null) return false;
  // A preferred language by itself is not proof that captions were enabled.
  return !verifySubtitlePreferenceProvenance({
    sessionPreference, globalLanguage, preferenceProvenance, activeInstallationDigest,
  });
}


