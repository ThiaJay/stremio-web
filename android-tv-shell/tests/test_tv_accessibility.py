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

    def test_button_without_focus_is_not_accepted(self):
        with self.assertRaisesRegex(ValueError, 'RELOAD'):
            verify_toolbar(fixture({'Reload': {'focusable': 'false'}}))

    def test_button_without_accessible_label_is_not_accepted(self):
        with self.assertRaisesRegex(ValueError, 'EXIT'):
            verify_toolbar(fixture({'Exit': {'content-desc': ''}}))

    def test_oversize_or_invalid_xml_not_accepted(self):
        for content in (b'', b'<foo/>', b'<hierarchy', b'x' * 3_000_001):
            with self.subTest(length=len(content)):
                with self.assertRaises(ValueError):
                    verify_toolbar(content)


if __name__ == '__main__':
    unittest.main()
