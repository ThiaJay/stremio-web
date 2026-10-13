import unittest
from check_tv_accessibility import verify_toolbar

PACKAGE = 'org.thiajay.stremioenhanced.tv'
BUTTONS = ('Back', 'Home', 'Reload', 'Exit')


def fixture(overrides=None):
    overrides = overrides or {}
    nodes = []
    for name in BUTTONS:
        fields = {
            'package': PACKAGE, 'class': 'android.widget.Button', 'text': name,
            'content-desc': name, 'clickable': 'true', 'focusable': 'true',
            'enabled': 'true',
        }
        fields.update(overrides.get(name, {}))
        attrs = ' '.join(f'{key}="{value}"' for key, value in fields.items())
        nodes.append('<node ' + attrs + '/>')
    return ('<hierarchy>' + ''.join(nodes) + '</hierarchy>').encode('utf-8')


class NativeToolbarAccessibilityTests(unittest.TestCase):
    def test_all_four_genuine_native_controls(self):
        self.assertTrue(verify_toolbar(fixture()))

    def test_wrong_package_spoof_rejected(self):
        with self.assertRaisesRegex(ValueError, 'BACK'):
            verify_toolbar(fixture({'Back': {'package': 'example.invalid'}}))

    def test_unrelated_foreground_window_is_not_accepted(self):
        overrides = {name: {'package': 'android.system.placeholder'} for name in BUTTONS}
        with self.assertRaisesRegex(ValueError, 'APP_WINDOW_NOT_IN_UI_HIERARCHY'):
            verify_toolbar(fixture(overrides))

    def test_same_app_without_native_button_nodes_is_not_accepted(self):
        overrides = {name: {'class': 'android.widget.TextView'} for name in BUTTONS}
        with self.assertRaisesRegex(ValueError, 'APP_HAS_NO_VISIBLE_NATIVE_BUTTON_NODES'):
            verify_toolbar(fixture(overrides))

    def test_platform_upper_case_still_requires_exact_accessible_names(self):
        overrides = {name: {'text': name.upper()} for name in BUTTONS}
        self.assertTrue(verify_toolbar(fixture(overrides)))

    def test_display_text_missing_is_not_accepted_as_a_visible_label(self):
        with self.assertRaisesRegex(ValueError, 'KNOWN_DESCRIPTIONS_BACK'):
            verify_toolbar(fixture({'Back': {'text': ''}, 'Exit': {'text': ''},
                                    'Home': {'text': ''}, 'Reload': {'text': ''}}))

    def test_display_text_must_match_its_accessible_description(self):
        with self.assertRaisesRegex(ValueError, 'BACK'):
            verify_toolbar(fixture({'Back': {'text': 'Unknown', 'content-desc': 'Back'}}))

    def test_unrecognised_button_labels_are_not_promoted(self):
        overrides = {name: {'text': 'Unknown'} for name in BUTTONS}
        with self.assertRaisesRegex(ValueError, 'EXPECTED_NATIVE_BUTTON_LABELS_NOT_IN_HIERARCHY'):
            verify_toolbar(fixture(overrides))

    def test_button_without_focus_is_not_accepted(self):
        with self.assertRaisesRegex(ValueError, 'RELOAD'):
            verify_toolbar(fixture({'Reload': {'focusable': 'false'}}))

    def test_button_without_accessible_label_is_not_accepted(self):
        with self.assertRaisesRegex(ValueError, 'EXIT'):
            verify_toolbar(fixture({'Exit': {'content-desc': ''}}))

    def test_field_diagnostic_is_fixed_and_does_not_expose_private_values(self):
        with self.assertRaises(ValueError) as caught:
            verify_toolbar(fixture({'Back': {'content-desc': 'private-content-never-print'}}))
        self.assertIn('FIELDS_DCFE_BACK0111', str(caught.exception))
        self.assertNotIn('private-content-never-print', str(caught.exception))

    def test_oversize_or_invalid_xml_not_accepted(self):
        for content in (b'', b'<foo/>', b'<hierarchy', b'x' * 3_000_001):
            with self.subTest(length=len(content)):
                with self.assertRaises(ValueError):
                    verify_toolbar(content)


if __name__ == '__main__':
    unittest.main()
