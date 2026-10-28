"""Curriculum 7 review: learning dependencies, distinct from safe setup conditions."""
def apply(D):
    by={s['code']:s for s in D['skills']}
    def step(id):
        return next(st for s in D['skills'] for st in s['steps'] if st['id']==id)
    changes={
        'FETCH-1':([['GIVE-2',3]], 'A stationary pickup from a lower surface uses known take/hold/give, covered by hand delivery; traveling carries are not used until the next step.'),
        'FETCH-2':([['FETCH-1',3],['CARRY-2',3]], 'The short outward retrieve now explicitly requires carrying at the step that introduces travel.'),
        'PASS-1':([['DOG-2',3],['TURN-2',3]], 'The first pass uses a stationary comfortable helper and a rehearsed exit; completed parallel moving-dog walks and sniff interruptions are unnecessary gates.'),
        'PASS-2':([['PASS-1',3],['DOG-3',3]], 'The moving-helper pass now explicitly needs comfortable dog movement at the step that introduces it.'),
        'LEAVE-2':([['LEAVE-1',3]],'A protected floor item can be taught behind a barrier; wearing a harness is a setup option, not a learning component.'),
        'RECALL-1':([], 'A distinct recall cue can be paired directly with approach; responding to the dog’s name is independent.'),
        'RESTHEAD-1':([], 'This step teaches cushion contact directly; a hand chin rest is only an optional prompt.'),
        'SETTLE-1':([], 'Voluntary rest on a comfortable mat can be captured without a trained go-to-mat cue.'),
        'LOOSE-1':([], 'Comfortable secure equipment is checked directly; recording a harness lesson is not a necessary learned component.'),
        'TURN-2':([['TURN-1',3]], 'The learned turn is necessary; suitable comfortable equipment is a direct setup check rather than a mandatory harness grade.'),
        'RECALLCTX-1':([['RECALL-2',3]], 'The indoor recall transfers; comfortable fitted long-line equipment is a safety condition, not an extra obedience prerequisite.'),
        'STORM-1':([], 'Support and management must be accessible immediately; this step rehearses the refuge itself without requiring an earlier grade.'),
        'BOXFIND-1':([], 'An obvious reward in one open box teaches its own search; another food-search lesson adds no necessary component.'),
        'WALKCTX-1':([['LOOSE-3',3]], 'Transfer uses loose walking; a turn-away remains a useful optional exit, not part of the taught walking action.'),
        'MATCTX-1':([['MAT-2',3]], 'Moving the mat cue to a new room precedes resting and need not wait for settled duration.'),
        'MATCTX-2':([['MATCTX-1',3],['SETTLE-2',3]], 'The quiet-rest component is required at the step that actually transfers it.'),
        'SLIPPERS-1':([['GIVE-2',3]], 'Hand presentation uses take and give; the floor retrieve belongs at the floor step.'),
        'SLIPPERS-2':([['SLIPPERS-1',3],['FETCH-2',3]], 'Floor pickup and delivery now explicitly require the reusable retrieve at the point of use.'),
        'HOOP-1':([], 'Exploring an opening and following a small optional lure can be taught directly; a finished hand target unnecessarily blocks exploration.'),
        'WAVE-1':([['PAW-1',3]], 'A small offered paw lift is sufficient; turning the palm into a high five is an optional detour.'),
        'NAIL-2':([], 'Tool sight and sound can be conditioned separately from paw touch; this step stops before contact or clipping.'),
    }
    for id,(deps,reason) in changes.items():step(id)['deps']=deps
    step('LEAVE-2')['teach']='Say “leave” just before the familiar look-away opportunity and reward from you, away from the item. Set a safe boring item on the floor behind a secure barrier or under a clear sturdy cover so it cannot be taken. Gradually reduce your gesture, then vary the item slightly. Keep protection in place until easy. A comfortable leash setup is optional; never pull the dog away or test with hazards.'
    by['LOOSE']['setup']='Secure comfortable walking equipment and an ordinary leash; a quiet practice route. Check fit and willingness directly before practice. If equipment itself causes avoidance, use the Comfortable harness routine separately first.'
    by['RECALLCTX']['setup']+=' Use a securely enclosed area or a safely managed long line on comfortable fitted equipment. Start with equipment comfort separately if needed; never attach a long line to the neck or allow a hard stop.'
    step('RECALLCTX-1')['teach']='In a securely enclosed area, or with a safely managed slack long line on comfortable fitted equipment, begin much closer than your best indoor recall. Call once, step back invitingly, reward arrival generously, then let them explore again. Manage the line so it cannot snag or produce a fast hard stop; never reel the dog in.'
    step('RECALLCTX-2')['teach']=step('RECALLCTX-2')['teach'].replace('Maintain the line for safety.','Maintain your secure enclosure or safely managed line for safety.')
    step('STORM-1')['teach']=step('STORM-1')['teach'].replace('the familiar refuge','a quiet refuge with familiar bedding').replace('set up a quiet refuge','set up a quiet refuge')
    step('HOOP-1')['teach']=step('HOOP-1')['teach'].replace('offer a hand target through the center','offer a known hand target or a small reward invitation through the center')
    step('HOOP-2')['teach']=step('HOOP-2')['teach'].replace('target invitation','familiar invitation').replace('reduce your hand movement','reduce your hand movement and hide any reward until after the pass')
    step('WAVE-1')['teach']='Invite the familiar small paw offer toward a low open hand. Mark as the paw lifts, before contact, move the hand away, and reward. Keep the movement small so the dog does not stretch or scratch. Reset between attempts. A finished high five is optional; the offered lift is the component used here.'
    step('NAIL-2')['teach']='Show the nail tool at a comfortable distance, reward, and put it away. Introduce its quiet sound separately if relevant. Bring it slightly nearer only while the dog freely remains comfortable; stop well short of paw contact. Paw-touch preparation can run separately at NAIL-1. Actual clipping or grinding needs individual instruction on anatomy, technique and comfort, rather than following automatically.'
    step('SETTLE-1')['teach']=step('SETTLE-1')['teach'].replace('the familiar mat','a comfortable mat')
    step('TEETH-2')['teach']=step('TEETH-2')['teach'].replace('their familiar chin rest or other agreed start signal','their familiar chin rest')
    return changes
