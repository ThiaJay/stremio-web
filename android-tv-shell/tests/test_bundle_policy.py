import importlib.util
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('bundle',str(Path(__file__).resolve().parent.parent/'bundle_verified_web.py'))
bundle=importlib.util.module_from_spec(spec);spec.loader.exec_module(bundle)
SHA='b'*40
class BundlePolicyTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        (self.root/'d').mkdir(); self.d=self.root/'d'
        self.index=f'<!DOCTYPE html><title>Stremio Enhanced (unofficial)</title><div id="app"></div><script src="{SHA}/scripts/main.js"></script><script src="{SHA}/scripts/worker.js"></script>'
        (self.d/'index.html').write_text(self.index)
        s=self.d/SHA/'scripts';s.mkdir(parents=True);(s/'main.js').write_text('console.log(1)');(s/'worker.js').write_text('self.ok=true;')
    def tearDown(self):self.tmp.cleanup()
    def test_good_fixture(self):
        out=bundle.assess(self.d,SHA)
        self.assertEqual(out['assetCount'],3)
        self.assertFalse(out['releaseEligible'])
    def test_privacy_guard(self):
        (self.d/SHA/'scripts'/'main.js').write_text('Authorization: Bearer token-not-public')
        with self.assertRaises(ValueError):bundle.assess(self.d,SHA)
    def test_symlink_rejected(self):
        (self.d/'steal.js').symlink_to(self.d/'index.html')
        with self.assertRaises(ValueError):bundle.assess(self.d,SHA)
    def test_official_apple_association_is_excluded(self):
        folder=self.d/'.well-known';folder.mkdir()
        (folder/'apple-app-site-association').write_text('{"applinks": {"apps": []}}')
        result=bundle.assess(self.d,SHA)
        self.assertNotIn('.well-known/apple-app-site-association',[x['path'] for x in result['files']])
    def test_unreviewed_hidden_association_fails(self):
        folder=self.d/'.well-known';folder.mkdir()
        (folder/'unreviewed-token').write_text('unexpected')
        with self.assertRaises(ValueError):bundle.assess(self.d,SHA)
    def test_missing_worker_ref(self):
        (self.d/'index.html').write_text(self.index.replace('/scripts/worker.js','/scripts/nothing.js'))
        with self.assertRaises(ValueError):bundle.assess(self.d,SHA)
    def test_release_not_claimed(self):
        self.assertFalse(bundle.assess(self.d,SHA)['stremioAccountTested'])
    def test_unknown_source_sha(self):
        with self.assertRaises(ValueError):bundle.assess(self.d,'main')
if __name__=='__main__':unittest.main()
