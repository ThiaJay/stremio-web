#!/usr/bin/env python3
"""Read-only anonymous Android TV accessibility check for our native toolbar.

Accepts UIAutomator's XML on stdin. Reports only fixed pass/fail categories; never
prints the raw hierarchy, account text, stream data or user supplied strings.
"""
import sys
import xml.etree.ElementTree as ET

APP_PACKAGE = 'org.thiajay.stremioenhanced.tv'
BUTTONS = frozenset({'Back', 'Home', 'Reload', 'Exit'})
MAX_XML_BYTES = 3_000_000


def verify_toolbar(raw):
    if len(raw) == 0 or len(raw) > MAX_XML_BYTES:
        raise ValueError('INVALID_UI_HIERARCHY_LENGTH')
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        raise ValueError('INVALID_UI_HIERARCHY_XML') from exc
    if root.tag != 'hierarchy':
        raise ValueError('INVALID_UI_HIERARCHY_ROOT')
    observed = set()
    for node in root.iter('node'):
        if node.attrib.get('package') != APP_PACKAGE:
            continue
        if node.attrib.get('class') != 'android.widget.Button':
            continue
        name = node.attrib.get('text')
        if (name in BUTTONS
                and node.attrib.get('content-desc') == name
                and node.attrib.get('clickable') == 'true'
                and node.attrib.get('focusable') == 'true'
                and node.attrib.get('enabled') == 'true'):
            observed.add(name)
    missing = BUTTONS - observed
    if missing:
        # Fixed expected names only, never raw screen contents.
        raise ValueError('MISSING_FOCUSABLE_NATIVE_CONTROLS_' + '_'.join(sorted(missing)).upper())
    return True


def main():
    raw = sys.stdin.buffer.read(MAX_XML_BYTES + 1)
    try:
        verify_toolbar(raw)
    except ValueError as exc:
        print('ANDROID_TV_NATIVE_TOOLBAR_ACCESSIBILITY_FAIL_' + str(exc), file=sys.stderr)
        return 1
    print('ANDROID_TV_NATIVE_TOOLBAR_ACCESSIBILITY_PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
