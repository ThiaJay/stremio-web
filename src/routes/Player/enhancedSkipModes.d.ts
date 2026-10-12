export type EnhancedSkipKind = 'intro' | 'recap' | 'outro';
export type EnhancedSkipMode = 'inherit' | 'ask' | 'always' | 'never';
export type EnhancedSkipState = { schema: 1, intro: EnhancedSkipMode, recap: EnhancedSkipMode, outro: EnhancedSkipMode };
export const STORAGE_KEY: string;
export const KINDS: readonly EnhancedSkipKind[];
export const MODES: readonly EnhancedSkipMode[];
export function defaultState(): EnhancedSkipState;
export function normaliseState(value: unknown): EnhancedSkipState | null;
export function readState(storage: Storage | null): EnhancedSkipState;
export function updateMode(current: EnhancedSkipState, kind: EnhancedSkipKind, mode: EnhancedSkipMode): EnhancedSkipState;
export function writeState(storage: Storage | null, state: EnhancedSkipState): boolean;
export function resolveMode(input: {
    segment?: { kind: string, mode: string } | null,
    inheritedMode: string,
    overrides: EnhancedSkipState,
}): 'ask' | 'always' | 'never';
