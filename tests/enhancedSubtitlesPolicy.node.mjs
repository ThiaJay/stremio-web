import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const policy=require('../src/routes/Player/enhancedSubtitlePolicy.js');
const t=(id,lang,label='Normal subtitles')=>({id,lang,label});
const media={
 streamReady:true,
 audioTracks:[{id:'audio1',lang:'eng'},{id:'audio2',lang:'spa'}],
 selectedAudioTrackId:'audio1',
 embeddedTracks:[t('s1','eng')],externalTracks:[t('s2','spa')],
};
const decision=(change={})=>policy.decide({...media,...change});

test('default policy enables smart selection, English first and subtitles off for understood audio',()=>{
 assert.equal(policy.DEFAULT.mode,'smart');
 assert.deepEqual(policy.DEFAULT.understoodLanguages,['en']);
 assert.deepEqual(policy.DEFAULT.subtitleLanguages,['en']);
 assert.equal(decision().action,'off');
 assert.equal(decision().reason,'audio_understood');
});
test('English audio identified as its standard three letter code remains subtitle free',()=>{
 assert.equal(decision({audioTracks:[{id:'e',lang:'eng'}],selectedAudioTrackId:'e'}).action,'off');
});
test('foreign audio enables a matching full English subtitle track',()=>{
 const result=decision({audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr'});
 assert.equal(result.action,'select');
 assert.deepEqual(result.track,{id:'s1',source:'embedded',language:'en'});
});
test('bilingual English Spanish keeps subtitles off for either understood language',()=>{
 const options={...policy.DEFAULT,understoodLanguages:['en','es']};
 assert.equal(decision({options, selectedAudioTrackId:'audio1'}).action,'off');
 assert.equal(decision({options, selectedAudioTrackId:'audio2'}).action,'off');
});
test('Bilingual priorities choose English dub before enabling subtitles',()=>{
 const r=decision({audioTracks:[{id:'fr',lang:'fra'},{id:'eng',lang:'eng'}],selectedAudioTrackId:'fr'});
 assert.equal(r.action,'hold_off');
 assert.equal(r.reason,'waiting_for_preferred_audio');
 assert.equal(policy.preferredAudioTrack([{id:'fr',lang:'fra'},{id:'eng',lang:'eng'}],'fr',policy.normalise(null)).id,'eng');
});
test('manual audio preference prevents a forced switch to a different spoken language',()=>{
 const r=decision({selectedAudioTrackId:'audio2',manualAudioPreference:true});
 assert.equal(r.action,'select');
});
test('manual subtitle enabled or disabled preference outranks smart automation',()=>{
 for(const value of [true,false]) {
  const r=decision({manualSubtitlePreference:value});
  if(value)assert.equal(r.action,'inherit');
  else assert.equal(r.action,'off');
 }
});
test('unknown audio stays off by default',()=>{
 const r=decision({audioTracks:[{id:'unk',lang:'und'}],selectedAudioTrackId:'unk'});
 assert.equal(r.action,'off');
 assert.equal(r.reason,'audio_language_unknown');
});
test('a chosen unknown audio override enables preferred subtitles',()=>{
 const options={...policy.DEFAULT,unknownAudio:'subtitles'};
 const r=decision({options,audioTracks:[{id:'u',lang:'und'}],selectedAudioTrackId:'u'});
 assert.equal(r.action,'select');
});
test('no labelled audio tracks do not imply foreign language from source title',()=>{
 assert.equal(decision({audioTracks:[],selectedAudioTrackId:null,pictureEvidence:{sourceName:'Japanese audio'}}).action,'off');
});
test('lone selected audio track may establish language after player readiness',()=>{
 assert.equal(decision({audioTracks:[{id:'only',lang:'deu'}],selectedAudioTrackId:null}).action,'select');
});
test('ambiguous multiple tracks without actual selected audio never guess',()=>{
 assert.equal(decision({audioTracks:[{id:'a',lang:'eng'},{id:'b',lang:'deu'}],selectedAudioTrackId:null}).action,'off');
});
test('no subtitles means no invented or downloaded subtitle track',()=>{
 const r=decision({audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',embeddedTracks:[],externalTracks:[]});
 assert.equal(r.action,'hold_off');
 assert.equal(r.reason,'no_matching_subtitle_track');
});
test('secondary subtitle language is used if the first is unavailable',()=>{
 const r=decision({options:{...policy.DEFAULT,subtitleLanguages:['en','de']},audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',embeddedTracks:[],externalTracks:[t('de','deu')]});
 assert.equal(r.action,'select');assert.equal(r.track.id,'de');
});
test('full subtitles beat hearing impaired and forced tracks of same language',()=>{
 const r=decision({audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',embeddedTracks:[t('f','en','English forced'),t('hi','eng','English SDH'),t('normal','eng','English')],externalTracks:[]});
 assert.equal(r.track.id,'normal');
});
test('hearing impaired and forced partial subtitles do not silently become full subtitles',()=>{
 const r=decision({audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',embeddedTracks:[t('f','eng','English forced'),t('cc','eng','English SDH')],externalTracks:[]});
 assert.equal(r.action,'hold_off');
});
test('hearing impaired captions can be allowed explicitly as a fallback',()=>{
 const r=decision({options:{...policy.DEFAULT,allowHearingImpaired:true},audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',embeddedTracks:[t('cc','eng','English SDH')],externalTracks:[]});
 assert.equal(r.track.id,'cc');
});
test('forced subtitles can be allowed explicitly if no full track is available',()=>{
 const r=decision({options:{...policy.DEFAULT,allowForcedOnly:true},audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',embeddedTracks:[t('f','eng','Forced')],externalTracks:[]});
 assert.equal(r.track.id,'f');
});
test('commentary tracks never become dialogue subtitles automatically',()=>{
 const r=decision({audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',embeddedTracks:[t('comment','eng','English director commentary')],externalTracks:[]});
 assert.equal(r.action,'hold_off');
});
test('metadata suggests hardcoded subtitles but cannot prove them',()=>{
 const r=decision({audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',pictureEvidence:{sourceName:'HD Hardsub Release'}});
 assert.equal(r.action,'hold_off');assert.equal(r.picture,'suspected');
});
test('forced translation subtitles stay off during understood English audio by default',()=>{
 const r=decision({embeddedTracks:[t('f','eng','English forced')],externalTracks:[]});
 assert.equal(r.action,'off');
});
test('explicit forced translations preference can show only the limited forced track',()=>{
 const options={...policy.DEFAULT,forcedTranslationsForUnderstoodAudio:true};
 const r=decision({options,embeddedTracks:[t('f','eng','English forced'),t('full','eng','English normal')],externalTracks:[]});
 assert.equal(r.action,'select');assert.equal(r.track.id,'f');
});
test('source title without specific hardcoded hint does not fabricate visual observation',()=>{
 const r=decision({audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',pictureEvidence:{sourceName:'2160p French x265'}});
 assert.equal(r.action,'select');assert.equal(r.picture,'unknown');
});
test('viewer confirms subtitles visible in picture and avoids duplicate overlay',()=>{
 const r=decision({audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',pictureEvidence:{verifiedByViewer:true}});
 assert.equal(r.action,'off');assert.equal(r.picture,'confirmed');
});
test('viewer can dismiss a misleading source name hint and permit preferred subtitles',()=>{
 const r=decision({audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',pictureEvidence:{sourceName:'hardsubbed',userDismissedHint:true}});
 assert.equal(r.action,'select');assert.equal(r.picture,'unknown');
});
test('user may explicitly ignore suspected picture subtitle hints globally',()=>{
 const r=decision({options:{...policy.DEFAULT,suspectedPictureSubtitles:'ignore'},audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',pictureEvidence:{sourceName:'hardcoded subtitles'}});
 assert.equal(r.action,'select');
});
test('decoder sighting alone cannot prove burned subtitles are readable',()=>{
 const r=decision({audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',pictureEvidence:{verifiedByDecoder:true}});
 assert.equal(r.action,'hold_off');assert.equal(r.picture,'suspected');
});
test('decoder confirmation of readable picture subtitles avoids duplicate overlay',()=>{
 const r=decision({audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr',pictureEvidence:{verifiedByDecoder:true,verifiedReadableText:true}});
 assert.equal(r.action,'off');assert.equal(r.picture,'confirmed');
});
test('unsupported unreadable media never alters subtitle state',()=>{
 const r=decision({streamReady:false,audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr'});
 assert.equal(r.action,'hold');
});
test('always off works even on foreign media',()=>{
 assert.equal(decision({options:{...policy.DEFAULT,mode:'off'},audioTracks:[{id:'fr',lang:'fra'}],selectedAudioTrackId:'fr'}).action,'off');
});
test('always on is customisable even with English audio',()=>{
 assert.equal(decision({options:{...policy.DEFAULT,mode:'on'}}).action,'select');
});
test('original Stremio setting is available without overriding it',()=>{
 assert.equal(decision({options:{...policy.DEFAULT,mode:'stremio'}}).action,'inherit');
});
test('known languages normalise between ISO 639 two and three letter codes',()=>{
 for(const [raw,expect] of [['eng','en'],['en','en'],['deu','de'],['ger','de'],['spa','es'],['fra','fr'],['pt-BR','pt'],['English','en'],['Mandarin','zh'],['zh-CN','zh']]) assert.equal(policy.language(raw),expect,raw);
});
test('unknown codes and malformed language hints fail closed',()=>{
 for(const invalid of ['',null,0,{},'und','mul','zxx','../../../x','English;true'])assert.equal(policy.language(invalid),null,String(invalid));
});
test('malformed and excessive preferences are normalised to safe bounds',()=>{
 const prefs=policy.normalise({mode:'execute',understoodLanguages:['eng','eng','fra','spa','ger','por','ita'],subtitleLanguages:['und','spa','spa','deu','fra','ita'],preferUnderstoodAudio:'yes'});
 assert.equal(prefs.mode,'smart'); assert.equal(prefs.understoodLanguages.length,4);
 assert.deepEqual(prefs.understoodLanguages.slice(0,3),['en','fr','es']);
 assert.equal(prefs.preferUnderstoodAudio,true);
});
test('device settings save and load without account access',()=>{
 const store={text:'',setItem(k,s){assert.equal(k,policy.STORAGE_KEY);this.text=s},getItem(k){assert.equal(k,policy.STORAGE_KEY);return this.text}};
 assert.equal(policy.save(store,{...policy.DEFAULT,understoodLanguages:['en','es']}),true);
 assert.deepEqual(policy.read(store).understoodLanguages,['en','es']);
});
test('private storage refusal does not become false saved status',()=>{
 const store={getItem(){throw new Error('denied')},setItem(){throw new Error('denied')}};
 assert.equal(policy.save(store,policy.DEFAULT),false);
 assert.deepEqual(policy.read(store),policy.normalise(null));
});
test('no network, credentials, account changes or video frame operations in pure policy module',()=>{
 const body=policy.decide.toString()+policy.read.toString()+policy.save.toString();
 for(const forbidden of ['fetch(','XMLHttpRequest','datastorePut','authKey','watchHistory','modifyAccount','document.querySelector']) assert.equal(body.includes(forbidden),false,forbidden);
});
