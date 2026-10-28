"""Apply the complete hand-reviewed step preparation; fail if teaching changes need review."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
def apply(data):
    review=json.loads((ROOT/'research/step-setups.json').read_text())
    skills={s['code']:s for s in data['skills']}
    assert set(review['skills'])==set(skills),'Review preparation for every current skill'
    count=0
    for code,entry in review['skills'].items():
        steps={st['id']:st for st in skills[code]['steps']}
        assert {st['id'] for st in entry['steps']}==set(steps),code+' setup coverage changed'
        for row in entry['steps']:
            step=steps[row['id']]
            assert hashlib.sha256(step['teach'].encode()).hexdigest()==row['reviewedTeachingSHA256'],row['id']+' teaching changed: review its setup'
            assert len(row['setup'].split())>=12 and row['setup']!=step['teach'],row['id']
            original={k:v for k,v in step.items() if k!='setup'}
            assert hashlib.sha256(json.dumps(original,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()==row['reviewedStepSHA256'],row['id']+' criteria/prerequisites changed: review setup'
            step['setup']=row['setup']
            count+=1
    assert len(skills)==154 and count==386
    data['setupRevision']=review['schema']
    data['updated']=review['reviewedOn']
    return data
if __name__=='__main__':
    path=ROOT/'app/web/data.json';data=apply(json.loads(path.read_text()))
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'app/web/data.js').write_text('window.GOOD_GROUND_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
    print('Applied 386 reviewed setups across 154 skills; retired original IDs remain in earlier guides.')
