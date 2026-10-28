"""Multi-behavior projects assembled from independent, reusable skills.
Step IDs never change meaning. Superseded guides remain readable with their records.
"""
import json
from pathlib import Path

def extend(D, add):
    by = {s['code']:s for s in D['skills']}
    for code in ['OPEN','SHELF','CLOSE']:
        by[code]['sheet']='Useful little jobs'
    # Appliance comfort is separate from pulling; the actual opening still needs it.
    by['OPEN']['steps'][0]['deps']=[]
    by['OPEN']['steps'][1]['deps']=[['OPEN-1',3],['PULL-3',3]]
    by['SHELF']['steps'][0]['deps']=[['GIVE-2',3]]
    by['SHELF']['steps'][1]['deps'].append(['FETCH-2',3])
    by['SHELF']['steps'][2]['deps'].append(['OPEN-1',3])
    by['CLOSE']['steps'][2]['deps'].append(['OPEN-1',3])
    fridge=by['DRINK']
    fridge.update(title='Getting a drink from the fridge',sheet='Brainiacs',
        goal='Open an approved easy door, retrieve a protected drink carrier, deliver it, and finish with human or dog closure.')
    fridge['steps'][0]['deps']=[['SHELF-3',3]]
    fridge['steps'][1]['deps']=[['DRINK-1',3],['OPEN-3',3],['PULL-3',3]]
    fridge['project']={'modules':[{'code':'OPEN'},{'code':'SHELF'},{'code':'CLOSE','optional':True},{'code':'DRINK'}],
        'foundations':['PULL','FETCH','GIVE','OTARGET'],
        'parallel':'Opening, shelf retrieval and gentle closing are separate skills. Practice their ready steps in any order. Rope pulling is required before door pulling; human closure is a complete, valid ending.'}

    # Short replacements have NEW IDs. Old notes, grades and links stay on old guides.
    old=json.loads((Path(__file__).resolve().parents[1]/'research/previous-project-guides.json').read_text())
    D['archivedSkills']=old
    def compact(code,title,topic,goal,cue,setup,sources,rows,groups):
        add(code,title,topic,goal,cue,setup,sources,rows,priority='Useful extra')
        skill=D['skills'][-1]
        mapping={st['id']:f'{code}-{chr(65+i)}' for i,st in enumerate(skill['steps'])}
        for i,st in enumerate(skill['steps']):
            st['id']=mapping[st['id']]
            st['deps']=[[mapping.get(key,key),level] for key,level in st['deps']]
            st['replaces']=[f'{code}-{n}' for n in groups[i]]
        return skill

    compact('NAMEDFIND','Find and deliver a named toy','Scent adventures',
        'Combine familiar toy labels with a short search and gentle return.', 'Your familiar toy labels, then Find',
        'Two safe named toys, easy accessible floor-level placements and a dog comfortable with this small search. No forced waits or separation tests.', 'A07; A08; P20; P32',[
        ('Choose and deliver','Put both familiar named toys nearby in full view. With neutral hands and gaze, request one label, receive the known give and reward. Swap toy positions and request each in mixed order. Build the label-to-delivery connection before hiding either object.', 'Chooses either requested toy and delivers comfortably with positions exchanged in two brief sessions.', 'Use one toy again or revisit mixed-position label choices; avoid repeated guessing.', [['TWOOBJECT-3',3],['GIVE-2',3],['FETCH-2',3]]),
        ('Search for one toy','With just one toy present, let the dog watch a partly concealed placement beside a broad safe object. Invite the familiar search and reward its return. Expose more of the toy whenever needed, then try a moment out of view only while searching stays comfortable.', 'Finds and returns either toy separately from several easy, partly concealed placements.', 'Use a visible floor placement or shorten the route. Skip separation that causes concern.', [['LOSTTOY-2',3],['FETCH-2',3],['GIVE-2',3]]),
        ('Request a toy from two search spots','Place the two familiar toys in separate easy search spots. Begin with one fully visible, then partly conceal either one while keeping access open. Request each label across mixed placements and reward the requested delivery. Help before errors or frustration build.', 'Finds and delivers either named toy from both familiar search spots without pointing.', 'Expose both toys or return to a single-toy search.', [['NAMEDFIND-1',3],['NAMEDFIND-2',3]]),
        ('Transfer and finish','Have a familiar helper change one easy placement while you remain neutral beside the dog. Request a familiar toy, receive and reward its return, then give a clear finished cue. Keep new placements visible at first; a short successful search is enough.', 'Completes the small named search-and-return game with changed placements and comfortable finishing.', 'Keep the familiar placements and helpful component cues. This is not an intelligence test.')
        ],[[1,2,6],[3,4,5],[7,8],[9,10,11,12]])

    compact('SORT','Two-toy tidy-up','Useful little jobs',
        'Put each of two designated toys into its own marked basket.', 'Tidy',
        'Two broad low baskets on distinct large markers and two safe familiar toys. Teach particular toy-to-basket pairings; avoid small labels, lids and chewable decorations.', 'P11; P20; P21',[
        ('First toy and basket','Use only the first toy and its marked basket. Begin with the known basket deposit, reward, then reset. Add a short basket cue before the deposit and build a small approach. Keep this one predictable toy-to-destination pairing throughout practice.', 'Deposits the first toy into its marked basket from a short approach on its cue.', 'Work above a wider low basket rim and shorten the carry.', [['BOX-2',3]]),
        ('Second toy and basket','With the first pair put away, practice the second safe toy and a differently marked basket. Reward easy deposits, then name that destination and add a short approach. This pair can be learned on its own, alongside the first pair.', 'Deposits the second toy into its own marked basket from a short approach.', 'Use a close drop again and make the destination markers more distinct.', [['BOX-2',3]]),
        ('Choose the destination','Put both marked baskets in view. Offer one toy and help with its familiar destination cue, then reduce that prompt when easy. Practice either toy, swap basket positions with their markers and keep your gaze neutral. Reset mistakes to an easy known deposit.', 'Usually sends each toy to its own basket across swapped positions, with little extra prompting.', 'Separate the baskets more or practice each toy-to-basket pairing alone.', [['SORT-1',3],['SORT-2',3]]),
        ('Pick up and tidy both toys','Place the two familiar toys apart on the floor. Invite pickup and the matching deposit, reward, then invite the remaining toy. Let the dog choose the order and reward both deposits. Finish clearly after the small set rather than repeatedly scattering it.', 'Picks up and deposits both toys into their matching destinations across two short sessions.', 'Offer one toy at a time and keep the basket cues.')
        ],[[1,2],[3,4],[5,6,7,8,9],[10,11,12]])

    compact('POST','A two-person delivery round','Useful little jobs',
        'Collect a safe pouch, hand it to one designated familiar receiver and return to the sender.', 'Post',
        'Two familiar willing adults, a safe oversized pouch, broad low tray and flat starting mat. Both adults remain available; no restraint or separation distress.', 'P11; P20; P21; P32',[
        ('Collect and deliver','Put the familiar pouch on a stable low open tray beside you. Invite pickup and a short known delivery to the visible receiver. They ask for give and reward. Reset together; keep the route short and use an empty pouch first.', 'Collects from the tray and gently hands the pouch to the nearby receiver.', 'Offer the pouch from your hand or bring the receiver closer.', [['MESSENGER-3',3],['POUCH-3',3],['FETCH-2',3]]),
        ('Return empty to the sender','Without a pouch, have the receiver release the dog toward the sender’s nearby familiar mat. Invite and reward arrival there. Keep both people visible and allow the dog to opt out; this empty return can be learned separately from collection and delivery.', 'Willingly returns empty to the sender’s mat from the nearby receiver.', 'Bring the starting mat closer and rehearse its approach without a delivery.', [['MAT-2',3]]),
        ('Join the round','Invite tray pickup, delivery, give and the empty return using the familiar component cues. Reward the handover and the mat return. Add the round cue just before pickup, allowing a short pause before extra help when the pattern is comfortable.', 'Connects collection, handover and return on the round cue with helpful component cues as needed.', 'Rehearse the uncertain component alone and keep rewards at both ends.', [['POST-1',3],['POST-2',3]]),
        ('Vary one feature and finish','Change just the short route, the visible receiver’s standing spot or the adults’ roles, returning to the easiest setup between variations. Deliver a light protected note only inside the familiar pouch. Reward both ends and finish after one round; inspect and remove the props.', 'Completes a comfortable short round with either adult in the practiced roles and a clear finish.', 'Keep the original roles, empty pouch and short visible route.')
        ],[[1,2,3],[4,5],[6,7],[8,9,10,11,12]])

    add('THIRDBIN','A third toy destination','Useful little jobs',
        'Add a third designated toy-and-basket pairing, then separately teach more examples for each destination.', 'Three familiar basket cues',
        'Three low marked baskets; safe oversized ball, stuffed toy and sturdy supervised rope prop, plus a second suitable example of each if wanted. Skip any toy the dog shreds or swallows.', 'P11; P20; P21; A07; A08',[
        ('Teach the third pair alone','Put away the first two baskets. Use the third safe toy with its own marked low basket. Rehearse a short known pickup and deposit, reward, and reset. Add a distinctive destination cue while this isolated pairing becomes familiar and predictable.', 'Delivers the third designated toy to its marked basket from a short distance.', 'Use a close supported basket deposit again. This pair does not need the other pairs first.'),
        ('Choose among three destinations','Bring back the two familiar marked baskets and start close to the third destination. Offer its toy and cue the known deposit, then practice each old pair. Gradually use equal approaches and swapped positions, rewarding correct destinations without pointing or corrections.', 'Chooses the matching basket for each of three designated toys across swapped positions.', 'Return to isolated pairs, greater basket separation or an easier two-basket choice.', [['THIRDBIN-1',3],['SORT-C',3]]),
        ('Teach additional examples explicitly','Introduce one new safe ball with only the ball basket present, then one new stuffed toy with its basket and a new rope prop with its own. Teach every new pairing separately before mixed choices. Similar appearance alone does not establish a sorting rule.', 'Six individually trained safe objects, two per destination, go to their practiced baskets in mixed choices.', 'Keep three designated toys. Do not test novel objects repeatedly or claim abstract category understanding.')
        ],deps=[['BOX-2',3]],priority='Useful extra')
    add('SORTALL','Sort the toys','Brainiacs',
        'Recognize trained balls, stuffed toys and rope props, carry each to its matching basket and finish a mixed tidy-up.', 'Sort',
        'Use the individually taught toy-to-basket assignments and three large marked baskets. All objects must suit this dog; reward correct deposits throughout. Do not assume untaught examples will generalize.', 'P11; P20; P21; A07; A08',[
        ('Sort one of each','Place one familiar object for each destination on a clear floor, equally easy to reach. Invite a known pickup and matching deposit, reward, then invite another. Let the dog choose the order while you stay neutral about which destination is correct.', 'Sorts the three familiar objects into their respective baskets with comfortable, separately rewarded deposits.', 'Offer one object at a time and restore its known basket cue.'),
        ('Sort a mixed set','Add the separately taught second examples, starting with just one extra object. Mix where toys lie without also moving the marked baskets. Reward each correct deposit and reset to an easy pairing after an error; gradually offer all six familiar objects.', 'Sorts the six trained objects into three destinations with no repeated pattern of destination errors.', 'Use fewer objects or return to the isolated pairing that became uncertain.', [['SORTALL-1',3],['THIRDBIN-3',3]]),
        ('Follow the assignments after a layout change','Move each basket together with its own marker between rounds and shorten the toy-to-basket routes again. Keep your hands still after the invitation. Reward sorting by the practiced assignment rather than by old left, middle and right locations.', 'Sorts the trained objects after basket positions change, with little destination prompting.', 'Restore the familiar layout or use one object beside its destination.'),
        ('Complete a sorting round','Say the finished project cue once before the familiar tidy invitations. Pause for the next pickup when comfortable, supporting with component cues and rewards whenever needed. After the last deposit, give a clear finished cue and remove the setup rather than expecting endless searching.', 'Enjoys a mixed three-destination sorting round, chooses the practiced baskets and finishes comfortably on two occasions.', 'Keep individual pickup and basket cues. A successful three-object round is a valid smaller game.')
        ],deps=[['SORT-D',3],['THIRDBIN-2',3]],priority='Optional advanced')
    D['skills'][-1]['project']={'modules':[{'code':'SORT'},{'code':'THIRDBIN'},{'code':'SORTALL'}],
        'foundations':['FETCH','GIVE','BOX'],
        'parallel':'Learn the first, second and third toy-to-basket pairings separately. Combine destination choices only when their component pairings are comfortable. New examples are taught, not presumed.'}

    add('PERSON','Recognize a familiar person’s name','Useful little jobs',
        'Use a familiar adult’s spoken name to choose whom to approach, without carrying anything.', 'Sarah / Alex (use your familiar adults’ names)',
        'Two familiar willing adults and an enclosed quiet room. No strangers, crowds, restraint or social pressure. Adults use neutral hands and do not beckon during choice trials.', 'P11; P17; P32',[
        ('Pair the first person’s name','With only the first familiar adult nearby, say their name once before an ordinary voluntary approach and reward there. The adult stays still and welcoming. Change their easy standing spot between short turns, using a normal invitation if needed before fading it.', 'Comfortably approaches the first familiar adult after their name in several easy positions.', 'Have the adult closer and fully visible; skip approaches the dog does not choose.'),
        ('Pair the second person’s name','Practice separately with the second familiar adult and a distinct spoken name. Pair the name with a comfortable short approach and reward while the first adult is out of the choice area. Vary easy positions and avoid making a particular side part of the cue.', 'Comfortably approaches the second familiar adult after their name in several easy positions.', 'Keep only that adult visible and use the familiar approach invitation.', []),
        ('Choose by name with both present','Place both familiar adults equally close, with relaxed still hands. Say one name, let the dog choose, and reward at the requested person. After an error make the next turn easier instead of correcting. Swap people’s positions and request both names in mixed order.', 'Usually chooses either named adult across side swaps and mixed requests without pointing or beckoning.', 'Return to separate name-and-approach practice and reduce competing distractions.', [['PERSON-1',3],['PERSON-2',3]]),
        ('Choose the named person instead of the nearest','Keep both adults fully visible and place one a little farther away. Request the farther adult on an easy turn, then vary requests and swap distances. Reward at the intended adult; help with a close reset before the dog defaults repeatedly to the nearer person.', 'Choices follow the requested name across changed positions and unequal distances in two brief sessions.', 'Return to equal distances. This is a practiced two-person discrimination, not recognition of arbitrary names or faces.')
        ],priority='Useful extra')
    add('COURIER','Courier to a named person','Brainiacs',
        'Collect a protected message, identify the requested familiar adult, hand it to that person and return to the sender.', 'Take this to Sarah / Alex (your practiced names)',
        'Two familiar willing recipients, safe pouch and tray, flat sender mat and clear indoor routes. Practice only taught names with visible recipients; no delivery of medication, valuables or loose ingestible items.', 'P11; P20; P21; P32',[
        ('Carry to the requested person','With both familiar recipients equally close and still, offer the familiar pouch and name the intended adult before the known delivery cue. Reward the correct handover, then invite the empty return. Request both people in mixed order, using no pointing or beckoning.', 'Gently delivers to either requested familiar adult and returns to the sender across position swaps.', 'Practice name choices without a pouch or deliver to one adult again.'),
        ('Keep the recipient choice through handover','Let the other adult remain visible while the intended receiver prepares their usual receiving hand only after the dog arrives. Reward the correct give and return. Vary who is nearer without offering competing treats, reaching for the pouch or correcting a wrong approach.', 'Maintains the named choice through handover even when the other familiar person is nearer.', 'Use equal distances or rehearse the harder name choice without an item.'),
        ('Collect the message before choosing','Begin at the tray with the familiar safe pouch containing one light protected note. Name the recipient, invite collection, then support the known chosen-person delivery and empty return. Reward at handover and at the sender’s mat; keep all people visible.', 'Connects tray pickup, named-recipient choice, give and empty return with familiar component cues.', 'Hand over the empty pouch at the start again or practice the uncertain component alone.'),
        ('Complete the named courier request','Give the chosen full request before the familiar round, pausing briefly before extra collection, delivery or return prompts. Alternate recipients and their easy positions over separate short turns. Reward both ends and finish after a round; never send the dog to find an absent or unfamiliar recipient.', 'Completes the named courier round for both practiced people across changed positions and distances with little prompting.', 'Keep component cues or the single-receiver round. Stop for guarding, chewing, confusion or social concern.')
        ],deps=[['PERSON-4',3],['POST-D',3]],priority='Optional advanced')
    D['skills'][-1]['project']={'modules':[{'code':'PERSON'},{'code':'POST'},{'code':'COURIER'}],
        'foundations':['MESSENGER','POUCH','MAT'],
        'parallel':'Learn familiar-person names without an item while practicing collection and return separately. The courier combines them only after both skills work; proximity must not decide the recipient.'}

    add('EQUIP','Retrieve your walk kit','Useful little jobs',
        'Bring one designated safe carrier holding the walk equipment to the handler.', 'Walk kit',
        'A large robust carrier with a safe grasp handle; empty first. A human checks that clips, straps and loops stay protected and removes the leash for fitting. Never mouth metal clips or trail loose equipment.', 'P20; P21; R01',[
        ('Give the carrier to the handler','Offer the empty safe carrier from your hand. Ask for the familiar gentle take and give, reward, and inspect it before another short turn. Keep equipment out until the carrier itself is easy and safe to handle; skip this job for shredders.', 'Takes and hands the empty carrier back gently without chewing or guarding.', 'Use an approved familiar retrieve prop or keep equipment collection as the human’s job.'),
        ('Retrieve from its low station','Place the familiar empty carrier on a stable low open surface or clear floor at its designated station. Invite the known pickup, receive with give and reward. Add a few easy carrying steps while keeping all loose clips and straps out of reach.', 'Retrieves the carrier from the low station and gives it comfortably to the handler.', 'Return to a hand presentation or put the carrier closer.', [['EQUIP-1',3],['FETCH-2',3]]),
        ('Bring the protected walk kit','Put only suitable light equipment securely inside the carrier after a human safety check. Rehearse the same short retrieve and give, then the human puts it down and removes the equipment. Keep the station familiar; do not add walking excitement and a heavier load together.', 'Brings the designated protected walk kit from its station and releases it without damaging equipment.', 'Keep the carrier empty or have the human collect equipment. Stop if weight, straps or chewing make the job unsuitable.')
        ],deps=[['TAKE-2',3],['GIVE-2',3]],priority='Useful extra')
    add('WALKREADY','Ready for a walk','Brainiacs',
        'Retrieve the walk kit, give it to the handler, participate in fitting, approach the door and wait for a safe release.', 'Ready for a walk',
        'Secure indoor practice area with a second boundary before any outside exit. Human checks and attaches equipment, holds the lead and controls doors. The dog can leave fitting; no forced sit or unattended leash access.', 'P20; P21; R01; P11',[
        ('Connect delivery to voluntary fitting','Invite the known walk-kit retrieve and give. Reward, put the carrier down and remove the equipment yourself. Offer the already comfortable fitting invitation, pausing whenever the dog moves away. Reward participation and remove the equipment again during early indoor rehearsals.', 'Retrieves, gives and willingly participates in the familiar short fitting routine without rushing or restraint.', 'Practice retrieval and harness participation separately, keeping the walk kit out of sight between sessions.'),
        ('Pause while the human checks equipment','After the familiar delivery, invite a comfortable stand or the dog’s chosen easy position while you attach and check the equipment. Reward brief voluntary stillness, then release before frustration. If the dog leaves, stop fitting rather than holding them in place.', 'Comfortably participates long enough for the human to fit and check equipment, then waits for a clear release.', 'Use a shorter fitting interval or return to the separate harness lesson.'),
        ('Approach the door and wait','With equipment safely fitted and the handler holding the lead, take a few known easy steps to a closed indoor practice door. Invite the familiar pause and reward there. Rehearse tiny controlled door movement behind a secure secondary boundary, returning to the easiest wait whenever needed.', 'Approaches the controlled doorway with a loose lead and waits through a small door movement for release.', 'Work farther from the doorway or rehearse wait separately with the equipment already on.', [['WALKREADY-2',3],['WAIT-2',3],['LOOSE-1',2]]),
        ('Complete the pre-walk routine','Say the project request before the familiar collection cue. Support pickup, give, voluntary fitting and the door approach with known prompts, rewarding useful pauses. The human checks safety, controls the doorway and gives permission to proceed only when ready; rehearsals can finish with a reward inside.', 'Connects kit retrieval, give, comfortable fitting, doorway pause and human-controlled release in two short routines.', 'Keep component cues and an indoor finish. Access to a real walk is never a reason to rush fitting or exit unsafely.')
        ],deps=[['EQUIP-3',3],['HARNESS-3',3]],priority='Optional advanced')
    D['skills'][-1]['project']={'modules':[{'code':'EQUIP'},{'code':'HARNESS'},{'code':'WAIT'},{'code':'WALKREADY'}],
        'foundations':['FETCH','GIVE','FREE','LOOSE'],
        'parallel':'Equipment retrieval, comfortable fitting and doorway waiting are separate skills. Learn them independently before connecting the full routine. The human handles clips, fitting and every exit decision.'}

    # Audit corrections: move dependencies to the action that actually needs them.
    by={s['code']:s for s in D['skills']}
    by['LEAVE']['steps'][1]['deps'].append(['HARNESS-3',2])
    by['LAUNDRY']['steps'][0]['deps']=[['BOX-1',3]]
    by['LAUNDRY']['steps'][1]['deps'].append(['FETCH-2',3])
    by['TURN']['steps'][1]['deps'].append(['HARNESS-3',2])
    by['TEETH']['steps'][0]['deps']=[]
    by['TEETH']['steps'][1]['deps'].append(['CHIN-2',3])
    by['WEAVE']['steps'][1]['deps']=[['MIDDLE-1',3]]
    by['WEAVE']['steps'][2]['deps']=[['WEAVE-1',3],['WEAVE-2',3]]
    by['CARDS']['steps'][0]['deps']=[]
    by['TOYNAME']['steps'][0]['deps']=[]
    by['TWOOBJECT']['steps'][0]['deps']=[]
    by['TWOOBJECT']['steps'][0]['advance']='The second toy has enjoyable label pairings and easy single-toy approach or retrieve practice.'
    by['TWOOBJECT']['steps'][1]['deps']=[['TOYNAME-2',3],['TWOOBJECT-1',3]]
    by['CARDS']['steps'][1]['deps']=[['TOUCH-2',3]]
    by['CARDS']['steps'][2]['deps']=[['CARDS-1',3],['CARDS-2',3]]
    by['POUCH']['steps'][0]['deps']=[['GIVE-2',3]]
    by['POUCH']['steps'][1]['deps'].append(['CARRY-1',3])
    by['MESSENGER']['steps'][0]['deps']=[['GIVE-2',3]]
    by['MESSENGER']['steps'][1]['deps'].append(['CARRY-1',3])
