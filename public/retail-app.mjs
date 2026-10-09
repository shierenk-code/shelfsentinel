import {validateEvent} from './contract.mjs';
import {occupancy,localizedMotion} from './perception.mjs';
import {recordings} from './recordings.mjs';
import {zoneAtPoint,updateTemporaryTracks,shelfRule,visitTransition,safeOutbound,clamp} from './retail-core.mjs';
import {loadLocalDetector} from './model-bundle.mjs';

const $=id=>document.getElementById(id),video=$('videoElement');
const dashboard=document.querySelector('main');
const overviewBrief=document.createElement('div');overviewBrief.className='overview-simple';
overviewBrief.innerHTML='<div class="store-heading"><div><p class="eyebrow">STORE OVERVIEW</p><h1>ShelfSentinel Store</h1><p>Today at the store · anonymous doorway counts and visual shelf checks</p></div><strong id="storeDate"></strong></div><div class="summary-grid"><article class="summary-card"><span>People inside now</span><strong id="briefInside">0</strong><small>Estimated from active visit records</small></article><article class="summary-card"><span>Entries observed</span><strong id="briefEntries">0</strong><small>Current server session</small></article><article class="summary-card"><span>Exits observed</span><strong id="briefExits">0</strong><small>Matched crossings</small></article><article class="summary-card"><span>Saved active records</span><strong id="briefRecords">0</strong><small>Deleted on exit or timeout</small></article></div><div class="overview-simple-grid"><article class="panel"><h2>Store activity today</h2><p id="briefActivity">No doorway activity analyzed yet.</p><button data-go="entry">View entry &amp; exit →</button></article><article class="panel"><h2>Inventory at a glance</h2><div class="overview-inventory-row"><span>Monitored shelf</span><strong id="briefShelf">Awaiting analysis</strong></div><p id="briefShelfNote">Analyze a calibrated shelf video to estimate visible stock.</p><button data-go="shelf">View shelf maintenance →</button></article></div><p class="overview-privacy-note">Video is analyzed locally. Active visit records contain anonymous tokens and expire automatically.</p>';
$('overview').prepend(overviewBrief);
const entryPage=document.createElement('section');entryPage.id='entry';entryPage.className='page';
entryPage.innerHTML='<div class="page-heading"><p class="eyebrow">STORE PRESENCE</p><h1>Entry &amp; Exit</h1><p>Choose a doorway video and start analysis. The table records observed entries and matched exits.</p></div><div class="panel recording-library"><h2>Doorway recordings</h2><div id="entryClipList" class="recording-grid"></div></div><div class="summary-grid workflow-stats"><article class="summary-card"><span>Inside now</span><strong id="entryInside">0</strong></article><article class="summary-card"><span>Entries</span><strong id="entryEntered">0</strong></article><article class="summary-card"><span>Exits</span><strong id="entryExited">0</strong></article><article class="summary-card"><span>Timed out</span><strong id="entryTimedOut">0</strong></article></div><div class="panel"><h2>Entry &amp; exit records</h2><p class="subtle">Only observed crossings appear. A matched exit removes the active server record; this table shows an anonymous session log.</p><div class="table-wrap"><table><thead><tr><th>Visit</th><th>Entry</th><th>Exit</th><th>Status</th><th>Evidence</th></tr></thead><tbody id="entryTableRows"><tr><td colspan="5">Start a doorway video to see observed entries.</td></tr></tbody></table></div></div>';
entryPage.querySelector('#entryExited').parentElement.querySelector('span').textContent='Matched exits';
const exitOnlyNote=document.createElement('p');exitOnlyNote.id='exitOnlyCount';exitOnlyNote.className='subtle';entryPage.querySelector('#entryTableRows').closest('.table-wrap').before(exitOnlyNote);
const shelfPage=document.createElement('section');shelfPage.id='shelf';shelfPage.className='page';
shelfPage.innerHTML='<div class="page-heading"><p class="eyebrow">SHELF OPERATIONS</p><h1>Shelf Maintenance</h1><p>Analyze a shelf video, see how much of the monitored area looks stocked, and review stock changes.</p></div><div class="panel recording-library"><h2>Shelf recordings</h2><div id="shelfClipList" class="recording-grid"></div></div><div class="panel shelf-settings"><h2>Shelf status</h2><div class="summary-grid"><article class="summary-card"><span>Visible shelf occupancy</span><strong id="shelfInventoryLevel">Not calibrated</strong><small>Compared with reference frames</small></article><article class="summary-card"><span>Stock status</span><strong id="shelfInventoryStatus">Awaiting analysis</strong><small id="shelfInventoryDetail">Run a calibrated shelf recording</small></article><article class="summary-card"><span>Low-stock limit</span><strong id="shelfLimitValue">25%</strong><small>Alert below this estimate</small></article><article class="summary-card"><span>Suggested action</span><strong id="shelfInventoryAction">None yet</strong><small>Based on observed changes</small></article></div><label>Low-stock limit (%) <input id="shelfLimitInput" type="number" min="1" max="90" value="25"></label><button id="saveShelfLimit">Save limit</button><p class="subtle">Visual occupancy is an estimate. These recordings do not identify individual products or count SKUs.</p></div><div class="panel"><h2>Shelf analysis</h2><div class="table-wrap"><table><thead><tr><th>Monitored area</th><th>Visible stock</th><th>Empty space</th><th>Status</th><th>Last observation</th></tr></thead><tbody id="shelfTableRows"><tr><td colspan="5">Analyze a calibrated shelf video to see stock estimates.</td></tr></tbody></table></div></div>';
const shelfActivity=document.createElement('div');shelfActivity.className='panel shelf-activity';shelfActivity.innerHTML='<h2>Shelf activity</h2><p class="subtle">Visual changes appear while the video runs. Stock and restock claims require empty and stocked reference frames.</p><div class="table-wrap"><table><thead><tr><th>Video time</th><th>Observation</th><th>Visible stock</th><th>Evidence</th></tr></thead><tbody id="shelfActivityRows"><tr><td colspan="4">No shelf activity yet.</td></tr></tbody></table></div></div>';
shelfPage.append(shelfActivity);
const calibrationStatus=document.createElement('p');calibrationStatus.id='shelfCalibrationStatus';calibrationStatus.className='subtle';shelfPage.querySelector('.shelf-settings').append(calibrationStatus);
const demoButton=$('overviewDemo');demoButton.hidden=false;demoButton.textContent='Run sample shelf scenario';shelfPage.querySelector('.page-heading').append(demoButton);
dashboard.insertBefore(entryPage,$('visits'));
dashboard.insertBefore(shelfPage,$('visits'));
for(const id of ['video','visits','zones','events','operations','insights','privacy','recovery'])$(id).className='dashboard-section';
entryPage.append($('video'),$('visits'));
shelfPage.append($('zones'),$('events'),$('operations'),$('insights'));
const advancedZone=document.createElement('details');advancedZone.className='advanced-zone';advancedZone.innerHTML='<summary>Calibrate a different shelf video</summary><p class="subtle">Use the one video above: pause or seek to an empty frame and capture it, then seek to a stocked frame and capture it. Drag on that same video to adjust the shelf area.</p>';
advancedZone.append($('zones'));shelfPage.insertBefore(advancedZone,$('events'));
const seekControl=document.createElement('label');seekControl.className='seek-control';seekControl.innerHTML='Review frame <input id="videoSeek" type="range" min="0" max="100" step="0.1" value="0" aria-label="Seek video frame"><span id="videoSeekTime">0:00</span>';
$('videoProgress').parentElement.after(seekControl);
$('overview').append($('privacy'));
shelfPage.append($('recovery'));
for(const id of ['inspectObjects','inspectInteraction'])$(id).parentElement.classList.add('shelf-only');
$('inspectQueue').parentElement.classList.add('secondary-only');
const canvases={overview:$('overviewCanvas'),video:$('videoCanvas'),zone:$('zoneCanvas'),privacy:$('privacyCanvas')};
const contexts=Object.fromEntries(Object.entries(canvases).map(([key,canvas])=>[key,canvas.getContext('2d')]));
const sampleCanvas=document.createElement('canvas');sampleCanvas.width=6;sampleCanvas.height=3;
const sampleContext=sampleCanvas.getContext('2d',{willReadFrequently:true});
const syntheticCanvas=document.createElement('canvas');syntheticCanvas.width=640;syntheticCanvas.height=360;
const syntheticContext=syntheticCanvas.getContext('2d');
const state={page:'overview',queue:[],queueIndex:-1,source:null,running:false,paused:false,model:null,modelStatus:'Not loaded',modelVersion:'COCO-SSD lite MobileNet v2',failure:null,frames:0,fps:0,latency:null,lastInference:0,lastFrameAt:0,lastSampleAt:0,detected:[],tracks:new Map(),nextTrackId:1,heat:Array(96).fill(0),events:[],insights:[],samples:[],buffer:[],lastOutbound:null,lastSuccessfulEvent:null,privacyViolations:0,zones:[],selectedZone:null,refs:new Map(),shelfPercents:new Map(),previousVectors:new Map(),shelfObservations:[],calibrationError:null,lastStockStates:new Map(),queueCounts:new Map(),footfallIds:new Set(),dwellSamples:[],visitsByTrack:new Map(),visitEvidence:new Map(),visitSnapshot:{activeCount:0,opened:0,exited:0,expired:0,active:[]},guideStep:0,syntheticPercent:100,syntheticTimers:[],generation:0};
const availableRecordingIds=new Set(),lastQueueIndex={entry:-1,shelf:-1};
const visitLog=[];let visitNumber=0;const unmatchedExitIds=new Set();
const storeSummary={shelfPercent:null,shelfSimulated:false};
const recordingItem=entry=>({name:entry.title,recordingId:entry.id,url:'/recordings/'+entry.file,kind:'included',purpose:entry.purpose,preset:entry.calibration||null,shelfRoi:entry.shelfRoi||null,visitSample:!!entry.visitSample,exitOnly:!!entry.exitOnly,visitZones:entry.visitZones,detail:entry.detail});
const sourcePurpose=item=>item?.purpose||(item?.visitSample?'entry':'shelf');
let zoneCounter=1,eventCounter=1,inferenceBusy=false,calibrationPromise=Promise.resolve();
const videoReady=()=>state.source?.kind!=='synthetic'&&video.readyState>=2;
const currentMediaTime=()=>state.source?.kind==='synthetic'?(performance.now()-state.syntheticStarted)/1000:video.currentTime||0;
const zoneById=id=>state.zones.find(z=>z.id===id);
const formatTime=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
$('videoSeek').oninput=()=>{if(!state.source||state.source.kind==='synthetic'||!Number.isFinite(video.duration))return;state.running=false;state.paused=true;video.pause();video.currentTime=Number($('videoSeek').value)/100*video.duration;renderAll();};
const formatNumber=n=>Number.isFinite(n)?String(Math.round(n)):'Not available from current model';
let noticeTimer;
const status=(message,type='info')=>{const box=$('notice');clearTimeout(noticeTimer);box.textContent=message;box.hidden=!message;box.className='notice '+type;if(type==='info'&&message)noticeTimer=setTimeout(()=>{box.hidden=true;},5000);};

function showPage(page){
  if(!$(page))return;
  const tab=page==='overview'||page==='privacy'?'overview':page==='entry'||page==='visits'?'entry':page==='shelf'||['zones','events','operations','insights','recovery'].includes(page)?'shelf':sourcePurpose(state.source)==='entry'?'entry':'shelf';
  state.page=tab;
  if(tab==='entry'||tab==='shelf'){renderRecordingOptions(tab);ensureSourceForTab(tab);}
  if(tab==='entry')entryPage.insertBefore($('video'),entryPage.querySelector('.workflow-stats'));
  if(tab==='shelf')shelfPage.insertBefore($('video'),shelfPage.querySelector('.shelf-settings'));
  if(page==='zones')advancedZone.open=true;
  $('video').classList.toggle('entry-mode',tab==='entry');
  $('video').querySelector('h1').textContent=tab==='entry'?'Doorway video analyzer':'Shelf video analyzer';
  $('inspectPeople').closest('.panel').querySelector('h2').textContent=tab==='entry'?'Doorway detection':'Shelf detection';
  $('videoUseCaseDescription').textContent=tab==='entry'?'Doorway recordings only. Select one to load it, then start local entry and exit analysis.':'Shelf recordings only. Select one to load it, then start local shelf analysis.';
  for(const el of document.querySelectorAll('.page'))el.classList.toggle('active',el.id===tab);
  for(const el of document.querySelectorAll('.nav'))el.classList.toggle('active',el.dataset.target===tab);
  $('pageTitle').textContent={overview:'Overview',entry:'Entry & Exit',shelf:'Shelf Maintenance'}[tab];
  window.scrollTo(0,0);renderAll();
  if(!['overview','entry','shelf'].includes(page)&&!$(page).closest('[hidden]'))$(page).scrollIntoView({behavior:'smooth',block:'start'});
}
for(const button of document.querySelectorAll('.nav'))button.onclick=()=>showPage(button.dataset.target);
for(const button of document.querySelectorAll('[data-go]'))button.onclick=()=>showPage(button.dataset.go);
$('themeButton').onclick=()=>{document.body.classList.toggle('dark');$('themeButton').textContent=document.body.classList.contains('dark')?'Light mode':'Dark mode';};

function renderSynthetic(ctx){
  ctx.fillStyle='#263d34';ctx.fillRect(0,0,640,360);
  ctx.fillStyle='#5d7461';ctx.fillRect(130,55,380,260);
  ctx.fillStyle='#dce1d7';ctx.fillRect(156,86,330,196);
  const count=Math.round(state.syntheticPercent/100*18);
  for(let i=0;i<18;i++){
    const col=i%6,row=Math.floor(i/6),x=166+col*52,y=93+row*59;
    ctx.fillStyle=count>i?['#b87d47','#7fa784','#cfb55b'][row]:'#d5ddd3';ctx.fillRect(x,y,35,43);
  }
  ctx.fillStyle='#1f4234';ctx.font='bold 16px Segoe UI';ctx.fillText('SYNTHETIC SHELF · SIMULATED',164,39);
}
function drawFrame(ctx,withBoxes=true){
  ctx.clearRect(0,0,640,360);
  if(state.source?.kind==='synthetic')renderSynthetic(ctx);
  else if(videoReady())ctx.drawImage(video,0,0,640,360);
  else{ctx.fillStyle='#1d322a';ctx.fillRect(0,0,640,360);ctx.fillStyle='#b2c7b8';ctx.font='16px Segoe UI';ctx.fillText('Choose a video or run the guided demo',32,180);}
  for(const zone of state.zones){
    const color=zone.type==='shelf'?'#79b78c':zone.type==='queue'?'#a690e1':zone.type==='entrance'?'#54c6b2':zone.type==='exit'?'#efa66d':'#9eb2ab';
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(zone.x*640,zone.y*360,zone.w*640,zone.h*360);ctx.setLineDash([]);
    ctx.fillStyle=color;ctx.font='11px Segoe UI';ctx.fillText(zone.name,zone.x*640+4,zone.y*360+14);
  }
  if(withBoxes&&state.source?.kind!=='synthetic')for(const detection of state.detected){
    const [x,y,w,h]=detection.bbox;ctx.strokeStyle=detection.class==='person'?'#67a8ed':'#e9ad59';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);
    ctx.fillStyle=ctx.strokeStyle;ctx.font='11px Segoe UI';ctx.fillText(`${detection.class} ${Math.round(detection.score*100)}%`,x+2,Math.max(12,y-3));
  }
}
function renderCanvas(){drawFrame(contexts.video,true);requestAnimationFrame(renderCanvas);}

function clearTimers(){for(const timer of state.syntheticTimers)clearTimeout(timer);state.syntheticTimers=[];}
function resetAnalysis(keepQueue=true,clearVisitStore=true){
  state.generation++;clearTimers();state.running=false;state.paused=false;video.pause();unmatchedExitIds.clear();
  state.frames=0;state.fps=0;state.latency=null;state.lastInference=0;state.lastFrameAt=0;state.lastSampleAt=0;state.detected=[];state.tracks.clear();state.nextTrackId=1;state.heat.fill(0);state.events=[];state.selectedEvidence=null;state.insights=[];state.samples=[];state.buffer=[];state.lastOutbound=null;state.lastSuccessfulEvent=null;state.privacyViolations=0;state.previousVectors.clear();state.shelfObservations=[];state.calibrationError=null;state.shelfPercents.clear();state.lastStockStates.clear();state.queueCounts.clear();state.footfallIds.clear();state.dwellSamples=[];state.visitsByTrack.clear();if(clearVisitStore){state.visitEvidence.clear();state.visitSnapshot={activeCount:0,opened:0,exited:0,expired:0,active:[]};void clearVisits();}state.failure=null;state.guideStep=0;cooldown.clear();
  if(!keepQueue){for(const item of state.queue)if(item.url?.startsWith('blob:'))URL.revokeObjectURL(item.url);state.queue=[];state.queueIndex=-1;lastQueueIndex.entry=-1;lastQueueIndex.shelf=-1;state.source=null;video.removeAttribute('src');video.load();state.refs.clear();}
  renderAll();
}

function sampleShelf(zone){
  const synthetic=state.source?.kind==='synthetic';if(synthetic)renderSynthetic(syntheticContext);
  const input=synthetic?syntheticCanvas:video,width=synthetic?640:video.videoWidth,height=synthetic?360:video.videoHeight;
  sampleContext.drawImage(input,zone.x*width,zone.y*height,zone.w*width,zone.h*height,0,0,6,3);
  const rgba=sampleContext.getImageData(0,0,6,3).data;
  return Array.from(rgba).filter((_,i)=>i%4!==3);
}

function zoneDefaults(type='shelf'){
  return {id:`zone-${zoneCounter++}`,name:type==='shelf'?'Shelf A':type==='queue'?'Checkout':type==='entrance'?'Entrance':type==='exit'?'Exit':'New zone',type,detection:type==='shelf'?'shelf':'people',x:.42,y:.4,w:.32,h:.32,dwell:15,queue:4,shelf:25};
}
function renderZones(){
  $('zoneList').replaceChildren(...state.zones.map(zone=>{const b=document.createElement('button');b.textContent=zone.name+' · '+zone.type;b.className=zone.id===state.selectedZone?'selected':'';b.onclick=()=>{state.selectedZone=zone.id;renderZones();};return b;}));
  const zone=zoneById(state.selectedZone);$('zoneForm').hidden=!zone;
  if(zone){for(const [id,value] of [['zoneName',zone.name],['zoneType',zone.type],['zoneDetection',zone.detection],['zoneDwell',zone.dwell],['zoneQueue',zone.queue],['zoneShelf',zone.shelf]])$(id).value=value;}
  $('zoneMessage').textContent=zone?`${zone.name}: rectangle ${Math.round(zone.x*100)}%, ${Math.round(zone.y*100)}%, ${Math.round(zone.w*100)}% × ${Math.round(zone.h*100)}%. Rules apply to the current video session.`:'Add a zone, then drag on the frame.';
  const shelfZone=state.zones.find(item=>item.type==='shelf');if(shelfZone)$('shelfLimitInput').value=String(shelfZone.shelf);
}

$('newZone').onclick=()=>{const zone=zoneDefaults('shelf');zone.name=`Zone ${state.zones.length+1}`;state.zones.push(zone);state.selectedZone=zone.id;renderZones();renderAll();};
$('removeZone').onclick=()=>{if(!state.selectedZone)return;state.zones=state.zones.filter(z=>z.id!==state.selectedZone);state.refs.delete(state.selectedZone);state.selectedZone=state.zones[0]?.id||null;renderZones();renderAll();};
$('zoneForm').onsubmit=event=>{event.preventDefault();const zone=zoneById(state.selectedZone);if(!zone)return;const name=$('zoneName').value.trim();if(!/^[A-Za-z0-9 _-]{1,32}$/.test(name)){status('Zone names can use letters, numbers, spaces, hyphens, and underscores.','warning');return;}zone.name=name;zone.type=$('zoneType').value;zone.detection=$('zoneDetection').value;zone.dwell=clamp(Number($('zoneDwell').value),1,600);zone.queue=clamp(Number($('zoneQueue').value),1,30);zone.shelf=clamp(Number($('zoneShelf').value),1,90);state.refs.delete(zone.id);renderZones();renderAll();status('Zone rules saved. Recalibrate a changed shelf zone.');};
$('saveShelfLimit').onclick=()=>{const zone=state.zones.find(item=>item.type==='shelf');if(!zone)return status('Load a shelf recording first.','warning');const limit=Number($('shelfLimitInput').value);if(!Number.isInteger(limit)||limit<1||limit>90)return status('Choose a stock limit between 1% and 90%.','warning');zone.shelf=limit;renderZones();renderAll();status(`Low-stock limit saved at ${limit}%.`);};
let drawStart=null;
function startZoneDrag(event){if(event.currentTarget===canvases.video&&(!advancedZone.open||state.page!=='shelf'))return;const rect=event.currentTarget.getBoundingClientRect();drawStart={x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1)};event.currentTarget.setPointerCapture(event.pointerId);}
function endZoneDrag(event){if(!drawStart)return;const rect=event.currentTarget.getBoundingClientRect(),end={x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1)};const x=Math.min(drawStart.x,end.x),y=Math.min(drawStart.y,end.y),w=Math.abs(end.x-drawStart.x),h=Math.abs(end.y-drawStart.y);drawStart=null;if(w<.04||h<.04)return status('Draw a larger rectangle.','warning');let zone=zoneById(state.selectedZone);if(!zone){zone=zoneDefaults();state.zones.push(zone);state.selectedZone=zone.id;}Object.assign(zone,{x,y,w,h});state.refs.delete(zone.id);renderZones();renderAll();status(`${zone.name} area updated. Capture new shelf references if needed.`);}
for(const canvas of [canvases.zone,canvases.video]){canvas.onpointerdown=startZoneDrag;canvas.onpointerup=endZoneDrag;}

function renderQueue(){
  const purpose=state.page==='entry'?'entry':'shelf',box=$('videoQueue');
  const items=state.queue.map((item,index)=>({item,index})).filter(({item})=>sourcePurpose(item)===purpose);
  if(!items.length){box.textContent=purpose==='entry'?'No doorway recordings queued. Choose a doorway sample above.':'No shelf recordings queued. Choose a shelf clip above.';return;}
  box.replaceChildren(...items.map(({item,index})=>{const button=document.createElement('button');button.textContent=`${item.name} · ${item.status}`;button.className=index===state.queueIndex?'selected':'';button.onclick=()=>loadSource(index);return button;}));
}
function addQueueItem(item){state.queue.push({...item,purpose:sourcePurpose(item),id:crypto.randomUUID(),status:'Ready'});loadSource(state.queue.length-1);}
function activateRecording(entry){const existing=state.queue.findIndex(item=>item.recordingId===entry.id);if(existing>=0)loadSource(existing);else addQueueItem(recordingItem(entry));}
function renderRecordingOptions(purpose){
  const select=$('includedSelect'),current=state.source?.recordingId;
  select.replaceChildren();
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=purpose==='entry'?'Choose doorway video':'Choose shelf video';select.append(placeholder);
  for(const entry of recordings.filter(item=>item.purpose===purpose&&availableRecordingIds.has(item.id))){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.title;select.append(option);}
  select.value=current&&recordings.some(item=>item.id===current&&item.purpose===purpose)?current:'';
  $('includedLabel').textContent=purpose==='entry'?'Doorway recording':'Shelf recording';
}
function ensureSourceForTab(purpose){
  if(sourcePurpose(state.source)===purpose&&state.source)return;
  const previous=lastQueueIndex[purpose];
  if(previous>=0&&state.queue[previous]){loadSource(previous);return;}
  const preferred=purpose==='entry'?'store-entrance':'clip-03';
  const entry=recordings.find(item=>item.id===preferred&&availableRecordingIds.has(item.id))||recordings.find(item=>item.purpose===purpose&&availableRecordingIds.has(item.id));
  if(entry)activateRecording(entry);
  else{state.running=false;video.pause();video.removeAttribute('src');video.load();state.source=null;$('sessionName').textContent='No video selected';renderAll();}
}
function loadSelectedRecording(){const id=$('includedSelect').value,entry=recordings.find(item=>item.id===id);if(!entry||!availableRecordingIds.has(id))return status('Choose an available recording for this page.','warning');if(entry.purpose!==state.page)return status('This recording belongs to the other use case.','warning');activateRecording(entry);status(`${entry.title} loaded. Press Start Analysis.`);}
$('videoFiles').onchange=()=>{for(const file of $('videoFiles').files){if(!/\.(mp4|webm)$/i.test(file.name))continue;addQueueItem({name:file.name,url:URL.createObjectURL(file),kind:'local',purpose:state.page==='entry'?'entry':'shelf'});}$('videoFiles').value='';};
$('includedSelect').onchange=loadSelectedRecording;
$('addIncluded').textContent='Reload selected video';$('addIncluded').onclick=loadSelectedRecording;
$('loadEntranceSample').onclick=()=>{const entry=recordings.find(item=>item.id==='store-entrance');if(!availableRecordingIds.has(entry.id))return status('The grocery entrance sample is unavailable on this server.','warning');activateRecording(entry);showPage('entry');status('Grocery doorway video loaded. Press Start Analysis. Adjust the zones before relying on counts.');};
function renderRecordingCards(purpose){
  const container=$(purpose==='entry'?'entryClipList':'shelfClipList');
  const entries=recordings.filter(item=>item.purpose===purpose&&availableRecordingIds.has(item.id));
  if(!entries.length){container.textContent=`No ${purpose==='entry'?'doorway':'shelf'} recordings are available on this server.`;return;}
  container.replaceChildren(...entries.map(entry=>{
    const button=document.createElement('button');button.className='recording-card';button.dataset.recordingId=entry.id;
    const label=document.createElement('strong');label.textContent=entry.title;
    const detail=document.createElement('small');detail.textContent=entry.detail;
    button.append(label,detail);
    button.onclick=()=>{activateRecording(entry);showPage(purpose);status(`${entry.title} loaded. Press Start Analysis.`);};
    return button;
  }));
}
async function loadIncludedLibrary(){
  try{
    const response=await fetch('/api/recordings');if(!response.ok)throw Error('Recording library unavailable');
    const data=await response.json();for(const id of data.available)availableRecordingIds.add(id);
    renderRecordingCards('entry');renderRecordingCards('shelf');
    renderRecordingOptions(state.page==='entry'?'entry':'shelf');
    if(state.page==='entry'||state.page==='shelf')ensureSourceForTab(state.page);
  }catch{status('Included recording library unavailable. Upload a local file or run the synthetic demo.','warning');}
}
function loadSource(index){
  if(index<0||index>=state.queue.length)return;
  const next=state.queue[index],purpose=sourcePurpose(next);
  resetAnalysis(true,false);state.refs.clear();state.queueIndex=index;state.source=next;state.source.status='Loaded';lastQueueIndex[purpose]=index;
  if(purpose==='entry'){state.zones=(next.exitOnly?['exit']:['entrance','exit']).map(type=>{const zone=zoneDefaults(type);[zone.x,zone.y,zone.w,zone.h]=next.visitZones?.[type]||(type==='entrance'?[.2,.35,.25,.6]:[.56,.35,.25,.6]);return zone;});state.selectedZone=state.zones[0].id;}
  else {const zone=zoneDefaults('shelf');if(next.shelfRoi)[zone.x,zone.y,zone.w,zone.h]=next.shelfRoi.map(value=>value/100);state.zones=[zone];state.selectedZone=zone.id;}
  renderZones();video.src=state.source.url;video.load();$('sessionName').textContent=state.source.name;$('recordingDetail').textContent=state.source.detail||'Local video selected in this browser.';$('visitsSourceNote').textContent=purpose==='entry'?'Doorway zones are estimates. The clip may show entrances without the same person leaving. Exits count only when one continuous temporary track crosses the Exit zone.':'Load a doorway recording on Entry & Exit to count visits.';renderRecordingOptions(purpose);for(const card of document.querySelectorAll('.recording-card'))card.classList.toggle('selected',card.dataset.recordingId===next.recordingId);status('Video loaded. Configure zones, then start local analysis.');renderAll();
}
async function seekTo(seconds){return new Promise((resolve,reject)=>{if(!Number.isFinite(video.duration)||video.duration<=0)return reject(Error('Video has no seekable frames'));const target=clamp(seconds,0,Math.max(0,video.duration-.1));if(Math.abs(video.currentTime-target)<.03)return resolve();let timer;const cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',onSeeked);video.removeEventListener('error',onError);};const onSeeked=()=>{cleanup();resolve();},onError=()=>{cleanup();reject(Error('Video seek failed'));};timer=setTimeout(()=>{cleanup();reject(Error('Video seek timed out'));},5000);video.addEventListener('seeked',onSeeked);video.addEventListener('error',onError);video.currentTime=target;});}
async function autoCalibrate(preset,generation){
  const zone=state.zones.find(z=>z.type==='shelf');if(!zone||!preset)return;
  [zone.x,zone.y,zone.w,zone.h]=preset.roi.map(n=>n/100);renderZones();
  await seekTo(preset.emptyAt);if(generation!==state.generation)return;drawFrame(contexts.video,false);const empty=sampleShelf(zone);
  await seekTo(preset.fullAt);if(generation!==state.generation)return;drawFrame(contexts.video,false);const full=sampleShelf(zone);
  await seekTo(0);if(generation!==state.generation)return;state.refs.set(zone.id,{empty,full});$('referenceStatus').textContent=`${zone.name}: empty and stocked reference frames captured automatically.`;status('Shelf references ready. Press Start Analysis.');renderAll();
}
video.onloadedmetadata=()=>{if(!state.source)return;const generation=state.generation;calibrationPromise=(async()=>{try{if(state.source.preset)await autoCalibrate(state.source.preset,generation);}catch(error){state.calibrationError=error.message;status('Automatic shelf calibration was unavailable. Capture references manually.','warning');}renderAll();})();};
video.onerror=()=>{$('videoError').textContent='This video could not be decoded. Choose an H.264 MP4 or WebM file.';state.source&&(state.source.status='Corrupt');state.running=false;renderAll();};
video.onended=()=>{state.running=false;state.paused=false;if(state.source)state.source.status='Complete';renderAll();};
$('captureEmpty').onclick=()=>captureReference('empty');$('captureStocked').onclick=()=>captureReference('full');
function captureReference(kind){const zone=zoneById(state.selectedZone);if(!zone||zone.type!=='shelf')return status('Select a shelf zone first.','warning');if(!videoReady()&&state.source?.kind!=='synthetic')return status('Load a video frame first.','warning');state.running=false;video.pause();const refs=state.refs.get(zone.id)||{};refs[kind]=sampleShelf(zone);state.refs.set(zone.id,refs);$('referenceStatus').textContent=`${zone.name}: empty ${refs.empty?'captured':'needed'} · stocked ${refs.full?'captured':'needed'}.`;status(`${kind==='full'?'Stocked':'Empty'} reference captured locally.`);renderAll();}
$('nextVideo').onclick=()=>{const purpose=state.page==='entry'?'entry':'shelf',indexes=state.queue.map((item,index)=>sourcePurpose(item)===purpose?index:-1).filter(index=>index>=0);if(!indexes.length)return status('No next video for this page.','warning');const current=indexes.indexOf(state.queueIndex);loadSource(indexes[(current+1)%indexes.length]);};
$('pauseAnalysis').onclick=()=>{state.running=false;state.paused=true;video.pause();clearTimers();if(state.source)state.source.status='Paused';renderAll();};
$('stopAnalysis').onclick=()=>{state.running=false;state.paused=false;video.pause();clearTimers();if(state.source)state.source.status='Stopped';renderAll();};
$('resetAnalysis').onclick=()=>{
  const purpose=state.page==='entry'?'entry':'shelf',other=purpose==='entry'?'shelf':'entry',otherItem=state.queue[lastQueueIndex[other]];
  resetAnalysis(true,purpose==='entry');
  for(const item of state.queue.filter(item=>sourcePurpose(item)===purpose))if(item.url?.startsWith('blob:'))URL.revokeObjectURL(item.url);
  state.queue=state.queue.filter(item=>sourcePurpose(item)!==purpose);
  lastQueueIndex[purpose]=-1;lastQueueIndex[other]=otherItem?state.queue.indexOf(otherItem):-1;
  state.queueIndex=-1;state.source=null;video.removeAttribute('src');video.load();state.refs.clear();
  $('sessionName').textContent='No video selected';renderRecordingOptions(purpose);for(const card of document.querySelectorAll('.recording-card'))card.classList.remove('selected');renderAll();status('This use case was reset. The other recording list remains available.');
};

const eventTitles={PERSON_ENTERED:'Entrance crossing',PERSON_EXITED:'Exit crossing',DWELL_THRESHOLD:'Dwell threshold reached',PRODUCT_INTERACTION:'Possible shelf interaction',PRODUCT_REMOVED:'Possible product removal',PRODUCT_RETURNED:'Possible product return',SHELF_LOW:'Shelf running low',SHELF_EMPTY:'Shelf empty',RESTOCK_DETECTED:'Restock inferred',QUEUE_BUILDUP:'Queue buildup',LONG_WAIT:'Long observed wait',CHECKOUT_CONGESTION:'Checkout congestion'};
const actionFor=type=>({SHELF_LOW:'Check shelf stock and prepare replenishment.',SHELF_EMPTY:'Replenish this shelf now.',RESTOCK_DETECTED:'Confirm the shelf is ready for shoppers.',PRODUCT_REMOVED:'Review shelf stock after the interaction.',QUEUE_BUILDUP:'Open another checkout if staff are available.',LONG_WAIT:'Send support to checkout.',CHECKOUT_CONGESTION:'Review checkout staffing.'})[type]||null;
const cooldown=new Map();
function addEvent(type,zone,confidence,value,why,rule){
  if(!zone)return;
  const mediaTime=currentMediaTime(),key=type+':'+zone.id;
  if(!type.startsWith('PERSON_')&&mediaTime-(cooldown.get(key)??-100)<4)return;
  cooldown.set(key,mediaTime);
  const event={id:eventCounter++,type,zone:zone.name,confidence:clamp(confidence,0,1),value,mediaTime,why,rule,action:actionFor(type),source:state.source?.name||'Synthetic demo',simulated:state.source?.kind==='synthetic',status:'Local only',privacy:'Pending'};
  state.events.unshift(event);if(state.events.length>100)state.events.length=100;
  const payload=safeOutbound(event),check=validateEvent(payload);
  if(!check.ok||state.failure==='privacy'){event.privacy='BLOCKED';event.status=state.failure==='privacy'?'Privacy filter unavailable':check.reason;state.privacyViolations++;renderAll();return;}
  state.lastOutbound=payload;event.privacy='PASS';
  if(state.failure==='network'||state.failure==='stream'){state.buffer.push({payload,event});event.status='Buffered locally';renderAll();return;}
  sendPayload(payload,event);renderAll();
}
async function sendPayload(payload,event){
  try{const response=await fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});if(!response.ok)throw Error(`Receiver ${response.status}`);event.status='Sent to local receiver';state.lastSuccessfulEvent=new Date();}
  catch{event.status='Buffered locally';state.buffer.push({payload,event});}renderAll();
}
async function flushBuffer(){if(state.failure==='network'||state.failure==='stream'||state.failure==='privacy')return;const pending=state.buffer.splice(0);for(const item of pending)await sendPayload(item.payload,item.event);}

async function visitRequest(path,payload){const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok||!data.ok)throw Error(data.reason||`Visit receiver ${response.status}`);return data;}
async function fetchVisits(){try{const response=await fetch('/api/visits');if(!response.ok)return;const data=await response.json();if(!Array.isArray(data.active))return;state.visitSnapshot=data;renderVisits();$('overviewVisits').textContent=String(data.activeCount);$('overviewEntered').textContent=String(data.opened);$('overviewExited').textContent=String(data.exited);}catch{$('visitsRows').textContent='Local visit receiver unavailable.';}}
async function clearVisits(){try{await visitRequest('/api/visits/clear',{type:'visit_clear'});await fetchVisits();}catch{/* The server may be restarting; visible status is refreshed by polling. */}}
function showVideoMoment(seconds){
  if(!state.source||state.source.kind==='synthetic'||!Number.isFinite(seconds))return;
  state.running=false;state.paused=true;video.pause();
  if(Number.isFinite(video.duration))video.currentTime=clamp(seconds,0,Math.max(0,video.duration-.1));
  state.source.status='Paused at evidence';showPage('video');status(`Video paused at ${formatTime(seconds)}. Press Start Analysis to continue.`);
}
function openVisit(track,zone){
  const generation=state.generation;
  const evidence={sourceId:state.source?.id,mediaTime:currentMediaTime(),zone:zone.name};
  const pending=(async()=>{try{const result=await visitRequest('/api/visits/open',{type:'visit_open'});if(generation!==state.generation){await visitRequest('/api/visits/close',{type:'visit_close',visitId:result.visitId});return null;}state.visitEvidence.set(result.visitId,evidence);visitLog.unshift({number:++visitNumber,visitId:result.visitId,enteredAt:new Date(),entryTime:evidence.mediaTime,sourceId:evidence.sourceId,status:'Inside'});state.footfallIds.add(track.id);addEvent('PERSON_ENTERED',zone,track.score,1,'A temporary person track crossed from outside the configured entrance zone into it.','Observed entrance-zone transition; random server visit token created.');await fetchVisits();return result.visitId;}catch{status('An entrance crossing was seen, but the local visit receiver could not create a record.','warning');return null;}})();
  state.visitsByTrack.set(track.id,pending);
}
async function closeVisit(track,zone){
  const pending=state.visitsByTrack.get(track.id);if(!pending)return;state.visitsByTrack.delete(track.id);
  try{const visitId=await pending;if(!visitId)return;await visitRequest('/api/visits/close',{type:'visit_close',visitId});state.visitEvidence.delete(visitId);const row=visitLog.find(item=>item.visitId===visitId);if(row){row.exitedAt=new Date();row.status='Exited';delete row.visitId;}addEvent('PERSON_EXITED',zone,track.score,1,'The same temporary track crossed the configured exit zone; its server record was deleted.','Observed exit-zone transition; matching anonymous visit token removed.');await fetchVisits();}catch{status('Exit crossing seen, but the visit record could not be deleted. It will expire automatically.','warning');}
}
function observeUnmatchedExit(track){
  if(unmatchedExitIds.has(track.id))return;
  unmatchedExitIds.add(track.id);
  visitLog.unshift({number:++visitNumber,enteredAt:null,exitedAt:new Date(),entryTime:currentMediaTime(),sourceId:state.source?.id,status:'Exit seen · no matching entry'});
  if(visitLog.length>100)visitLog.length=100;
  renderVisits();
}
function renderVisits(){
  const visits=state.visitSnapshot;
  $('entryInside').textContent=String(visits.activeCount);$('entryEntered').textContent=String(visits.opened);$('entryExited').textContent=String(visits.exited);$('entryTimedOut').textContent=String(visits.expired);
  const activeIds=new Set(visits.active.map(item=>item.visitId));for(const item of visitLog)if(item.status==='Inside'&&!activeIds.has(item.visitId)){item.status='Timed out or reset';delete item.visitId;}
  $('exitOnlyCount').textContent=state.source?.exitOnly?`${visitLog.filter(item=>item.sourceId===state.source?.id&&item.status.startsWith('Exit seen')).length} exit-only observations in this video. These do not reduce the inside count because no matching entry was seen.`:'';
  const table=$('entryTableRows');table.replaceChildren();if(!visitLog.length){const row=document.createElement('tr'),cell=node('td','No observed crossings yet. Start a doorway video.');cell.colSpan=5;row.append(cell);table.append(row);}else for(const item of visitLog.slice(0,30)){const row=document.createElement('tr');for(const value of [`${item.enteredAt?'Visit':'Exit observation'} ${item.number}`,item.enteredAt?.toLocaleTimeString()||'—',item.exitedAt?.toLocaleTimeString()||'—',item.status])row.append(node('td',value));const cell=document.createElement('td');if(item.sourceId===state.source?.id){const button=node('button',`Video ${formatTime(item.entryTime)}`);button.onclick=()=>showVideoMoment(item.entryTime);cell.append(button);}else cell.textContent='Previous video';row.append(cell);table.append(row);}
  $('visitsActive').textContent=String(visits.activeCount);
  $('visitsOpened').textContent=String(visits.opened);
  $('visitsExited').textContent=String(visits.exited);
  $('visitsExpired').textContent=String(visits.expired);
  $('visitsRows').replaceChildren(...(visits.active.length?visits.active.map(visit=>{
    const row=document.createElement('div');row.className='visit-row';
    const id=document.createElement('code');id.textContent=`Visit ${visit.visitId.slice(0,8)}`;
    const time=document.createElement('span');time.textContent=`Entered ${new Date(visit.enteredAt).toLocaleTimeString()}`;
    const waiting=document.createElement('span');waiting.textContent='Awaiting observed exit';
    row.append(id,time,waiting);
    const evidence=state.visitEvidence.get(visit.visitId);
    if(evidence?.sourceId===state.source?.id){const button=document.createElement('button');button.textContent=`View entry at ${formatTime(evidence.mediaTime)}`;button.onclick=()=>showVideoMoment(evidence.mediaTime);row.append(button);}
    return row;
  }):[document.createTextNode('No one currently counted inside. An observed exit deletes its record; an unobserved exit times out after two minutes.')]));
  const crossings=state.events.filter(event=>event.type==='PERSON_ENTERED'||event.type==='PERSON_EXITED').slice(0,20);
  $('visitTimeline').replaceChildren(...(crossings.length?crossings.map(event=>{
    const row=document.createElement('div');row.className='visit-row';
    const label=document.createElement('strong');label.textContent=event.type==='PERSON_EXITED'?'EXIT · record deleted':'ENTRY · record opened';
    const time=document.createElement('span');time.textContent=`Video ${formatTime(event.mediaTime)} · ${event.zone}`;
    row.append(label,time);
    if(!event.simulated&&event.source===state.source?.name){const button=document.createElement('button');button.textContent='View video evidence';button.onclick=()=>showVideoMoment(event.mediaTime);row.append(button);}
    return row;
  }):[document.createTextNode('No crossing observed yet. Start the video analyzer above.')]));
}
setInterval(()=>{void fetchVisits();},2000);

function addSample(){const t=currentMediaTime();state.samples.push({time:t,people:state.detected.filter(d=>d.class==='person').length,queue:[...state.queueCounts.values()].reduce((a,b)=>a+b,0)});if(state.samples.length>120)state.samples.shift();}
function analyzePeople(detections){
  const people=detections.filter(d=>d.class==='person');
  const previousZones=new Map([...state.tracks].map(([id,track])=>[id,track.zoneId]));
  const result=updateTemporaryTracks(state.tracks,people,currentMediaTime(),state.zones,state.nextTrackId);state.tracks=result.tracks;state.nextTrackId=result.nextId;
  const changed=new Set(result.entered);
  for(const id of state.visitsByTrack.keys())if(!state.tracks.has(id))state.visitsByTrack.delete(id);
  state.queueCounts.clear();
  for(const track of state.tracks.values()){
    const zone=zoneById(track.zoneId);if(!zone)continue;
    const hx=Math.min(11,Math.floor(track.x*12)),hy=Math.min(7,Math.floor(track.y*8));state.heat[hy*12+hx]++;
    if(changed.has(track.id)&&state.source?.exitOnly&&zone.type==='exit'&&previousZones.has(track.id)&&previousZones.get(track.id)!==zone.id){observeUnmatchedExit(track);}
    if(changed.has(track.id)&&!state.source?.exitOnly&&state.zones.some(z=>z.type==='entrance')&&state.zones.some(z=>z.type==='exit')){
      const previousType=zoneById(previousZones.get(track.id))?.type||null;
      const transition=visitTransition(previousType,zone.type,previousZones.has(track.id),state.visitsByTrack.has(track.id));
      if(transition==='enter')openVisit(track,zone);
      if(transition==='exit')void closeVisit(track,zone);
    }
    if(zone.type==='queue'){
      state.queueCounts.set(zone.id,(state.queueCounts.get(zone.id)||0)+1);
      const dwell=currentMediaTime()-track.zoneEnteredAt;
      if(dwell>=zone.dwell&&(!track.lastDwellEventAt||currentMediaTime()-track.lastDwellEventAt>zone.dwell)){track.lastDwellEventAt=currentMediaTime();state.dwellSamples.push(dwell);addEvent('LONG_WAIT',zone,track.score,Math.round(dwell),`Temporary local track remained in ${zone.name} for ${Math.round(dwell)} video seconds.`,`Observed queue dwell ≥ ${zone.dwell} seconds.`);}
    }else if(zone.type==='promotion'&&currentMediaTime()-track.zoneEnteredAt>=zone.dwell&&!track.lastDwellEventAt){track.lastDwellEventAt=currentMediaTime();state.dwellSamples.push(currentMediaTime()-track.zoneEnteredAt);addEvent('DWELL_THRESHOLD',zone,track.score,Math.round(currentMediaTime()-track.zoneEnteredAt),'Person box stayed in this zone.','Configured dwell threshold reached.');}
  }
  for(const zone of state.zones.filter(z=>z.type==='queue')){const count=state.queueCounts.get(zone.id)||0;if(count>=zone.queue)addEvent('QUEUE_BUILDUP',zone,.8,count,`${count} person boxes have footpoints in the checkout zone.`,`Queue count ≥ configured ${zone.queue}.`);}
}
function analyzeShelves(){
  for(const zone of state.zones.filter(z=>z.type==='shelf')){
    let frame;try{frame=sampleShelf(zone);}catch{continue;}
    const previousFrame=state.previousVectors.get(zone.id);
    if(!previousFrame){state.shelfObservations.unshift({mediaTime:currentMediaTime(),label:'Shelf monitoring started',why:'The selected shelf area is being sampled locally.'});}
    else if(localizedMotion(frame,previousFrame)&&currentMediaTime()-(state.shelfObservations.find(item=>item.label==='Visual change observed')?.mediaTime??-100)>=2){state.shelfObservations.unshift({mediaTime:currentMediaTime(),label:'Visual change observed',why:'Pixels changed in the monitored shelf area. This alone does not prove a product was removed or restocked.'});}
    if(state.shelfObservations.length>30)state.shelfObservations.length=30;
    state.previousVectors.set(zone.id,frame);
    const refs=state.refs.get(zone.id);if(!refs?.empty||!refs?.full)continue;
    let percent;try{percent=occupancy(frame,refs.empty,refs.full).percent;}catch{continue;}
    if(!Number.isFinite(percent))continue;
    percent=clamp(percent,0,100);const previous=state.shelfPercents.get(zone.id);state.shelfPercents.set(zone.id,percent);
    const rule=shelfRule(previous,percent,zone.shelf);
    if(rule){let why=`Shelf image matches ${Math.round(percent)}% of the locally captured stocked reference.`;if(rule==='PRODUCT_REMOVED')why=`Shelf occupancy fell from ${Math.round(previous)}% to ${Math.round(percent)}%. This is a shelf change inference, not an identified product.`;if(rule==='RESTOCK_DETECTED')why=`Shelf occupancy rose from ${Math.round(previous)}% to ${Math.round(percent)}%.`;
      addEvent(rule,zone,.75,Math.round(percent),why,`Compare current shelf crop with empty and stocked references; threshold ${zone.shelf}%.`);}
    const stock=percent<=15?'empty':percent<=zone.shelf?'low':'stocked';const prior=state.lastStockStates.get(zone.id);state.lastStockStates.set(zone.id,stock);
    if(prior===undefined&&stock!=='stocked')addEvent(stock==='empty'?'SHELF_EMPTY':'SHELF_LOW',zone,.75,Math.round(percent),`Current shelf crop is ${Math.round(percent)}% stocked relative to local reference.`,`Initial calibrated frame below ${zone.shelf}% threshold.`);
    const hasPerson=[...state.tracks.values()].some(t=>t.zoneId===zone.id);
    if(hasPerson&&Number.isFinite(previous)&&Math.abs(percent-previous)>=12)addEvent('PRODUCT_INTERACTION',zone,.65,Math.round(Math.abs(percent-previous)),'A person box overlapped this shelf while the shelf image changed.','Person overlap and ≥12% shelf change.');
  }
}
async function inferenceTick(){
  if(!state.running||!videoReady()||inferenceBusy||state.failure==='camera'||state.failure==='corrupt')return;
  const now=performance.now();if(now-state.lastInference<550)return;state.lastInference=now;inferenceBusy=true;
  try{
    if(state.model&&state.failure!=='model'){
      const started=performance.now(),raw=await state.model.detect(video,20,.4);state.latency=Math.round(performance.now()-started);
      if(!state.running)return;
      const sx=640/video.videoWidth,sy=360/video.videoHeight;
      state.detected=raw.map(d=>({class:d.class,score:d.score,bbox:[d.bbox[0]*sx,d.bbox[1]*sy,d.bbox[2]*sx,d.bbox[3]*sy]}));analyzePeople(state.detected);
    }else state.detected=[];
    analyzeShelves();state.frames++;state.fps=state.lastFrameAt?Math.round(1000/Math.max(1,performance.now()-state.lastFrameAt)):0;state.lastFrameAt=performance.now();addSample();renderAll();
  }catch(error){state.modelStatus='Unavailable: '+error.message;state.model=null;state.detected=[];analyzeShelves();renderAll();}
  finally{inferenceBusy=false;}
}
async function startAnalysis(){
  if(!state.source)return status('Add a video or run the guided synthetic demo first.','warning');
  if(state.failure==='camera'||state.failure==='corrupt')return status('Restore the video feed before starting.','warning');
  if(state.source.kind==='synthetic'){runSynthetic();return;}
  if(video.readyState<1)return status('Video is still loading. Start analysis once its first frame appears.','warning');
  const generation=state.generation;await calibrationPromise;if(generation!==state.generation)return;
  if(video.error)return status('This video cannot be played. Choose another recording.','warning');
  $('videoError').textContent='';
  if(video.ended||video.duration&&video.currentTime>=video.duration-.1)video.currentTime=0;
  try{await video.play();}catch(error){return status('The browser could not play this video: '+error.message,'warning');}
  state.running=true;state.paused=false;state.source.status='Analyzing';renderAll();
  if(!state.model&&state.failure!=='model'){
    state.modelStatus='Loading bundled model';renderAll();
    try{state.model=await loadLocalDetector();state.modelStatus='Ready · bundled local model';}
    catch(error){state.modelStatus='Unavailable: '+error.message;status('Person detection unavailable. Calibrated shelf analysis can still run.','warning');}
  }
  renderAll();
}
$('startAnalysis').onclick=startAnalysis;
setInterval(()=>{if(state.running&&state.source?.kind!=='synthetic')void inferenceTick();},120);

function runSynthetic(){
  clearTimers();state.running=true;state.paused=false;state.source.status='Simulated';state.syntheticStarted=performance.now();
  const zone=state.zones.find(z=>z.type==='shelf')||zoneDefaults('shelf');if(!state.zones.includes(zone))state.zones.push(zone);
  Object.assign(zone,{x:.25,y:.24,w:.5,h:.54});state.selectedZone=zone.id;
  state.syntheticPercent=0;const empty=sampleShelf(zone);state.syntheticPercent=100;const full=sampleShelf(zone);state.refs.set(zone.id,{empty,full});state.shelfPercents.set(zone.id,100);renderZones();renderAll();
  for(const [delay,percent] of [[900,68],[1900,27],[2900,0],[4800,100]])state.syntheticTimers.push(setTimeout(()=>{if(!state.running)return;state.syntheticPercent=percent;analyzeShelves();state.frames++;addSample();renderAll();if(percent===100){state.running=false;state.source.status='Complete';renderAll();}},delay));
}
function startGuided(){const entryItem=state.queue[lastQueueIndex.entry];resetAnalysis(true,false);state.refs.clear();state.queue=state.queue.filter(item=>sourcePurpose(item)==='entry');lastQueueIndex.entry=entryItem?state.queue.indexOf(entryItem):-1;const item={id:crypto.randomUUID(),name:'Sample shelf scenario',kind:'synthetic',purpose:'shelf',status:'Ready'};state.queue.push(item);state.queueIndex=state.queue.length-1;lastQueueIndex.shelf=state.queueIndex;state.source=item;$('sessionName').textContent=item.name;showPage('shelf');status('Sample scenario: simulated shelf change. Every generated metric is labeled simulated.');runSynthetic();}
$('overviewDemo').onclick=startGuided;

function node(tag,content,className=''){const el=document.createElement(tag);el.textContent=content;el.className=className;return el;}
function renderEvidence(event){const box=$('eventEvidence');box.replaceChildren();if(!event){box.textContent='Select an event to inspect its evidence.';return;}for(const [label,value] of [['Event',eventTitles[event.type]],['Source',event.source],['Video time',formatTime(event.mediaTime)],['Evidence',event.why],['Rule',event.rule],['Confidence',Math.round(event.confidence*100)+'%'],['Privacy',event.privacy],['Delivery',event.status],['Recommended action',event.action||'No action required']]){const p=node('p',`${label}: ${value}`);box.append(p);}if(!event.simulated&&event.source===state.source?.name){const button=node('button',`View moment at ${formatTime(event.mediaTime)}`,'primary');button.onclick=()=>showVideoMoment(event.mediaTime);box.append(button);}}
function renderEvents(){const rows=$('eventRows');rows.replaceChildren();if(!state.events.length){const tr=document.createElement('tr'),td=node('td','No events yet.');td.colSpan=7;tr.append(td);rows.append(tr);renderEvidence(null);return;}for(const event of state.events.slice(0,50)){const tr=document.createElement('tr');for(const value of [formatTime(event.mediaTime),eventTitles[event.type]||event.type,event.zone,Math.round(event.confidence*100)+'%',event.simulated?'SIMULATED':'VIDEO',event.privacy,event.status])tr.append(node('td',value));tr.tabIndex=0;tr.onclick=()=>{state.selectedEvidence=event;renderEvidence(event);};tr.onkeydown=e=>{if(e.key==='Enter'){state.selectedEvidence=event;renderEvidence(event);}};rows.append(tr);}if(!state.selectedEvidence||!state.events.includes(state.selectedEvidence))state.selectedEvidence=state.events[0];renderEvidence(state.selectedEvidence);}
function metric(label,value,provenance){const div=node('div','', 'metric panel');div.append(node('span',label),node('strong',value),node('small',provenance));return div;}
function renderCharts(){const chart=$('trafficChart'),ctx=chart.getContext('2d');ctx.clearRect(0,0,640,220);ctx.fillStyle='#e9f1e9';ctx.fillRect(0,0,640,220);ctx.strokeStyle='#aac6b5';for(let y=40;y<220;y+=40){ctx.beginPath();ctx.moveTo(30,y);ctx.lineTo(620,y);ctx.stroke();}const samples=state.samples;if(samples.length){for(const [key,color] of [['people','#2a77b5'],['queue','#825bb5']]){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();samples.forEach((s,i)=>{const x=30+i/Math.max(1,samples.length-1)*590,y=195-Math.min(10,s[key])*16;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();}}ctx.fillStyle='#315343';ctx.font='12px Segoe UI';ctx.fillText('People',35,20);ctx.fillStyle='#825bb5';ctx.fillText('Queue',110,20);
  const heat=$('heatCanvas'),h=heat.getContext('2d');h.clearRect(0,0,640,220);h.fillStyle='#edf3ee';h.fillRect(0,0,640,220);const max=Math.max(1,...state.heat);for(let i=0;i<96;i++){const n=state.heat[i];if(!n)continue;h.fillStyle=`rgba(36,128,88,${.12+.75*n/max})`;h.fillRect(i%12*640/12,Math.floor(i/12)*220/8,640/12-2,220/8-2);}h.fillStyle='#315343';h.font='12px Segoe UI';h.fillText(state.heat.some(Boolean)?'Local temporary positions':'No person positions observed',12,18);
}
function renderAll(){
  const simulated=state.source?.kind==='synthetic',people=state.detected.filter(d=>d.class==='person'),objects=state.detected.filter(d=>d.class!=='person'),queue=[...state.queueCounts.values()].reduce((a,b)=>a+b,0),shelf=[...state.shelfPercents.values()][0],duration=Number.isFinite(video.duration)?video.duration:0,progress=simulated?(state.running?Math.min(99,currentMediaTime()/5*100):state.source?.status==='Complete'?100:0):duration?video.currentTime/duration*100:0;
  $('storeDate').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('briefInside').textContent=String(state.visitSnapshot.activeCount);$('briefEntries').textContent=String(state.visitSnapshot.opened);$('briefExits').textContent=String(state.visitSnapshot.exited);$('briefRecords').textContent=String(state.visitSnapshot.activeCount);
  $('briefActivity').textContent=state.visitSnapshot.opened?`${state.visitSnapshot.opened} observed entrance crossing${state.visitSnapshot.opened===1?'':'s'} and ${state.visitSnapshot.exited} matched exit${state.visitSnapshot.exited===1?'':'s'} in this server session.`:'No doorway crossings recorded in this server session.';
  if(sourcePurpose(state.source)==='shelf'&&Number.isFinite(shelf)){storeSummary.shelfPercent=shelf;storeSummary.shelfSimulated=simulated;}
  const lastShelf=storeSummary.shelfPercent;
  $('briefShelf').textContent=Number.isFinite(lastShelf)?`${Math.round(lastShelf)}% visibly stocked`:'Awaiting analysis';$('briefShelfNote').textContent=Number.isFinite(lastShelf)?`Estimated empty space: ${Math.round(100-lastShelf)}%. ${storeSummary.shelfSimulated?'Simulated scenario.':'Last calibrated video observation.'}`:'Analyze a calibrated shelf video to estimate visible stock.';
  const shelfRows=$('shelfTableRows');shelfRows.replaceChildren();const shelfZones=state.zones.filter(zone=>zone.type==='shelf');if(!shelfZones.length){const tr=document.createElement('tr'),td=node('td','Load a shelf recording.');td.colSpan=5;tr.append(td);shelfRows.append(tr);}else for(const zone of shelfZones){const percent=state.shelfPercents.get(zone.id),measured=Number.isFinite(percent),tr=document.createElement('tr');for(const value of [zone.name,measured?`${Math.round(percent)}%`:'Not calibrated',measured?`${Math.round(100-percent)}%`:'Not calibrated',!measured?'Awaiting analysis':percent<=15?'Empty':percent<=zone.shelf?'Low stock':'Stocked',measured?formatTime(currentMediaTime()):'—'])tr.append(node('td',value));shelfRows.append(tr);}
  const shelfZoneForStatus=shelfZones[0],refs=shelfZoneForStatus&&state.refs.get(shelfZoneForStatus.id);
  $('shelfCalibrationStatus').textContent=!state.source||sourcePurpose(state.source)!=='shelf'?'Choose a shelf recording.':refs?.empty&&refs?.full?'Empty and stocked reference frames captured. Shelf analysis is ready.':state.calibrationError?'Automatic calibration failed. Open calibration below and capture reference frames manually.':state.source.preset?'Preparing automatic empty and stocked references…':'Reference frames needed. Open calibration below and capture empty and stocked frames from this video.';
  const shelfActivityRows=$('shelfActivityRows');shelfActivityRows.replaceChildren();const shelfEvents=state.events.filter(event=>event.zone===shelfZoneForStatus?.name&&['SHELF_EMPTY','SHELF_LOW','RESTOCK_DETECTED','PRODUCT_REMOVED','PRODUCT_RETURNED','PRODUCT_INTERACTION'].includes(event.type));const activity=[...shelfEvents.map(event=>({mediaTime:event.mediaTime,label:eventTitles[event.type]||event.type,stock:Number.isFinite(event.value)?`${Math.round(event.value)}%`:'—',why:event.why})),...state.shelfObservations.map(item=>({...item,stock:'—'}))].sort((a,b)=>b.mediaTime-a.mediaTime);if(!activity.length){const tr=document.createElement('tr'),td=node('td',state.frames?'No shelf change observed yet.':'Start analysis to see shelf activity.');td.colSpan=4;tr.append(td);shelfActivityRows.append(tr);}else for(const item of activity.slice(0,20)){const tr=document.createElement('tr');for(const value of [formatTime(item.mediaTime),item.label,item.stock,item.why])tr.append(node('td',value));tr.onclick=()=>showVideoMoment(item.mediaTime);shelfActivityRows.append(tr);}
  $('videoSeek').disabled=!state.source||simulated||!duration;$('videoSeek').value=String(progress);$('videoSeekTime').textContent=formatTime(currentMediaTime());
  $('sideStatus').textContent=state.failure?`Degraded: ${state.failure}`:state.running?'Analyzing locally':state.source?'Session ready':'Local edge ready';
  $('runPill').textContent=state.failure?'DEGRADED':state.running?'ANALYZING':state.paused?'PAUSED':state.source?'READY':'IDLE';$('videoStatus').textContent=$('runPill').textContent;
  $('overviewVideo').textContent=state.source?`${state.source.name}${simulated?' · SAMPLE':''}`:'No recording selected';$('overviewModel').textContent=state.modelStatus;$('overviewEvents').textContent=String(state.events.length);
  $('overviewSource').textContent=state.running?`${simulated?'Sample scenario':'Video'} analysis in progress. Frames remain on this device.`:state.source?`${state.source.status} · ${simulated?'SIMULATED SAMPLE':'LOCAL VIDEO'}`:'Choose a recording to start.';
  const actionEvent=state.events.find(e=>e.action),shelfValue=Number.isFinite(shelf)?Math.round(shelf):null;
  $('overviewShelf').textContent=shelfValue===null?'Awaiting analysis':shelfValue<=15?'Empty':shelfValue<=(state.zones.find(zone=>zone.type==='shelf')?.shelf??25)?'Low stock':'Stocked';
  $('overviewShelfDetail').textContent=shelfValue===null?'Requires calibrated shelf frames':`${shelfValue}% estimated occupancy · ${simulated?'SIMULATED':'DERIVED'}`;
  const shelfZone=state.zones.find(zone=>zone.type==='shelf'),limit=shelfZone?.shelf??25;
  $('shelfInventoryLevel').textContent=shelfValue===null?'Not calibrated':`${shelfValue}%`;
  $('shelfInventoryStatus').textContent=shelfValue===null?'Awaiting analysis':shelfValue<=15?'Empty':shelfValue<=limit?'Low stock':'Stocked';
  $('shelfInventoryDetail').textContent=shelfValue===null?'Run a calibrated shelf recording':simulated?'Simulated shelf estimate':'Derived from calibrated video frames';
  $('shelfLimitValue').textContent=`${limit}%`;
  $('shelfInventoryAction').textContent=state.events.find(event=>event.zone===shelfZone?.name&&event.action)?.action||'None yet';
  $('overviewPeople').textContent=state.model?String(people.length):'—';$('overviewVisits').textContent=String(state.visitSnapshot.activeCount);$('overviewEntered').textContent=String(state.visitSnapshot.opened);$('overviewExited').textContent=String(state.visitSnapshot.exited);
  $('overviewFeedStatus').textContent=state.running?'ANALYZING':state.source?.status?.toUpperCase()||'NO SOURCE';
  $('overviewHealth').textContent=state.failure?'Attention required':state.running?'Analysis in progress':state.source?.status==='Complete'?'Session ready to review':state.source?'Source ready':'Ready to analyze';
  $('overviewHealthDetail').textContent=state.failure?`Processing is degraded: ${state.failure}. Open System health in Shelf Maintenance.`:state.running?'Video is being processed locally; counts and shelf signals update as evidence appears.':state.source?.status==='Complete'?'Review the observed signals below or choose another recording.':state.source?'Press Start Analysis in the relevant workflow to begin.':'Choose Entry & Exit or Shelf Maintenance, then select a recording.';
  $('overviewAction').textContent=actionEvent?.action||(!state.source?'Choose a workflow':state.running?'Monitoring for issues':state.source?.status==='Complete'?'No staff action identified':'Start video analysis');
  $('overviewActionDetail').textContent=actionEvent?`${eventTitles[actionEvent.type]} in ${actionEvent.zone} at ${formatTime(actionEvent.mediaTime)} · ${actionEvent.simulated?'SIMULATED':'DERIVED'}`:!state.source?'Use Entry & Exit for doorway traffic or Shelf Maintenance for stock condition.':state.running?'An action appears here when an observed shelf or queue rule is triggered.':state.source?.status==='Complete'?'This recording produced no current staff recommendation.':'Open the selected workflow and press Start Analysis.';
  $('overviewActivity').replaceChildren(...(state.events.length?state.events.slice(0,4).map(e=>{const row=node('button','', 'activity-item');row.append(node('span',eventTitles[e.type]),node('small',`${e.zone} · ${formatTime(e.mediaTime)} · ${e.simulated?'SIMULATED':'VIDEO'}`));row.onclick=()=>{if(e.type==='PERSON_ENTERED'||e.type==='PERSON_EXITED'){showPage('entry');$('visitTimeline').scrollIntoView({behavior:'smooth',block:'start'});}else{showPage('events');state.selectedEvidence=e;renderEvidence(e);}};return row;}):[node('p','No activity yet. Start video analysis to see events.')]));
  $('progressText').textContent=`${Math.round(progress)}% processed${simulated?' · SIMULATED':''}`;$('videoProgress').value=progress;
  $('inspectFrame').textContent=state.source?`${formatTime(currentMediaTime())} · ${state.frames} analyzed samples`:'—';
  $('inspectPeople').textContent=simulated?'Not available in synthetic demo':state.model?`${people.length} · LOCAL DETECTION`:'Not available from current model';
  $('inspectObjects').textContent=simulated?'Not available in synthetic demo':state.model?`${objects.length} · LOCAL DETECTION`:'Not available from current model';
  $('inspectInteraction').textContent=state.events.find(e=>e.type==='PRODUCT_INTERACTION')?'Inferred from person overlap + shelf change':state.refs.size?'No interaction observed':'Needs shelf references';
  $('inspectQueue').textContent=state.zones.some(z=>z.type==='queue')?(state.model?`${queue} · DERIVED from person boxes`:'Not available from current model'):'Configure a queue zone';
  $('inspectZone').textContent=state.selectedZone?zoneById(state.selectedZone)?.name||'—':'—';$('inspectEvent').textContent=state.events[0]?`${eventTitles[state.events[0].type]} · ${state.events[0].zone}`:'—';$('inspectPrivacy').textContent=state.failure==='privacy'?'BLOCKED · filter unavailable':state.lastOutbound?'PASS · anonymous fields only':'No outbound event yet';
  const memory=performance.memory?.usedJSHeapSize;const health=[['Camera / video',state.failure==='camera'?'OFFLINE · simulated':state.source?.status||'No source'],['AI model',state.modelStatus],['Model version',state.modelVersion],['Inference FPS',state.model&&state.running?String(state.fps):'Not available'],['Inference latency',state.latency===null?'Not available':`${state.latency} ms`],['CPU','Not available from browser'],['Memory',memory?`${Math.round(memory/1048576)} MB JS heap`:'Not available from browser'],['Analyzed samples',String(state.frames)],['Event queue depth',String(state.buffer.length)],['Network',state.failure==='network'?'OFFLINE · simulated':'Local connection'],['Privacy filter',state.failure==='privacy'?'PRIVACY BLOCKED':'Healthy'],['Last successful event',state.lastSuccessfulEvent?.toLocaleTimeString()||'None']];$('healthGrid').replaceChildren(...health.map(([a,b])=>metric(a,b,'CURRENT SESSION')));
  $('outboundPayload').textContent=state.lastOutbound?JSON.stringify(state.lastOutbound,null,2):'No event sent yet.';$('privacyAudit').textContent=`${state.privacyViolations} blocked payload${state.privacyViolations===1?'':'s'} this session. Temporary track IDs and frame coordinates stay in browser memory.`;
  renderQueue();renderEvents();renderVisits();
  const provenance=simulated?'SIMULATED':state.source?'DERIVED FROM CURRENT VIDEO':'NO VIDEO';const metrics=[['Footfall',state.model?String(state.footfallIds.size):'Not available',state.model?'DERIVED · ENTRANCE ZONE':'NEEDS PERSON DETECTION'],['Shelf occupancy',Number.isFinite(shelf)?`${Math.round(shelf)}%`:'Not available',Number.isFinite(shelf)?provenance+' · CALIBRATED REFERENCES':'NEEDS EMPTY + STOCKED REFERENCES'],['Queue length',state.model&&state.zones.some(z=>z.type==='queue')?String(queue):'Not available',state.model?'DERIVED · CHECKOUT ZONE':'NEEDS PERSON DETECTION + QUEUE ZONE'],['Observed queue dwell',state.dwellSamples.length?`${Math.round(Math.max(...state.dwellSamples))} s`:'Not available',state.dwellSamples.length?provenance:'NO WAIT OBSERVED'],['Operational alerts',String(state.events.filter(e=>e.action).length),provenance],['Anonymous events',String(state.events.length),provenance]];$('metricGrid').replaceChildren(...metrics.map(m=>metric(...m)));renderCharts();
  $('layoutLegend').replaceChildren(...(state.zones.length?state.zones.map(z=>node('p',`${z.name} · ${z.type} · ${z.type==='shelf'?(state.shelfPercents.has(z.id)?Math.round(state.shelfPercents.get(z.id))+'% stocked':'needs references'):z.type==='queue'?(state.model?(state.queueCounts.get(z.id)||0)+' people':'needs model'):'configured'}`)): [node('p','Configure zones to see local traffic and alert status.')]));
  const actions=state.events.filter(e=>e.action);$('insightList').replaceChildren(...(actions.length?actions.slice(0,10).map(e=>{const card=node('div','', 'panel');card.append(node('h2',eventTitles[e.type]),node('p',e.action),node('small',`${e.zone} · ${formatTime(e.mediaTime)} · ${e.simulated?'SIMULATED':'DERIVED'}`));const button=node('button','View evidence');button.onclick=()=>{showPage('events');state.selectedEvidence=e;renderEvidence(e);};card.append(button);return card;}):[node('div','No recommendation yet. Run analysis to generate evidence based actions.','panel')]));
}
$('inspectPayload').onclick=()=>{showPage('privacy');$('outboundPayload').scrollIntoView({behavior:'smooth',block:'center'});};
$('privacyProbe').onclick=async()=>{const invalid={type:'retail_signal',shelf_id:'shelf-01',timestamp:new Date().toISOString(),event:'SHELF_LOW',zone:'Shelf A',confidence:80,value:20,forbidden_test_field:'synthetic probe'};const check=validateEvent(invalid);state.privacyViolations++;try{const response=await fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(invalid)});const result=await response.json();$('privacyAudit').textContent=`Edge: ${check.reason}. Receiver: ${result.reason||response.status}. Synthetic test field was rejected; no person data used.`;status(`Privacy boundary test: edge and receiver rejected ${check.reason}.`);}catch{$('privacyAudit').textContent=`Edge: ${check.reason}. Receiver unavailable. No person data used.`;status('Local privacy check passed; receiver unavailable.','warning');}};
const failureMessages={camera:'Camera lost: video analysis paused. No new frame events are generated.',model:'Model failure: person and queue detections stop. Calibrated shelf comparison can continue.',stream:'Event stream offline: validated events buffer locally until restored.',network:'Network disconnected: validated events buffer locally until restored.',privacy:'Privacy filter unavailable: outbound events are blocked.',corrupt:'Corrupt video: analysis stopped. Choose another recording.'};
for(const button of document.querySelectorAll('[data-failure]'))button.onclick=()=>{state.failure=button.dataset.failure;if(['camera','corrupt'].includes(state.failure)){state.running=false;video.pause();}if(state.failure==='model'){state.model=null;state.modelStatus='Unavailable: simulated model failure';state.detected=[];state.tracks.clear();}$('recoveryResult').textContent=`SIMULATED FAILURE · ${failureMessages[state.failure]}`;renderAll();};
$('restoreSystem').onclick=()=>{const previous=state.failure;state.failure=null;if(previous==='model')state.modelStatus='Not loaded · start analysis to reload';$('recoveryResult').textContent='System restored. Buffered anonymous events are being delivered to the local receiver.';void flushBuffer();renderAll();};
state.zones=[zoneDefaults('shelf')];state.selectedZone=state.zones[0].id;renderZones();renderAll();renderCanvas();void loadIncludedLibrary();void fetchVisits();

