"""Apply the explicit curriculum 8 corrections after the historical authoring stages.

The overlay is reviewed content, not a request to fetch or infer teaching at build time.
Retired instructions keep their original IDs and records and never credit new exercises.
"""
from pathlib import Path
import copy,json
ROOT=Path(__file__).resolve().parents[1]
def apply(data):
    review=json.loads((ROOT/'research/curriculum-corrections-8.json').read_text())
    for skill in data['skills']:
        ids={t['id'] for t in skill['steps'] if t['id'] in review['retiredSteps']}
        if ids:
            # Preserve the actual last shipped instructions, including their step setups.
            old=json.loads((ROOT/'tests/fixtures/1.6.0-catalog.json').read_text())
            archived=copy.deepcopy(next(s for s in old['skills'] if s['code']==skill['code']))
            archived['steps']=[t for t in archived['steps'] if t['id'] in ids]
            archived['retirementReason']=review['retiredSteps'][next(iter(ids))]['reason']
            data.setdefault('archivedSkills',[]).append(archived)
    data['skills']=[copy.deepcopy(review['skills'].get(s['code'],s)) for s in data['skills']]
    for key in ['sources','intro','evidence','triggers']:data[key]=copy.deepcopy(review[key])
    data['version']=review['curriculum']
    data['updated']=review['reviewedOn']
    return data
