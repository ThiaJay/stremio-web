#!/usr/bin/env python3
"""Bounded, allowlisted Android instrumentation diagnostics. Never output raw logs."""
from pathlib import Path
import re
import sys

KNOWN_TESTS = (
    'fullAnonymousCorePlayerRouteAcceptsOriginalMedia',
    'pinnedStremioVideoBackendPlaysOriginalMediaWithNightAudio',
    'originalVideoAndPcmDecodeInsideActualEnhancedHost',
    'nativeReloadHomeExitRequireActualRemoteKeys',
    'nativeBackRemainsWithinSafeHostOrExits',
)
FAILURE_MARKERS = {
    'QA start control lost focus': 'QA_HTML_FOCUS',
    'QA remote focus unavailable on retry': 'QA_HTML_RETRY_FOCUS',
    'Anonymous Core cannot encode': 'CORE_NOT_READY',
    'Core route preflight failed': 'CORE_PREFLIGHT',
    'Core route JavaScript callback timed out': 'JS_CALLBACK',
    'Real D-pad did not initiate': 'REMOTE_START',
    'React Player hash route never mounted': 'PLAYER_ROUTE',
    'Actual Core Player model and selected stream not ready': 'PLAYER_MODEL',
    'Real Player HTMLVideo never loaded': 'VIDEO_NOT_FOUND',
    'Core route video has an unrecovered error': 'PLAYER_ERROR',
    'No accessible normal Play control': 'PLAY_CONTROL',
    'Normal Stremio Play control did not start': 'MANUAL_PLAY',
    'Core route failure': 'CORE_ROUTE_FINAL',
    'Original Enhanced React application not mounted': 'REACT_MOUNT',
    'Original Enhanced React not mounted': 'REACT_MOUNT',
    'No tests found': 'TEST_DISCOVERY',
    'FAILURES!!!': 'JUNIT_FAILURES',
    'INSTRUMENTATION_FAILED': 'INSTRUMENTATION_FRAMEWORK',
}
PROBLEMS = (
    'core-unavailable', 'core-state-unavailable', 'not-anonymous',
    'original-media-missing', 'invalid-local-sample',
    'unsafe-blob-origin', 'core-stream-mismatch', 'core-stream-rejected',
    'qa-prepare-error', 'player-video-not-found', 'media-decode',
    'frame-api-unavailable',
)

def diagnose(data):
    if not isinstance(data, str) or len(data) > 5_000_000:
        raise ValueError('Instrumentation source missing or oversized')
    out = ['HOSTQA_DIAGNOSTIC_BEGIN']
    for klass in ('EnhancedHostMediaInstrumentedTest',
                  'EnhancedEngineInstrumentedTest',
                  'EnhancedCoreRouteInstrumentedTest',
                  'EnhancedTvRemoteLifecycleInstrumentedTest'):
        out.append(('HOSTQA_CLASS_OBSERVED_' if klass in data else
                    'HOSTQA_CLASS_NOT_OBSERVED_') + klass)
    for name in KNOWN_TESTS:
        if re.search(r'(?m)^INSTRUMENTATION_STATUS: test=' + re.escape(name) + r'\s*$',data):
            out.append('HOSTQA_TEST_EXECUTED_' + name)
    for count in (1, 2, 3, 4, 5):
        if f'OK ({count} tests)' in data or f'OK ({count} test)' in data:
            out.append('HOSTQA_TEST_COUNT_' + str(count))
    for phrase, label in FAILURE_MARKERS.items():
        if phrase in data:
            out.append('HOSTQA_FAILURE_' + label)
    for problem in PROBLEMS:
        if problem in data:
            out.append('HOSTQA_CORE_REASON_' + problem.replace('-', '_').upper())
    for pattern, label in (
        (r'(?m)^INSTRUMENTATION_STATUS_CODE:\s*(-?\d+)\s*$', 'STATUS_CODE_'),
        (r'(?m)^INSTRUMENTATION_CODE:\s*(-?\d+)\s*$', 'FINAL_CODE_'),
    ):
        values = re.findall(pattern, data)
        for value in sorted(set(values)):
            if value in ('-2', '-1', '0', '1'):
                out.append('HOSTQA_' + label + value.replace('-', 'NEG'))
    if 'java.lang.AssertionError' in data:
        out.append('HOSTQA_ASSERTION_FAILED')
    out.append('HOSTQA_DIAGNOSTIC_END')
    return out

def self_test():
    sample = ('INSTRUMENTATION_STATUS: test=fullAnonymousCorePlayerRouteAcceptsOriginalMedia\n'
              'INSTRUMENTATION_STATUS_CODE: -1\n'
              'INSTRUMENTATION_STATUS: stack=java.lang.AssertionError: '
              'QA start control lost focus; https://secret.invalid/?token=SECRET\n'
              'FAILURES!!!\n')
    output = '\n'.join(diagnose(sample))
    assert 'HOSTQA_TEST_EXECUTED_fullAnonymousCorePlayerRouteAcceptsOriginalMedia' in output
    assert 'HOSTQA_FAILURE_QA_HTML_FOCUS' in output
    assert 'HOSTQA_STATUS_CODE_NEG1' in output
    assert 'HOSTQA_FAILURE_JUNIT_FAILURES' in output
    assert 'secret.invalid' not in output and 'SECRET' not in output
    assert output.startswith('HOSTQA_DIAGNOSTIC_BEGIN')
    print('HOSTQA_DIAGNOSTIC_ALLOWLIST_SELF_TEST_PASS')

if __name__ == '__main__':
    if len(sys.argv) == 2 and sys.argv[1] == '--self-test':
        self_test()
    elif len(sys.argv) == 2:
        path = Path(sys.argv[1])
        if not path.is_file() or path.stat().st_size > 5_000_000:
            raise SystemExit('HOSTQA_DIAGNOSTIC_INPUT_REJECTED')
        source = path.read_text(encoding='utf-8', errors='replace')
        print('\n'.join(diagnose(source)))
    else:
        raise SystemExit('HOSTQA_DIAGNOSTIC_ARGUMENTS_REJECTED')
