#!/usr/bin/env python3
"""Report only allowlisted anonymous Android TV instrumentation stages."""
from pathlib import Path
import re
import sys

ALLOWED=(
    'WEBVIEW_PRESENT','ENHANCED_REACT_MOUNTED','QA_SCRIPT_REQUESTED',
    'CORE_ANONYMOUS_ENCODED','QA_BUTTON_FOCUSED','REMOTE_KEY_ACCEPTED',
    'PLAYER_ROUTE_REACHED','CORE_PLAYER_SELECTED','PLAYER_VIDEO_FOUND',
    'VIDEO_FRAME_DECODED','CORE_ROUTE_COMPLETE',
    'HOST_WEBVIEW_PRESENT','HOST_REACT_MOUNTED','HOST_READY',
    'HOST_BUTTON_FOCUSED','HOST_REMOTE_KEY_ACCEPTED',
    'HOST_MEDIA_PCM_VERIFIED','HOST_TEST_COMPLETE',
    'ENGINE_WEBVIEW_PRESENT','ENGINE_READY','ENGINE_BUTTON_FOCUSED',
    'ENGINE_REMOTE_KEY_ACCEPTED','ENGINE_NIGHT_AUDIO_VERIFIED',
    'ENGINE_TEST_COMPLETE',
    'REMOTE_REACT_MOUNTED','REMOTE_ANONYMOUS',
    'REMOTE_RELOAD_MOUNTED','REMOTE_HOME_MOUNTED',
    'REMOTE_HOME_ANONYMOUS','REMOTE_EXIT_CONFIRMED',
    'BACK_ANONYMOUS','BACK_PRE_DISPATCH','BACK_REMOTE_EVENT_RETURNED',
    'BACK_SAFE_INTERNAL_NAVIGATION','BACK_EXIT_CONFIRMED',
)

def markers(log):
    if len(log)>2_000_000:
        raise ValueError('Oversized anonymous QA log')
    found=set()
    for line in log.splitlines():
        if 'EnhancedCoreQA' not in line:
            continue
        for marker in ALLOWED:
            if re.search(r'\bCORE_QA_STAGE_'+re.escape(marker)+r'\b',line):
                found.add(marker)
    return ['HOSTQA_CORE_STAGE_'+m for m in ALLOWED if m in found] or [
        'HOSTQA_CORE_STAGE_NONE_OBSERVED']

def main():
    if len(sys.argv)!=2:
        raise SystemExit('HOSTQA_STAGE_ARGUMENTS_REJECTED')
    if sys.argv[1]=='--self-test':
        sample=('I EnhancedCoreQA: CORE_QA_STAGE_WEBVIEW_PRESENT secret=https://hidden.invalid/account\n'
                'I EnhancedCoreQA: CORE_QA_STAGE_CORE_ANONYMOUS_ENCODED\n'
                'I EnhancedCoreQA: CORE_QA_STAGE_ENGINE_NIGHT_AUDIO_VERIFIED\n'
                'I UnknownTag: CORE_QA_STAGE_CORE_ROUTE_COMPLETE\n')
        expected=['HOSTQA_CORE_STAGE_WEBVIEW_PRESENT','HOSTQA_CORE_STAGE_CORE_ANONYMOUS_ENCODED',
                  'HOSTQA_CORE_STAGE_ENGINE_NIGHT_AUDIO_VERIFIED']
        assert markers(sample)==expected
        assert 'hidden.invalid' not in ''.join(markers(sample))
        print('HOSTQA_CORE_STAGE_ALLOWLIST_SELF_TEST_PASS')
        return
    file=Path(sys.argv[1])
    if not file.is_file() or file.stat().st_size>2_000_000:
        raise SystemExit('HOSTQA_STAGE_FILE_REJECTED')
    print('\n'.join(markers(file.read_text(encoding='utf-8',errors='replace'))))

if __name__=='__main__':
    main()
