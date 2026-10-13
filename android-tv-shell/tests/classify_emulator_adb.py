#!/usr/bin/env python3
"""Classify Android emulator ADB transport using fixed, non-sensitive states.

A device listed as unauthorized is NOT usable. Never grant/debug around
authorisation; a hosted runner may make one ordinary ADB server reconnect.
Only this disposable Android emulator may ever satisfy the test.
"""
import re
import sys

STATES=('absent','device','unauthorized','offline','multiple','foreign','unknown')
SERIAL_RE=re.compile(r'^emulator-[0-9]{4,6}$')
LINE_RE=re.compile(r'^\s*(emulator-[0-9]{4,6})\s+(\S+)(?:\s|$)')

def classify(lines):
    if not isinstance(lines,str) or len(lines)>20000:
        return 'unknown'
    records=[]
    foreign=False
    for line in lines.splitlines():
        match=LINE_RE.match(line)
        if match and SERIAL_RE.fullmatch(match.group(1)):
            records.append((match.group(1),match.group(2).lower()))
        elif re.match(r'^\S+\s+(?:device|unauthorized|offline)(?:\s|$)',line):
            foreign=True
    if foreign:
        return 'foreign'
    if len(records)>1:
        return 'multiple'
    if not records:
        return 'absent'
    transport=records[0][1]
    return transport if transport in ('device','unauthorized','offline') else 'unknown'

def self_test():
    cases=(
        ('List of devices attached\n','absent'),
        ('List of devices attached\nemulator-5554\tunauthorized transport_id:1\n','unauthorized'),
        ('List of devices attached\nemulator-5554 device product:sdk_tv\n','device'),
        ('List of devices attached\nemulator-5554\toffline\n','offline'),
        ('List of devices attached\nemulator-5554\tdevice\nemulator-5556 unauthorized\n','multiple'),
        ('List of devices attached\n0123456789ABCDEF\tdevice\n','foreign'),
        ('List of devices attached\nemulator-5554\tunauthorized\nSecret URL https://private.invalid\n','unauthorized'),
        ('List of devices attached\nemulator-5554\tother\n','unknown'),
    )
    for contents,expected in cases:
        assert classify(contents)==expected,(expected,contents)
    print('HOSTQA_ADB_TRANSPORT_CLASSIFIER_SELF_TEST_PASS')

if __name__=='__main__':
    if len(sys.argv)==2 and sys.argv[1]=='--self-test':
        self_test()
    elif len(sys.argv)==2 and sys.argv[1]=='--classify':
        print(classify(sys.stdin.read(20001)))
    else:
        raise SystemExit('HOSTQA_ADB_CLASSIFIER_ARGUMENTS_REJECTED')
