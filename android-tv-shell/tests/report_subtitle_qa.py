#!/usr/bin/env python3
"""Private instrumentation output to anonymous, allowlisted outcome labels."""
from pathlib import Path
import re
import sys

TESTS=(
    ('EnhancedHostMediaInstrumentedTest','originalVideoAndPcmDecodeInsideActualEnhancedHost'),
    ('EnhancedEngineInstrumentedTest','pinnedStremioVideoBackendPlaysOriginalMediaWithNightAudio'),
    ('EnhancedSubtitleInstrumentedTest','actualVideoBackendRendersAndClearsEnglishSubtitles'),
)

def analyse(log):
    if len(log)>5_000_000:
        raise ValueError('Instrumentation input outside limit')
    current_class=''
    current_test=''
    results={test:[] for _,test in TESTS}
    for line in log.splitlines():
        match=re.search(r'^INSTRUMENTATION_STATUS:\s*class=([\w.]+)\s*$',line)
        if match:
            current_class=match.group(1).rsplit('.',1)[-1]
            continue
        match=re.search(r'^INSTRUMENTATION_STATUS:\s*test=(\w+)\s*$',line)
        if match:
            current_test=match.group(1)
            continue
        match=re.search(r'^INSTRUMENTATION_STATUS_CODE:\s*(-?\d+)\s*$',line)
        if match and (current_class,current_test) in TESTS:
            results[current_test].append(int(match.group(1)))
    out=['HOSTQA_TEST_RESULT_BEGIN']
    for klass,test in TESTS:
        codes=results[test]
        state=('FAIL' if any(c<0 for c in codes) else
               'PASS' if 0 in codes else 'NOT_REPORTED')
        out.append('HOSTQA_'+klass+'_'+state)
    if 'FAILURES!!!' in log:
        out.append('HOSTQA_JUNIT_FAILURE_SUMMARY_PRESENT')
    if 'INSTRUMENTATION_FAILED' in log:
        out.append('HOSTQA_FRAMEWORK_FAILURE_PRESENT')
    out.append('HOSTQA_TEST_RESULT_END')
    return out

def self_test():
    src=(
        'INSTRUMENTATION_STATUS: class=org.example.EnhancedHostMediaInstrumentedTest\n'
        'INSTRUMENTATION_STATUS: test=originalVideoAndPcmDecodeInsideActualEnhancedHost\n'
        'INSTRUMENTATION_STATUS_CODE: 1\n'
        'INSTRUMENTATION_STATUS_CODE: 0\n'
        'INSTRUMENTATION_STATUS: class=org.example.EnhancedEngineInstrumentedTest\n'
        'INSTRUMENTATION_STATUS: test=pinnedStremioVideoBackendPlaysOriginalMediaWithNightAudio\n'
        'INSTRUMENTATION_STATUS: stack=https://private.invalid/account?secret=TEST_TOKEN\n'
        'INSTRUMENTATION_STATUS_CODE: -2\n'
        'FAILURES!!!\n'
    )
    got='\n'.join(analyse(src))
    assert 'HOSTQA_EnhancedHostMediaInstrumentedTest_PASS' in got
    assert 'HOSTQA_EnhancedEngineInstrumentedTest_FAIL' in got
    assert 'HOSTQA_EnhancedSubtitleInstrumentedTest_NOT_REPORTED' in got
    assert 'private.invalid' not in got and 'TEST_TOKEN' not in got
    print('HOSTQA_SUBTITLE_TEST_RESULT_ALLOWLIST_SELF_TEST_PASS')

if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('HOSTQA_TEST_RESULT_ARGS_REJECTED')
    if sys.argv[1]=='--self-test':
        self_test()
    else:
        p=Path(sys.argv[1])
        if not p.is_file() or p.stat().st_size>5_000_000:
            raise SystemExit('HOSTQA_TEST_RESULT_FILE_REJECTED')
        print('\n'.join(analyse(p.read_text(encoding='utf-8',errors='replace'))))
