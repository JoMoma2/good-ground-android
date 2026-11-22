"""Portable-source integration checks, independent of Git and archived notes."""
from pathlib import Path
import hashlib
import json
import plistlib
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'GoodGround-Android/'
NEW_SOURCES = ('app/web/lesson-controls.js', 'app/web/sharing.js', 'app/web/nearby.js', 'app/web/collaboration-ui.js', 'app/web/nearby-ui.js', 'tests/sharing.test.cjs', 'tests/nearby.test.cjs', 'tests/sharing-ui.cjs', 'tests/fixtures/1.7.1-core.cjs', 'tests/source-package.test.py', 'scripts/verify-apk.py', 'NEARBY_TESTING.md')

class SourcePackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='good-ground-package-test-')
        self.addCleanup(self.temporary.cleanup)
        self.work = Path(self.temporary.name)

    def clean_tree(self):
        target = self.work / 'clean'
        target.mkdir()
        for directory in ('app', 'android', 'scripts', 'research', 'tests', '.github'):
            shutil.copytree(ROOT / directory, target / directory, symlinks=True,
                            ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        for source in ROOT.iterdir():
            if source.is_file() and not source.is_symlink() and (
                    source.suffix == '.md' or source.name in
                    ('package.json', 'package-lock.json', 'LICENSE', '.gitignore')):
                shutil.copy2(source, target / source.name)
        return target

    def pack(self, source, filename='source.zip', succeeds=True):
        output = self.work / filename
        result = subprocess.run([sys.executable, 'scripts/package-source.py', str(output)],
                                cwd=source, text=True, capture_output=True)
        if succeeds:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            checksum = Path(str(output) + '.sha256').read_text().split()[0]
            self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(), checksum)
            with zipfile.ZipFile(output) as package:
                self.assertIsNone(package.testzip())
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertFalse(output.exists(), 'A rejected tree must not produce a partial release')
        return output, result

    def test_repository_package_preserves_all_application_and_build_inputs(self):
        output, _ = self.pack(ROOT)
        with zipfile.ZipFile(output) as package:
            names = set(package.namelist())
            for directory in ('app', 'android', 'scripts', 'research', 'tests', '.github'):
                for file in (ROOT / directory).rglob('*'):
                    if file.is_file() and not file.is_symlink() and '__pycache__' not in file.parts and file.suffix != '.pyc':
                        relative = file.relative_to(ROOT).as_posix()
                        self.assertIn(PREFIX + relative, names, relative)
                        self.assertEqual(package.read(PREFIX + relative), file.read_bytes(), relative)
            for relative in NEW_SOURCES:
                self.assertIn(PREFIX + relative, names)
            data = json.loads(package.read(PREFIX + 'app/web/data.json'))
            self.assertEqual(len(data['skills']), 154)
            self.assertEqual(sum(len(s['steps']) for s in data['skills']), 386)
            self.assertIn('lesson-controls.js', package.read(PREFIX + 'app/web/index.html').decode())

    def test_clean_checkout_needs_no_archives_and_exports_repackage_without_git(self):
        clean = self.clean_tree()
        self.assertFalse((clean / 'docs/archive').exists())
        self.assertFalse((clean / 'validation').exists())
        output, _ = self.pack(clean)
        exported = self.work / 'exported'
        with zipfile.ZipFile(output) as package:
            package.extractall(exported)
            first = {name: package.read(name) for name in package.namelist()}
        second, _ = self.pack(exported / 'GoodGround-Android', 'repacked.zip')
        with zipfile.ZipFile(second) as package:
            self.assertEqual(first, {name: package.read(name) for name in package.namelist()})

    def test_optional_public_notes_ship_but_local_archives_and_outputs_do_not(self):
        clean = self.clean_tree()
        sentinel = ('LOCAL ONLY ' + self.work.name).encode()
        for relative in ('docs/archive/DEVELOPMENT_REPORT_1.4.0.md', 'validation/local.log',
                         'build/private-record.json', 'test-results/local.json',
                         'node_modules/local.js', '.git/local', '.signing/private.p12',
                         'previews/local.png', 'previews.html',
                         '.~lock.FEEDBACK_SETUP.md#'):
            file = clean / relative
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(sentinel)
        public = clean / 'docs/public-note.md'
        public.write_text('Optional public documentation')
        output, _ = self.pack(clean)
        with zipfile.ZipFile(output) as package:
            self.assertEqual(package.read(PREFIX + 'docs/public-note.md'), public.read_bytes())
            for name in package.namelist():
                self.assertNotIn(sentinel, package.read(name), name)
                self.assertFalse(name.startswith(PREFIX + 'docs/archive/'), name)
                self.assertFalse(name.startswith(PREFIX + 'validation/'), name)
                self.assertFalse(name.startswith(PREFIX + 'previews/'), name)
                self.assertNotEqual(name, PREFIX + 'previews.html')

    def test_missing_new_required_sources_are_rejected(self):
        clean = self.clean_tree()
        for relative in NEW_SOURCES:
            with self.subTest(relative=relative):
                file = clean / relative
                original = file.read_bytes()
                file.unlink()
                try:
                    _, result = self.pack(clean, succeeds=False)
                    self.assertIn(relative, result.stderr)
                finally:
                    file.write_bytes(original)

    def test_existing_required_source_cannot_be_silently_filtered_out(self):
        clean = self.clean_tree()
        required = clean / 'app/web/lesson-controls.js'
        external = self.work / 'external.js'
        external.write_bytes(required.read_bytes())
        required.unlink()
        required.symlink_to(external)
        self.assertTrue(required.is_file())
        _, result = self.pack(clean, succeeds=False)
        self.assertIn('Required files excluded from source package', result.stderr)
        self.assertIn('app/web/lesson-controls.js', result.stderr)

if __name__ == '__main__':
    unittest.main(verbosity=2)
