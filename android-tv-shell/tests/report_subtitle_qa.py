#!/usr/bin/env python3
"""Bounded Android instrumentation diagnostics; prints allowlisted QA codes only.

AndroidJUnitRunner -w may emit just a JUnit text summary rather than individual
INSTRUMENTATION_STATUS records. Treat unknown evidence as unknown, never passed.
This script must never echo source logs, exception text, URLs or stack traces.
"""
from pathlib import Path
import re
import sys

TESTS=(
    ('EnhancedHostMediaInstrumentedTest','originalVideoAndPcmDecodeInsideActualEnhancedHost'),
    ('EnhancedEngineInstrumentedTest','pinnedStremioVideoBackendPlaysOriginalMediaWithNightAudio'),
    ('EnhancedSubtitleInstrumentedTest','actualVideoBackendRendersAndClearsEnglishSubtitles'),
)

STAGES=(
    'WEBVIEW_PRESENT','ENHANCED_REACT_MOUNTED','SCRIPT_REQUESTED',
    'SCRIPT_READY_OR_ERROR','POLICY_PASSED','VIDEO_TRACKS_READY',
    'REMOTE_FOCUSED','REMOTE_GESTURE_ACCEPTED','SUBTITLE_RENDER_OFF',
    'SUBTITLE_QA_COMPLETE','APP_REMAINED_MOUNTED',
)
FLAGS=(
    'ready','gesture','backend','trackListed','policyPassed','defaultOff',
    'decoded','trackLoaded','cueVisible','restoredOff','complete','error',
)

MAX_SIZE=5_000_000

def analyse(log):
    if not isinstance(log,str) or len(log)>MAX_SIZE:
        raise ValueError('Instrumentation data missing or oversized')
    results={test:[] for _,test in TESTS}
    current_class=None
    current_test=None
    for line in log.splitlines():
        m=re.match(r'^\s*INSTRUMENTATION_STATUS:\s*class=([\w.]+)\s*$',line)
        if m:
            current_class=m.group(1).rsplit('.',1)[-1]
            continue
        m=re.match(r'^\s*INSTRUMENTATION_STATUS:\s*test=(\w+)\s*$',line)
        if m:
            current_test=m.group(1)
            continue
        m=re.match(r'^\s*INSTRUMENTATION_STATUS_CODE:\s*(-?\d+)\s*$',line)
        if m and (current_class,current_test) in TESTS:
            # AndroidJUnitRunner may emit a start (1) followed by success
            # (0) for the same class/test without repeating their labels.
            # Retain that observed identity until the next class/test label.
            results[current_test].append(int(m.group(1)))
    # Standard AndroidJUnitRunner -w JUnit summary has lines like:
    # 1) testMethod(org.example.ExactClass). This is authentic failed-test
    # identity even where the runner emits no individual status codes.
    junit_failed=set()
    for klass,test in TESTS:
        pattern=(r'(?m)^\s*(?:INSTRUMENTATION_RESULT:\s*stream=\s*)?'
                 r'\d+\)\s*'+re.escape(test)+r'\s*\('
                 r'(?:[A-Za-z0-9_]+\.)*'+re.escape(klass)+r'\)\s*$')
        if re.search(pattern,log):
            junit_failed.add(test)
    has_failure_summary='FAILURES!!!' in log
    out=['HOSTQA_TEST_RESULT_BEGIN']
    for klass,test in TESTS:
        codes=results[test]
        if test in junit_failed or any(code<0 for code in codes):
            status='FAIL'
        elif 0 in codes and not has_failure_summary:
            status='PASS'
        else:
            status='NOT_VERIFIED'
        out.append('HOSTQA_'+klass+'_'+status)
    if has_failure_summary:
        out.append('HOSTQA_JUNIT_FAILURE_SUMMARY_PRESENT')
        if not junit_failed and not any(any(x<0 for x in xs) for xs in results.values()):
            out.append('HOSTQA_JUNIT_FAILURE_UNATTRIBUTED')
    if 'INSTRUMENTATION_FAILED' in log or 'shortMsg=Process crashed' in log:
        out.append('HOSTQA_FRAMEWORK_FAILURE_PRESENT')
    out.append('HOSTQA_TEST_RESULT_END')
    return out

def analyse_stages(log):
    if not isinstance(log,str) or len(log)>MAX_SIZE:
        raise ValueError('Stage observations missing or oversized')
    # Match only the unique test logging tag and the fixed enum. All log
    # contents, user data and free text outside these enums are discarded.
    found=set()
    for line in log.splitlines():
        if not re.search(r'\bEnhancedSubtitleQA\b',line):
            continue
        for stage in STAGES:
            if re.search(r'\bSUBTITLE_QA_STAGE_'+re.escape(stage)+r'\b',line):
                found.add('STAGE_'+stage)
        for flag in FLAGS:
            if re.search(r'\bSUBTITLE_QA_FLAG_'+re.escape(flag.upper())+r'\b',line):
                found.add('FLAG_'+flag.upper())
    out=['HOSTQA_SUBTITLE_OBSERVATIONS_BEGIN']
    out.extend('HOSTQA_SUBTITLE_'+stage for stage in (
        *('STAGE_'+x for x in STAGES), *('FLAG_'+x.upper() for x in FLAGS)
    ) if stage in found)
    if not found:
        out.append('HOSTQA_SUBTITLE_NO_ALLOWLISTED_OBSERVATIONS')
    out.append('HOSTQA_SUBTITLE_OBSERVATIONS_END')
    return out

def self_test():
    status=(
        'INSTRUMENTATION_STATUS: class=org.sample.EnhancedHostMediaInstrumentedTest\n'
        'INSTRUMENTATION_STATUS: test=originalVideoAndPcmDecodeInsideActualEnhancedHost\n'
        'INSTRUMENTATION_STATUS_CODE: 1\n'
        'INSTRUMENTATION_STATUS_CODE: 0\n'
    )
    a='\n'.join(analyse(status))
    assert 'HOSTQA_EnhancedHostMediaInstrumentedTest_PASS' in a
    failure=(
        'INSTRUMENTATION_RESULT: stream=\n'
        'Time: 12\nThere was 1 failure:\n'
        '1) actualVideoBackendRendersAndClearsEnglishSubtitles('
        'org.thiajay.stremioenhanced.tv.EnhancedSubtitleInstrumentedTest)\n'
        'java.lang.AssertionError: https://private.invalid/path?code=SECRET\n'
        'FAILURES!!!\nTests run: 3, Failures: 1\n'
    )
    b='\n'.join(analyse(failure))
    assert 'HOSTQA_EnhancedSubtitleInstrumentedTest_FAIL' in b
    assert 'HOSTQA_EnhancedHostMediaInstrumentedTest_NOT_VERIFIED' in b
    assert 'HOSTQA_JUNIT_FAILURE_UNATTRIBUTED' not in b
    assert 'private.invalid' not in b and 'SECRET' not in b
    unknown='\n'.join(analyse('FAILURES!!!\nUser data: SECRET\n'))
    assert 'HOSTQA_JUNIT_FAILURE_UNATTRIBUTED' in unknown
    stage=(
        'I EnhancedSubtitleQA: SUBTITLE_QA_STAGE_POLICY_PASSED '
        'https://private.invalid/account?token=SECRET\n'
        'I EnhancedSubtitleQA: SUBTITLE_QA_FLAG_CUEVISIBLE\n'
        'I OtherApp: SUBTITLE_QA_STAGE_APP_REMAINED_MOUNTED\n'
    )
    c='\n'.join(analyse_stages(stage))
    assert 'HOSTQA_SUBTITLE_STAGE_POLICY_PASSED' in c
    assert 'HOSTQA_SUBTITLE_FLAG_CUEVISIBLE' in c
    assert 'HOSTQA_SUBTITLE_STAGE_APP_REMAINED_MOUNTED' not in c
    assert 'private.invalid' not in c and 'SECRET' not in c
    print('HOSTQA_SUBTITLE_TEST_AND_STAGE_ALLOWLIST_SELF_TEST_PASS')

def load(path):
    p=Path(path)
    if not p.is_file() or p.stat().st_size>MAX_SIZE:
        raise SystemExit('HOSTQA_ALLOWLIST_INPUT_REJECTED')
    return p.read_text(encoding='utf-8',errors='replace')

if __name__=='__main__':
    if len(sys.argv)==2 and sys.argv[1]=='--self-test':
        self_test()
    elif len(sys.argv)==2:
        print('\n'.join(analyse(load(sys.argv[1]))))
    elif len(sys.argv)==3 and sys.argv[1]=='--stages':
        print('\n'.join(analyse_stages(load(sys.argv[2]))))
    else:
        raise SystemExit('HOSTQA_SUBTITLE_TEST_RESULT_ARGS_REJECTED')
