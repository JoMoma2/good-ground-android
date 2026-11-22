"""Verify the CI debug APK's identity, certificate and every bundled web resource."""
from pathlib import Path
import hashlib,json,os,re,subprocess,sys,zipfile
ROOT=Path(__file__).resolve().parents[1]
apk=Path(sys.argv[1]).resolve()
if not apk.is_file() or apk.stat().st_size==0:raise SystemExit('APK is missing or empty')
sdk=Path(os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT') or '')
tools=sdk/'build-tools/35.0.0'
def run(tool,*args):
 return subprocess.check_output([str(tools/tool),*map(str,args)],text=True,stderr=subprocess.STDOUT)
badging=run('aapt','dump','badging',apk)
m=re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'",badging)
assert m,'APK identity missing'
package,code,version=m.groups()
expected=json.loads((ROOT/'package.json').read_text())['version']
gradle=(ROOT/'android/app/build.gradle').read_text()
expected_code=re.search(r'versionCode\s+(\d+)',gradle).group(1)
assert (package,code,version)==('local.goodground.training.debug',expected_code,expected+'-test'),(package,code,version)
assert 'application-debuggable' in badging,'Expected the separate debug test edition'
signature=run('apksigner','verify','--verbose','--print-certs',apk)
assert 'CN=Android Debug' in signature,'Unexpected debug signing certificate'
cert=re.search(r'Signer #1 certificate SHA-256 digest: ([a-fA-F0-9]+)',signature)
assert cert,'No verified signing certificate digest'
with zipfile.ZipFile(apk) as z:
 assert z.testzip() is None,'APK ZIP integrity check failed'
 names=z.namelist();assert len(names)==len(set(names)),'Duplicate APK entries'
 for file in sorted((ROOT/'app/web').rglob('*')):
  if file.is_file():
   rel=file.relative_to(ROOT/'app').as_posix();assert z.read('assets/'+rel)==file.read_bytes(),rel
 for name in names:
  assert not any(part in name.split('/') for part in ['.signing','.git','Archives','node_modules']),name
  assert not name.endswith(('.jks','.keystore','.p12')),name
sha=hashlib.sha256(apk.read_bytes()).hexdigest()
report={'filename':apk.name,'package':package,'versionName':version,'versionCode':int(code),'signing':'debug (runner-generated, not production)','certificateSha256':cert.group(1).lower(),'bytes':apk.stat().st_size,'sha256':sha,'allWebResourcesMatchSource':True}
apk.with_suffix(apk.suffix+'.sha256').write_text(sha+'  '+apk.name+'\n')
apk.with_suffix('.verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
