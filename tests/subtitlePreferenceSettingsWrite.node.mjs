import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {readPlayerSubtitleAutomation} from '../src/routes/Player/intelligentSubtitles/preference-player-gate.mjs';
import {commitSubtitleSettingsChoice} from '../src/routes/Player/intelligentSubtitles/preference-settings-write.mjs';
import {INSTALLATION_DIGEST_KEY,PREFERENCE_RECEIPT_KEY} from '../src/routes/Player/intelligentSubtitles/preference-store.mjs';
const base=()=>({mode:'smart',understoodLanguages:['en'],subtitleLanguages:['en'],preferUnderstoodAudio:true,unknownAudio:'off',suspectedPictureSubtitles:'hold',allowHearingImpaired:false,allowForcedOnly:false,forcedTranslationsForUnderstoodAudio:false});
const storage=(seed={})=>{const m=new Map(Object.entries(seed));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),snapshot:()=>Object.fromEntries(m)};};
const entropy=(n)=>new Uint8Array(n).fill(0xab);
test('hydration without a real UI event is inert',()=>{const s=storage();assert.equal(commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:base(),nextOptions:base()}).ok,false);assert.deepEqual(s.snapshot(),{});});
test('top-level settings request fails closed without invoking accessors or get traps',()=>{
    let accessorReads=0;
    const accessorRequest={randomBytes:entropy,currentOptions:base(),nextOptions:base(),localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'smart'}};
    Object.defineProperty(accessorRequest,'storage',{enumerable:true,get(){accessorReads+=1;return storage();}});
    assert.doesNotThrow(()=>assert.equal(commitSubtitleSettingsChoice(accessorRequest).ok,false));
    assert.equal(accessorReads,0);

    let getTraps=0;
    const getProxy=new Proxy({storage:null,randomBytes:entropy,currentOptions:base(),nextOptions:base(),localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'smart'}},{get(){getTraps+=1;throw Error('top-level get trap must not run');}});
    assert.doesNotThrow(()=>assert.equal(commitSubtitleSettingsChoice(getProxy).ok,false));
    assert.equal(getTraps,0);

    const ownKeysProxy=new Proxy({},{ownKeys(){throw Error('hostile top-level reflection');}});
    assert.doesNotThrow(()=>assert.equal(commitSubtitleSettingsChoice(ownKeysProxy).ok,false));
});
test('exact mode control event commits policy and proven local evidence',()=>{const s=storage();const before=base(),after={...base(),mode:'on'};const r=commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:before,nextOptions:after,localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'on'}});assert.equal(r.ok,true);assert.equal(r.provenance.kind,'same-installation-setting');assert.ok(s.getItem(PREFERENCE_RECEIPT_KEY));});
test('subsidiary settings cannot originate automatic subtitle consent',()=>{for(const candidate of [
    {control:'understood-primary',value:'fr',patch:{understoodLanguages:['fr']}},
    {control:'understood-secondary',value:'fr',patch:{understoodLanguages:['en','fr']}},
    {control:'subtitle-primary',value:'fr',patch:{subtitleLanguages:['fr']}},
    {control:'subtitle-secondary',value:'fr',patch:{subtitleLanguages:['en','fr']}},
    {control:'prefer-understood-audio',value:false,patch:{preferUnderstoodAudio:false}},
    {control:'unknown-audio',value:'subtitles',patch:{unknownAudio:'subtitles'}},
    {control:'picture-subtitles',value:'ignore',patch:{suspectedPictureSubtitles:'ignore'}},
    {control:'hearing-impaired',value:true,patch:{allowHearingImpaired:true}},
    {control:'forced-only',value:true,patch:{allowForcedOnly:true}},
    {control:'forced-translations',value:true,patch:{forcedTranslationsForUnderstoodAudio:true}},
]){const s=storage();const before=base(),after={...before,...candidate.patch};const r=commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:before,nextOptions:after,localChoiceEvent:{surface:'subtitle-settings',control:candidate.control,value:candidate.value}});assert.equal(r.ok,true,candidate.control);assert.equal(r.provenance,null,candidate.control);assert.equal(s.getItem(INSTALLATION_DIGEST_KEY),null,candidate.control);assert.equal(s.getItem(PREFERENCE_RECEIPT_KEY),null,candidate.control);assert.deepEqual(readPlayerSubtitleAutomation({storage:s,options:after}),{subtitle:false,audio:false,reason:'installation_preference_unverified',provenance:null},candidate.control);}});
test('event mismatch and injected changes fail without writes',()=>{for(const after of [{...base(),mode:'on',allowForcedOnly:true},{...base(),mode:'on'}]){const s=storage();const event={surface:'subtitle-settings',control:'automatic-mode',value:after.mode==='on'?'smart':'on'};assert.equal(commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:base(),nextOptions:after,localChoiceEvent:event}).ok,false);assert.deepEqual(s.snapshot(),{});}});
test('hostile option and event records fail closed without accessor execution or writes',()=>{
    const cases=[];
    let reads=0;
    const topLevelAccessor=base();
    Object.defineProperty(topLevelAccessor,'mode',{enumerable:true,get(){reads+=1;return 'smart';}});
    cases.push({currentOptions:topLevelAccessor,nextOptions:base(),localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'smart'}});
    const nestedAccessor=['en'];
    Object.defineProperty(nestedAccessor,'0',{enumerable:true,get(){reads+=1;return 'en';}});
    cases.push({currentOptions:{...base(),understoodLanguages:nestedAccessor},nextOptions:base(),localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'smart'}});
    const eventAccessor={control:'automatic-mode',value:'smart'};
    Object.defineProperty(eventAccessor,'surface',{enumerable:true,get(){reads+=1;return 'subtitle-settings';}});
    cases.push({currentOptions:base(),nextOptions:base(),localChoiceEvent:eventAccessor});
    const hidden={...base()};
    Object.defineProperty(hidden,'accountHydration',{value:true});
    cases.push({currentOptions:hidden,nextOptions:base(),localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'smart'}});
    const symbol={...base()};
    symbol[Symbol('authority')]=true;
    cases.push({currentOptions:symbol,nextOptions:base(),localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'smart'}});
    const revoked=Proxy.revocable(base(),{});
    revoked.revoke();
    cases.push({currentOptions:revoked.proxy,nextOptions:base(),localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'smart'}});
    for(const candidate of cases){
        const s=storage();
        assert.doesNotThrow(()=>assert.equal(commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,...candidate}).ok,false));
        assert.deepEqual(s.snapshot(),{});
    }
    assert.equal(reads,0);
});
test('explicit off revokes receipt and persists off',()=>{const s=storage();let before=base(),after={...base(),mode:'on'};assert.equal(commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:before,nextOptions:after,localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'on'}}).ok,true);before=after;after={...after,mode:'off'};const r=commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:before,nextOptions:after,localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'off'}});assert.equal(r.ok,true);assert.equal(s.getItem(PREFERENCE_RECEIPT_KEY),null);});
test('unknown immediate policy readback drift is never overwritten by rollback',()=>{const originalRaw=JSON.stringify(base());const s=storage({'stremio.enhanced.subtitlePolicy.v1':originalRaw});const original=s.setItem;let driftedRaw;s.setItem=(k,v)=>{const stored=k==='stremio.enhanced.subtitlePolicy.v1'?`${v} `:v;if(k==='stremio.enhanced.subtitlePolicy.v1')driftedRaw=stored;original.call(s,k,stored);};const r=commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:base(),nextOptions:{...base(),mode:'on'},localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'on'}});assert.equal(r.ok,false);assert.equal(r.rollbackVerified,false);assert.equal(s.getItem('stremio.enhanced.subtitlePolicy.v1'),driftedRaw);assert.notEqual(driftedRaw,`${originalRaw} `);});
test('language event rebinds evidence and increments revision',()=>{const s=storage();let before=base(),after={...base(),mode:'on'};commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:before,nextOptions:after,localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'on'}});before=after;after={...after,subtitleLanguages:['fr']};const r=commitSubtitleSettingsChoice({storage:s,randomBytes:()=>{throw Error('reuse');},currentOptions:before,nextOptions:after,localChoiceEvent:{surface:'subtitle-settings',control:'subtitle-primary',value:'fr'}});assert.equal(r.ok,true);assert.equal(r.provenance.preferenceRevision,2);assert.equal(r.provenance.binding.sessionLanguage,'fr');});
test('real settings component wires every allowlisted control and no hydration shortcut',async()=>{const source=await readFile(new URL('../src/routes/Settings/Player/EnhancedSubtitlePreferences.tsx',import.meta.url),'utf8');for(const control of ['automatic-mode','understood-primary','understood-secondary','subtitle-primary','subtitle-secondary','prefer-understood-audio','unknown-audio','picture-subtitles','hearing-impaired','forced-only','forced-translations'])assert.match(source,new RegExp(`apply\\('${control}'`));assert.match(source,/commitSubtitleSettingsChoice/);assert.doesNotMatch(source,/useProfile|authKey|preferredSubtitleLanguage|deviceId|packageName|fetch\(/i);});

test('session-only drift cannot be carried into a later persisted choice',()=>{const s=storage();const drifted={...base(),allowForcedOnly:true};const after={...drifted,mode:'on'};const r=commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:drifted,nextOptions:after,localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'on'}});assert.equal(r.ok,false);assert.deepEqual(s.snapshot(),{});});

test('accepted same-window settings notify mounted players without exposing preference payload',async()=>{const source=await readFile(new URL('../src/routes/Settings/Player/EnhancedSubtitlePreferences.tsx',import.meta.url),'utf8');assert.match(source,/const accepted = result\?\.ok === true/);assert.match(source,/if \(accepted && typeof window !== 'undefined'\)/);assert.match(source,/window\.dispatchEvent\(new Event\(PLAYER_PREFERENCE_EVENT\)\)/);assert.doesNotMatch(source,/CustomEvent|detail\s*:/);assert.ok(source.indexOf('const accepted = result?.ok === true')<source.indexOf('window.dispatchEvent(new Event(PLAYER_PREFERENCE_EVENT))'));});

test('rejected settings writes discard the unaccepted visible choice',async()=>{const source=await readFile(new URL('../src/routes/Settings/Player/EnhancedSubtitlePreferences.tsx',import.meta.url),'utf8');assert.match(source,/setValues\(accepted \? next : policy\.read\(storage\)\)/);assert.match(source,/setSaved\(accepted\)/);assert.match(source,/unaccepted choice was discarded and the displayed settings were re-read from local storage/);assert.doesNotMatch(source,/current session will keep them/);});



test('late concurrent policy drift rejects commit without overwriting the other writer',()=>{const s=storage();const originalGet=s.getItem.bind(s),originalSet=s.setItem.bind(s);let reads=0;const concurrent=JSON.stringify({...base(),mode:'off'});s.getItem=(key)=>{if(key==='stremio.enhanced.subtitlePolicy.v1'&&++reads===5)originalSet(key,concurrent);return originalGet(key);};const r=commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:base(),nextOptions:{...base(),mode:'on'},localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'on'}});assert.equal(r.ok,false);assert.equal(r.rollbackVerified,false);assert.equal(s.getItem('stremio.enhanced.subtitlePolicy.v1'),concurrent);});

test('late concurrent receipt drift rejects commit without restoring stale evidence',()=>{const s=storage();const originalGet=s.getItem.bind(s),originalSet=s.setItem.bind(s);let reads=0;const concurrent='{"concurrent":true}';s.getItem=(key)=>{if(key===PREFERENCE_RECEIPT_KEY&&++reads===9)originalSet(key,concurrent);return originalGet(key);};const r=commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:base(),nextOptions:{...base(),mode:'on'},localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'on'}});assert.equal(r.ok,false);assert.equal(r.rollbackVerified,false);assert.equal(s.getItem(PREFERENCE_RECEIPT_KEY),concurrent);});

test('explicit Off requires a stable three-key tuple and preserves late identity drift',()=>{const s=storage();let before=base(),after={...base(),mode:'on'};assert.equal(commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:before,nextOptions:after,localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'on'}}).ok,true);before=after;after={...after,mode:'off'};const originalGet=s.getItem.bind(s),originalSet=s.setItem.bind(s),originalRemove=s.removeItem.bind(s);let receiptRemoved=false,digestReadsAfterRemoval=0;const concurrent='cd'.repeat(32);s.removeItem=(key)=>{originalRemove(key);if(key===PREFERENCE_RECEIPT_KEY)receiptRemoved=true;};s.getItem=(key)=>{if(receiptRemoved&&key===INSTALLATION_DIGEST_KEY&&++digestReadsAfterRemoval===2)originalSet(key,concurrent);return originalGet(key);};const r=commitSubtitleSettingsChoice({storage:s,randomBytes:entropy,currentOptions:before,nextOptions:after,localChoiceEvent:{surface:'subtitle-settings',control:'automatic-mode',value:'off'}});assert.equal(r.ok,false);assert.equal(r.rollbackVerified,false);assert.equal(s.getItem(INSTALLATION_DIGEST_KEY),concurrent);});
