"""Portable Android source; private signing and local/test records never ship."""
from pathlib import Path
import hashlib,json,sys,zipfile
ROOT=Path(__file__).resolve().parents[1]
VERSION=json.loads((ROOT/'package.json').read_text())['version']
OUT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT.parent/f'GoodGround-{VERSION}-Android-Source.zip'
EXCLUDE={'.git','.gradle','.signing','node_modules','build','test-results','validation','__pycache__'}
REQUIRED=['app/web/lesson-controls.js','scripts/review-setups.py','research/step-setups.json','research/SETUP_REVIEW.md','tests/setup-review.test.cjs','FEEDBACK_SETUP.md','tests/redesign-ui.cjs','tests/lesson-display.test.cjs','scripts/curriculum-expansion.py','scripts/prerequisite-review.py','research/prerequisite-review.json','tests/expansion-practice.test.cjs','tests/expansion-ui.cjs','tests/fixtures/1.3.0-catalog.json','docs/archive/DEVELOPMENT_REPORT_1.4.0.md','tests/library-ui.cjs','android/gradlew','android/gradlew.bat','android/gradle/wrapper/gradle-wrapper.jar','android/app/src/main/AndroidManifest.xml','android/app/src/main/java/local/goodground/training/MainActivity.java','android/app/src/main/java/local/goodground/training/LocalStore.java','scripts/advanced-content.py','scripts/audit-curriculum.cjs','research/prerequisite-baselines.json','app/web/app.js','app/web/marker.js','app/web/history.js','tests/android-ui.cjs','tests/android-runtime.cjs','DEVELOPING.md','INSTALL.md','VALIDATION.md']
REQUIRED += ['scripts/curriculum-review.py','scripts/audit-content-review.cjs','research/curriculum-corrections-8.json','research/curriculum-review-8.json','research/CURRICULUM_REVIEW_2026-10-28.md','tests/content-review.test.cjs','tests/fixtures/1.6.0-catalog.json']
for name in REQUIRED:assert (ROOT/name).is_file(),name
files=[p for p in sorted(ROOT.rglob('*')) if p.is_file() and not p.is_symlink() and not (p.name.startswith('.~lock.') and p.name.endswith('#')) and not EXCLUDE.intersection(p.relative_to(ROOT).parts) and p.name!='local.properties' and p.suffix not in {'.apk','.ipa','.zip','.jks','.keystore','.pyc'}]
for p in files:assert p.stat().st_size<25*1024*1024,p
OUT.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in files:z.write(p,Path('GoodGround-Android')/p.relative_to(ROOT))
 assert not any('.signing' in name or name.endswith(('.jks','.keystore')) for name in z.namelist())
OUT.with_suffix('.zip.sha256').write_text(hashlib.sha256(OUT.read_bytes()).hexdigest()+'  '+OUT.name+'\n')
print(f'Packaged {len(files)} source files, {OUT.stat().st_size} bytes; no local signing material.')
