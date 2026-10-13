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
    app_node_count = 0
    native_button_count = 0
    expected_label_count = 0
    accessible_descriptions = set()
    # Android widget themes may render button text in upper case.
    # Canonical expected names still come from our fixed native labels.
    normalised_labels = {label.casefold(): label for label in BUTTONS}
    # Fixed four-bit diagnostics only. Never include XML attribute values.
    # The bit order is description, clickable, focusable, enabled.
    candidate_fields = {name: (False, False, False, False) for name in BUTTONS}
    for node in root.iter('node'):
        if node.attrib.get('package') != APP_PACKAGE:
            continue
        app_node_count += 1
        if node.attrib.get('class') != 'android.widget.Button':
            continue
        native_button_count += 1
        visual_text = (node.attrib.get('text') or '').strip()
        name = normalised_labels.get(visual_text.casefold())
        native_description = node.attrib.get('content-desc')
        if native_description in BUTTONS:
            accessible_descriptions.add(native_description)
        if name in BUTTONS:
            expected_label_count += 1
            flags = (
                node.attrib.get('content-desc') == name,
                node.attrib.get('clickable') == 'true',
                node.attrib.get('focusable') == 'true',
                node.attrib.get('enabled') == 'true',
            )
            if sum(flags) > sum(candidate_fields[name]):
                candidate_fields[name] = flags
        if (name in BUTTONS
                and node.attrib.get('content-desc') == name
                and node.attrib.get('clickable') == 'true'
                and node.attrib.get('focusable') == 'true'
                and node.attrib.get('enabled') == 'true'):
            observed.add(name)
    # Only fixed diagnostic categories are emitted. Never log screen text,
    # XML, other app packages, account data or view properties.
    if app_node_count == 0:
        raise ValueError('APP_WINDOW_NOT_IN_UI_HIERARCHY')
    if native_button_count == 0:
        raise ValueError('APP_HAS_NO_VISIBLE_NATIVE_BUTTON_NODES')
    if expected_label_count == 0:
        # Report only which of the four fixed labels was present as a native
        # accessibility description, never any other UI text or identifiers.
        diagnostic = ('_KNOWN_DESCRIPTIONS_' + '_'.join(sorted(accessible_descriptions)).upper()
                      if accessible_descriptions else '')
        raise ValueError('EXPECTED_NATIVE_BUTTON_LABELS_NOT_IN_HIERARCHY' + diagnostic)
    missing = BUTTONS - observed
    if missing:
        # Only known labels and boolean bits. Never echo the raw XML or text.
        diagnostic = '_'.join(
            name.upper() + ''.join('1' if flag else '0' for flag in candidate_fields[name])
            for name in sorted(BUTTONS)
        )
        raise ValueError(
            'MISSING_FOCUSABLE_NATIVE_CONTROLS_' + '_'.join(sorted(missing)).upper()
            + '_FIELDS_DCFE_' + diagnostic
        )
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
