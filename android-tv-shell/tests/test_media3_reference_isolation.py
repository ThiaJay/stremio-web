"""Keep the independent Media3 proof intact and out of the WebView APK."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
METADATA = ROOT / "reference-media3/provenance.json"

class Media3ReferenceSeparation(unittest.TestCase):
    def test_original_source_objects_preserved_outside_android_app(self):
        evidence = json.loads(METADATA.read_text(encoding="utf-8"))
        self.assertEqual(evidence["schema"], 1)
        self.assertIs(evidence["release_eligible"], False)
        ref = ROOT.parent / evidence["new_directory"]
        old = ROOT.parent / evidence["original_directory"]
        self.assertFalse(old.exists(), "Native Media3 source must not be compiled into the WebView APK")
        self.assertEqual(set(evidence["files"]), {p.name for p in ref.glob("*.java")})
        for filename, meta in evidence["files"].items():
            source = (ref / filename).read_bytes()
            actual = hashlib.sha1(b"blob " + str(len(source)).encode("ascii") + b"\0" + source).hexdigest()
            self.assertEqual(actual, meta["git_blob_sha"], filename)
            self.assertIn(b"package org.stremio.nightaudio.reference;", source)

    def test_webview_build_has_no_media3_runtime_dependency(self):
        gradle = (ROOT / "app/build.gradle").read_text(encoding="utf-8")
        self.assertNotIn("androidx.media3", gradle)
        self.assertNotIn("reference-media3", gradle)
        for java in (ROOT / "app/src/main/java").rglob("*.java"):
            content = java.read_text(encoding="utf-8")
            self.assertNotIn("org.stremio.nightaudio.reference", content)
            self.assertNotIn("androidx.media3", content)

if __name__ == "__main__":
    unittest.main()
