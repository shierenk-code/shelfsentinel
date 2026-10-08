import {validateEvent} from './contract.mjs';
import {occupancy,localizedMotion} from './perception.mjs';
import {recordings} from './recordings.mjs';
import {zoneAtPoint,updateTemporaryTracks,shelfRule,safeOutbound,clamp} from './retail-core.mjs';
import {loadLocalDetector} from './model-bundle.mjs';

const $=id=>document.getElementById(id),video=$('videoElement');
const canvases={overview:$('overviewCanvas'),video:$('videoCanvas'),zone:$('zoneCanvas'),privacy:$('privacyCanvas')};
const contexts=Object.fromEntries(Object.entries(canvases).map(([key,canvas])=>[key,canvas.getContext('2d')]));
const sampleCanvas=document.createElement('canvas');sampleCanvas.width=6;sampleCanvas.height=3;
const sampleContext=sampleCanvas.getContext('2d',{willReadFrequently:true});
const syntheticCanvas=document.createElement('canvas');syntheticCanvas.width=640;syntheticCanvas.height=360;
const syntheticContext=syntheticCanvas.getContext('2d');
const state={page:'overview',queue:[],queueIndex:-1,source:null,running:false,paused:false,model:null,modelStatus:'Not loaded',modelVersion:'COCO-SSD lite MobileNet v2',failure:null,frames:0,fps:0,latency:null,lastInference:0,lastFrameAt:0,lastSampleAt:0,detected:[],tracks:new Map(),nextTrackId:1,heat:Array(96).fill(0),events:[],insights:[],samples:[],buffer:[],lastOutbound:null,lastSuccessfulEvent:null,privacyViolations:0,zones:[],selectedZone:null,refs:new Map(),shelfPercents:new Map(),previousVectors:new Map(),lastStockStates:new Map(),queueCounts:new Map(),footfallIds:new Set(),dwellSamples:[],guideStep:0,syntheticPercent:100,syntheticTimers:[],generation:0};
let zoneCounter=1,eventCounter=1,inferenceBusy=false;
const videoReady=()=>state.source?.kind!=='synthetic'&&video.readyState>=2;
const currentMediaTime=()=>state.source?.kind==='synthetic'?(performance.now()-state.syntheticStarted)/1000:video.currentTime||0;
const zoneById=id=>state.zones.find(z=>z.id===id);
const formatTime=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const formatNumber=n=>Number.isFinite(n)?String(Math.round(n)):'Not available from current model';
let noticeTimer;
const status=(message,type='info')=>{const box=$('notice');clearTimeout(noticeTimer);box.textContent=message;box.hidden=!message;box.className='notice '+type;if(type==='info'&&message)noticeTimer=setTimeout(()=>{box.hidden=true;},5000);};

function showPage(page){
  if(!$(page))return;
  state.page=page;for(const el of document.querySelectorAll('.page'))el.classList.toggle('active',el.id===page);
  for(const el of document.querySelectorAll('.nav'))el.classList.toggle('active',el.dataset.target===page);
  $('pageTitle').textContent=document.querySelector(`.nav[data-target="${page}"]`)?.textContent||page;
  window.scrollTo(0,0);renderAll();
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
    const color=zone.type==='shelf'?'#79b78c':zone.type==='queue'?'#a690e1':'#9eb2ab';
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(zone.x*640,zone.y*360,zone.w*640,zone.h*360);ctx.setLineDash([]);
    ctx.fillStyle=color;ctx.font='11px Segoe UI';ctx.fillText(zone.name,zone.x*640+4,zone.y*360+14);
  }
  if(withBoxes&&state.source?.kind!=='synthetic')for(const detection of state.detected){
    const [x,y,w,h]=detection.bbox;ctx.strokeStyle=detection.class==='person'?'#67a8ed':'#e9ad59';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);
    ctx.fillStyle=ctx.strokeStyle;ctx.font='11px Segoe UI';ctx.fillText(`${detection.class} ${Math.round(detection.score*100)}%`,x+2,Math.max(12,y-3));
  }
}
function renderCanvas(){for(const [key,ctx] of Object.entries(contexts))drawFrame(ctx,key!=='zone');requestAnimationFrame(renderCanvas);}

function clearTimers(){for(const timer of state.syntheticTimers)clearTimeout(timer);state.syntheticTimers=[];}
function resetAnalysis(keepQueue=true){
  state.generation++;clearTimers();state.running=false;state.paused=false;video.pause();
  state.frames=0;state.fps=0;state.latency=null;state.lastInference=0;state.lastFrameAt=0;state.lastSampleAt=0;state.detected=[];state.tracks.clear();state.nextTrackId=1;state.heat.fill(0);state.events=[];state.selectedEvidence=null;state.insights=[];state.samples=[];state.buffer=[];state.lastOutbound=null;state.lastSuccessfulEvent=null;state.privacyViolations=0;state.previousVectors.clear();state.shelfPercents.clear();state.lastStockStates.clear();state.queueCounts.clear();state.footfallIds.clear();state.dwellSamples=[];state.failure=null;state.guideStep=0;cooldown.clear();
  if(!keepQueue){for(const item of state.queue)if(item.url?.startsWith('blob:'))URL.revokeObjectURL(item.url);state.queue=[];state.queueIndex=-1;state.source=null;video.removeAttribute('src');video.load();state.refs.clear();}
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
  return {id:`zone-${zoneCounter++}`,name:type==='shelf'?'Shelf A':type==='queue'?'Checkout':'New zone',type,detection:type==='shelf'?'shelf':'people',x:.42,y:.4,w:.32,h:.32,dwell:15,queue:4,shelf:25};
}
function renderZones(){
  $('zoneList').replaceChildren(...state.zones.map(zone=>{const b=document.createElement('button');b.textContent=zone.name+' · '+zone.type;b.className=zone.id===state.selectedZone?'selected':'';b.onclick=()=>{state.selectedZone=zone.id;renderZones();};return b;}));
  const zone=zoneById(state.selectedZone);$('zoneForm').hidden=!zone;
  if(zone){for(const [id,value] of [['zoneName',zone.name],['zoneType',zone.type],['zoneDetection',zone.detection],['zoneDwell',zone.dwell],['zoneQueue',zone.queue],['zoneShelf',zone.shelf]])$(id).value=value;}
  $('zoneMessage').textContent=zone?`${zone.name}: rectangle ${Math.round(zone.x*100)}%, ${Math.round(zone.y*100)}%, ${Math.round(zone.w*100)}% × ${Math.round(zone.h*100)}%. Rules apply to the current video session.`:'Add a zone, then drag on the frame.';
}

$('newZone').onclick=()=>{const zone=zoneDefaults('shelf');zone.name=`Zone ${state.zones.length+1}`;state.zones.push(zone);state.selectedZone=zone.id;renderZones();renderAll();};
$('removeZone').onclick=()=>{if(!state.selectedZone)return;state.zones=state.zones.filter(z=>z.id!==state.selectedZone);state.refs.delete(state.selectedZone);state.selectedZone=state.zones[0]?.id||null;renderZones();renderAll();};
$('zoneForm').onsubmit=event=>{event.preventDefault();const zone=zoneById(state.selectedZone);if(!zone)return;const name=$('zoneName').value.trim();if(!/^[A-Za-z0-9 _-]{1,32}$/.test(name)){status('Zone names can use letters, numbers, spaces, hyphens, and underscores.','warning');return;}zone.name=name;zone.type=$('zoneType').value;zone.detection=$('zoneDetection').value;zone.dwell=clamp(Number($('zoneDwell').value),1,600);zone.queue=clamp(Number($('zoneQueue').value),1,30);zone.shelf=clamp(Number($('zoneShelf').value),1,90);state.refs.delete(zone.id);renderZones();renderAll();status('Zone rules saved. Recalibrate a changed shelf zone.');};
let drawStart=null;
$('zoneCanvas').onpointerdown=event=>{const rect=canvases.zone.getBoundingClientRect();drawStart={x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1)};canvases.zone.setPointerCapture(event.pointerId);};
$('zoneCanvas').onpointerup=event=>{if(!drawStart)return;const rect=canvases.zone.getBoundingClientRect(),end={x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1)};const x=Math.min(drawStart.x,end.x),y=Math.min(drawStart.y,end.y),w=Math.abs(end.x-drawStart.x),h=Math.abs(end.y-drawStart.y);drawStart=null;if(w<.04||h<.04)return status('Draw a larger rectangle.','warning');let zone=zoneById(state.selectedZone);if(!zone){zone=zoneDefaults();state.zones.push(zone);state.selectedZone=zone.id;}Object.assign(zone,{x,y,w,h});state.refs.delete(zone.id);renderZones();renderAll();status(`${zone.name} area updated. Capture new shelf references if needed.`);};

function renderQueue(){
  const box=$('videoQueue');if(!state.queue.length){box.textContent='No videos queued. Upload a file or choose an included recording.';return;}
  box.replaceChildren(...state.queue.map((item,index)=>{const button=document.createElement('button');button.textContent=`${index+1}. ${item.name} · ${item.status}`;button.className=index===state.queueIndex?'selected':'';button.onclick=()=>loadSource(index);return button;}));
}
function addQueueItem(item){state.queue.push({...item,id:crypto.randomUUID(),status:'Ready'});if(state.queueIndex<0)loadSource(0);else renderQueue();}
$('videoFiles').onchange=()=>{for(const file of $('videoFiles').files){if(!/\.(mp4|webm)$/i.test(file.name))continue;addQueueItem({name:file.name,url:URL.createObjectURL(file),kind:'local'});}$('videoFiles').value='';};
$('addIncluded').onclick=()=>{const id=$('includedSelect').value,entry=recordings.find(item=>item.id===id);if(!entry)return status('Choose an available recording.','warning');addQueueItem({name:entry.title,url:'/recordings/'+entry.file,kind:'included',preset:entry.calibration||null});};
async function loadIncludedLibrary(){try{const response=await fetch('/api/recordings');const data=await response.json();for(const entry of recordings.filter(item=>data.available.includes(item.id))){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.title;$('includedSelect').append(option);}if(data.available.includes('clip-03')){$('includedSelect').value='clip-03';$('overviewSource').textContent='A real restocking clip is ready in Video Analysis.';if(!state.queue.length){const entry=recordings.find(item=>item.id==='clip-03');addQueueItem({name:entry.title,url:'/recordings/'+entry.file,kind:'included',preset:entry.calibration||null});}}}catch{status('Included recording library unavailable. Upload a local file or run the synthetic demo.','warning');}}
function loadSource(index){
  if(index<0||index>=state.queue.length)return;
  resetAnalysis(true);state.refs.clear();state.queueIndex=index;state.source=state.queue[index];state.source.status='Loaded';video.src=state.source.url;video.load();$('sessionName').textContent=state.source.name;status('Video loaded. Configure zones, then start local analysis.');renderAll();
}
async function seekTo(seconds){return new Promise((resolve,reject)=>{if(!Number.isFinite(video.duration)||video.duration<=0)return reject(Error('Video has no seekable frames'));const target=clamp(seconds,0,Math.max(0,video.duration-.1));if(Math.abs(video.currentTime-target)<.03)return resolve();video.addEventListener('seeked',resolve,{once:true});video.currentTime=target;});}
async function autoCalibrate(preset,generation){
  const zone=state.zones.find(z=>z.type==='shelf');if(!zone||!preset)return;
  [zone.x,zone.y,zone.w,zone.h]=preset.roi.map(n=>n/100);renderZones();
  await seekTo(preset.emptyAt);if(generation!==state.generation)return;drawFrame(contexts.video,false);const empty=sampleShelf(zone);
  await seekTo(preset.fullAt);if(generation!==state.generation)return;drawFrame(contexts.video,false);const full=sampleShelf(zone);
  await seekTo(0);if(generation!==state.generation)return;state.refs.set(zone.id,{empty,full});status('Real shelf references prepared. Press Start Analysis.');renderAll();
}
video.onloadedmetadata=async()=>{if(!state.source)return;const generation=state.generation;try{if(state.source.preset)await autoCalibrate(state.source.preset,generation);}catch{status('Automatic shelf calibration was unavailable. Capture references manually.','warning');}renderAll();};
video.onerror=()=>{$('videoError').textContent='This video could not be decoded. Choose an H.264 MP4 or WebM file.';state.source&&(state.source.status='Corrupt');state.running=false;renderAll();};
video.onended=()=>{state.running=false;state.paused=false;if(state.source)state.source.status='Complete';renderAll();};
$('captureEmpty').onclick=()=>captureReference('empty');$('captureStocked').onclick=()=>captureReference('full');
function captureReference(kind){const zone=zoneById(state.selectedZone);if(!zone||zone.type!=='shelf')return status('Select a shelf zone first.','warning');if(!videoReady()&&state.source?.kind!=='synthetic')return status('Load a video frame first.','warning');state.running=false;video.pause();const refs=state.refs.get(zone.id)||{};refs[kind]=sampleShelf(zone);state.refs.set(zone.id,refs);$('referenceStatus').textContent=`${zone.name}: empty ${refs.empty?'captured':'needed'} · stocked ${refs.full?'captured':'needed'}.`;status(`${kind==='full'?'Stocked':'Empty'} reference captured locally.`);renderAll();}
$('nextVideo').onclick=()=>{if(!state.queue.length)return status('No next video in the queue.','warning');loadSource((state.queueIndex+1)%state.queue.length);};
$('pauseAnalysis').onclick=()=>{state.running=false;state.paused=true;video.pause();clearTimers();if(state.source)state.source.status='Paused';renderAll();};
$('stopAnalysis').onclick=()=>{state.running=false;state.paused=false;video.pause();clearTimers();if(state.source)state.source.status='Stopped';renderAll();};
$('resetAnalysis').onclick=()=>{resetAnalysis(false);$('sessionName').textContent='No video selected';status('Session reset. All temporary tracking and local events were cleared.');};

const eventTitles={PERSON_ENTERED:'Person entered',DWELL_THRESHOLD:'Dwell threshold reached',PRODUCT_INTERACTION:'Possible shelf interaction',PRODUCT_REMOVED:'Possible product removal',PRODUCT_RETURNED:'Possible product return',SHELF_LOW:'Shelf running low',SHELF_EMPTY:'Shelf empty',RESTOCK_DETECTED:'Restock inferred',QUEUE_BUILDUP:'Queue buildup',LONG_WAIT:'Long observed wait',CHECKOUT_CONGESTION:'Checkout congestion'};
const actionFor=type=>({SHELF_LOW:'Check shelf stock and prepare replenishment.',SHELF_EMPTY:'Replenish this shelf now.',RESTOCK_DETECTED:'Confirm the shelf is ready for shoppers.',PRODUCT_REMOVED:'Review shelf stock after the interaction.',QUEUE_BUILDUP:'Open another checkout if staff are available.',LONG_WAIT:'Send support to checkout.',CHECKOUT_CONGESTION:'Review checkout staffing.'})[type]||null;
const cooldown=new Map();
function addEvent(type,zone,confidence,value,why,rule){
  if(!zone)return;
  const mediaTime=currentMediaTime(),key=type+':'+zone.id;
  if(mediaTime-(cooldown.get(key)??-100)<4)return;
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

function addSample(){const t=currentMediaTime();state.samples.push({time:t,people:state.detected.filter(d=>d.class==='person').length,queue:[...state.queueCounts.values()].reduce((a,b)=>a+b,0)});if(state.samples.length>120)state.samples.shift();}
function analyzePeople(detections){
  const people=detections.filter(d=>d.class==='person');
  const result=updateTemporaryTracks(state.tracks,people,currentMediaTime(),state.zones,state.nextTrackId);state.tracks=result.tracks;state.nextTrackId=result.nextId;
  state.queueCounts.clear();
  for(const track of state.tracks.values()){
    const zone=zoneById(track.zoneId);if(!zone)continue;
    const hx=Math.min(11,Math.floor(track.x*12)),hy=Math.min(7,Math.floor(track.y*8));state.heat[hy*12+hx]++;
    if(zone.type==='entrance'&&!state.footfallIds.has(track.id)){state.footfallIds.add(track.id);addEvent('PERSON_ENTERED',zone,track.score,1,'A person box crossed the configured entrance rectangle.','Footpoint entered entrance zone.');}
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
    const refs=state.refs.get(zone.id);if(!refs?.empty||!refs?.full)continue;
    let percent;try{percent=occupancy(sampleShelf(zone),refs.empty,refs.full).percent;}catch{continue;}
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
  if(!videoReady())return status('Waiting for a decodable video frame.','warning');
  $('videoError').textContent='';
  if(!state.model&&state.failure!=='model'){
    state.modelStatus='Loading bundled model';renderAll();
    try{state.model=await loadLocalDetector();state.modelStatus='Ready · bundled local model';}
    catch(error){state.modelStatus='Unavailable: '+error.message;status('Person detection unavailable. Calibrated shelf analysis can still run.','warning');}
  }
  try{await video.play();}catch(error){return status('The browser could not play this video: '+error.message,'warning');}
  state.running=true;state.paused=false;state.source.status='Analyzing';renderAll();
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
function startGuided(){resetAnalysis(false);const item={id:crypto.randomUUID(),name:'Sample shelf scenario',kind:'synthetic',status:'Ready'};state.queue=[item];state.queueIndex=0;state.source=item;$('sessionName').textContent=item.name;showPage('video');status('Sample scenario: simulated shelf change. Every generated metric is labeled simulated.');runSynthetic();}
$('overviewDemo').onclick=startGuided;

function node(tag,content,className=''){const el=document.createElement(tag);el.textContent=content;el.className=className;return el;}
function renderEvidence(event){const box=$('eventEvidence');box.replaceChildren();if(!event){box.textContent='Select an event to inspect its evidence.';return;}for(const [label,value] of [['Event',eventTitles[event.type]],['Source',event.source],['Video time',formatTime(event.mediaTime)],['Evidence',event.why],['Rule',event.rule],['Confidence',Math.round(event.confidence*100)+'%'],['Privacy',event.privacy],['Delivery',event.status],['Recommended action',event.action||'No action required']]){const p=node('p',`${label}: ${value}`);box.append(p);}}
function renderEvents(){const rows=$('eventRows');rows.replaceChildren();if(!state.events.length){const tr=document.createElement('tr'),td=node('td','No events yet.');td.colSpan=7;tr.append(td);rows.append(tr);renderEvidence(null);return;}for(const event of state.events.slice(0,50)){const tr=document.createElement('tr');for(const value of [formatTime(event.mediaTime),eventTitles[event.type]||event.type,event.zone,Math.round(event.confidence*100)+'%',event.simulated?'SIMULATED':'VIDEO',event.privacy,event.status])tr.append(node('td',value));tr.tabIndex=0;tr.onclick=()=>{state.selectedEvidence=event;renderEvidence(event);};tr.onkeydown=e=>{if(e.key==='Enter'){state.selectedEvidence=event;renderEvidence(event);}};rows.append(tr);}if(!state.selectedEvidence||!state.events.includes(state.selectedEvidence))state.selectedEvidence=state.events[0];renderEvidence(state.selectedEvidence);}
function metric(label,value,provenance){const div=node('div','', 'metric panel');div.append(node('span',label),node('strong',value),node('small',provenance));return div;}
function renderCharts(){const chart=$('trafficChart'),ctx=chart.getContext('2d');ctx.clearRect(0,0,640,220);ctx.fillStyle='#e9f1e9';ctx.fillRect(0,0,640,220);ctx.strokeStyle='#aac6b5';for(let y=40;y<220;y+=40){ctx.beginPath();ctx.moveTo(30,y);ctx.lineTo(620,y);ctx.stroke();}const samples=state.samples;if(samples.length){for(const [key,color] of [['people','#2a77b5'],['queue','#825bb5']]){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();samples.forEach((s,i)=>{const x=30+i/Math.max(1,samples.length-1)*590,y=195-Math.min(10,s[key])*16;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();}}ctx.fillStyle='#315343';ctx.font='12px Segoe UI';ctx.fillText('People',35,20);ctx.fillStyle='#825bb5';ctx.fillText('Queue',110,20);
  const heat=$('heatCanvas'),h=heat.getContext('2d');h.clearRect(0,0,640,220);h.fillStyle='#edf3ee';h.fillRect(0,0,640,220);const max=Math.max(1,...state.heat);for(let i=0;i<96;i++){const n=state.heat[i];if(!n)continue;h.fillStyle=`rgba(36,128,88,${.12+.75*n/max})`;h.fillRect(i%12*640/12,Math.floor(i/12)*220/8,640/12-2,220/8-2);}h.fillStyle='#315343';h.font='12px Segoe UI';h.fillText(state.heat.some(Boolean)?'Local temporary positions':'No person positions observed',12,18);
}
function renderAll(){
  const simulated=state.source?.kind==='synthetic',people=state.detected.filter(d=>d.class==='person'),objects=state.detected.filter(d=>d.class!=='person'),queue=[...state.queueCounts.values()].reduce((a,b)=>a+b,0),shelf=[...state.shelfPercents.values()][0],duration=Number.isFinite(video.duration)?video.duration:0,progress=simulated?(state.running?Math.min(99,currentMediaTime()/5*100):state.source?.status==='Complete'?100:0):duration?video.currentTime/duration*100:0;
  $('sideStatus').textContent=state.failure?`Degraded: ${state.failure}`:state.running?'Analyzing locally':state.source?'Session ready':'Local edge ready';
  $('runPill').textContent=state.failure?'DEGRADED':state.running?'ANALYZING':state.paused?'PAUSED':state.source?'READY':'IDLE';$('videoStatus').textContent=$('runPill').textContent;
  $('overviewVideo').textContent=state.source?`${state.source.name}${simulated?' · SAMPLE':''}`:'No recording selected';$('overviewModel').textContent=state.modelStatus;$('overviewEvents').textContent=String(state.events.length);
  $('overviewSource').textContent=state.running?`${simulated?'Sample scenario':'Video'} analysis in progress. Frames remain on this device.`:state.source?`${state.source.status} · ${simulated?'SIMULATED SAMPLE':'LOCAL VIDEO'}`:'Choose a recording to start.';
  const actionEvent=state.events.find(e=>e.action),shelfValue=Number.isFinite(shelf)?Math.round(shelf):null;
  $('overviewShelf').textContent=shelfValue===null?'Awaiting analysis':shelfValue<=15?'Empty':shelfValue<=25?'Low stock':'Stocked';
  $('overviewShelfDetail').textContent=shelfValue===null?'Requires calibrated shelf frames':`${shelfValue}% estimated occupancy · ${simulated?'SIMULATED':'DERIVED'}`;
  $('overviewPeople').textContent=state.model?String(people.length):'—';$('overviewQueue').textContent=state.model&&state.zones.some(z=>z.type==='queue')?String(queue):'—';
  $('overviewFeedStatus').textContent=state.running?'ANALYZING':state.source?.status?.toUpperCase()||'NO SOURCE';
  $('overviewAction').textContent=actionEvent?.action||'No action needed';$('overviewActionDetail').textContent=actionEvent?`${eventTitles[actionEvent.type]} in ${actionEvent.zone} at ${formatTime(actionEvent.mediaTime)} · ${actionEvent.simulated?'SIMULATED':'DERIVED'}`:'Actions appear when analysis finds an operational issue.';
  $('overviewActivity').replaceChildren(...(state.events.length?state.events.slice(0,4).map(e=>{const row=node('button','', 'activity-item');row.append(node('span',eventTitles[e.type]),node('small',`${e.zone} · ${formatTime(e.mediaTime)} · ${e.simulated?'SIMULATED':'VIDEO'}`));row.onclick=()=>{showPage('events');state.selectedEvidence=e;renderEvidence(e);};return row;}):[node('p','No activity yet. Start video analysis to see events.')]));
  $('progressText').textContent=`${Math.round(progress)}% processed${simulated?' · SIMULATED':''}`;$('videoProgress').value=progress;
  $('inspectFrame').textContent=state.source?`${formatTime(currentMediaTime())} · ${state.frames} analyzed samples`:'—';
  $('inspectPeople').textContent=simulated?'Not available in synthetic demo':state.model?`${people.length} · LOCAL DETECTION`:'Not available from current model';
  $('inspectObjects').textContent=simulated?'Not available in synthetic demo':state.model?`${objects.length} · LOCAL DETECTION`:'Not available from current model';
  $('inspectInteraction').textContent=state.events.find(e=>e.type==='PRODUCT_INTERACTION')?'Inferred from person overlap + shelf change':state.refs.size?'No interaction observed':'Needs shelf references';
  $('inspectQueue').textContent=state.zones.some(z=>z.type==='queue')?(state.model?`${queue} · DERIVED from person boxes`:'Not available from current model'):'Configure a queue zone';
  $('inspectZone').textContent=state.selectedZone?zoneById(state.selectedZone)?.name||'—':'—';$('inspectEvent').textContent=state.events[0]?`${eventTitles[state.events[0].type]} · ${state.events[0].zone}`:'—';$('inspectPrivacy').textContent=state.failure==='privacy'?'BLOCKED · filter unavailable':state.lastOutbound?'PASS · anonymous fields only':'No outbound event yet';
  const memory=performance.memory?.usedJSHeapSize;const health=[['Camera / video',state.failure==='camera'?'OFFLINE · simulated':state.source?.status||'No source'],['AI model',state.modelStatus],['Model version',state.modelVersion],['Inference FPS',state.model&&state.running?String(state.fps):'Not available'],['Inference latency',state.latency===null?'Not available':`${state.latency} ms`],['CPU','Not available from browser'],['Memory',memory?`${Math.round(memory/1048576)} MB JS heap`:'Not available from browser'],['Analyzed samples',String(state.frames)],['Event queue depth',String(state.buffer.length)],['Network',state.failure==='network'?'OFFLINE · simulated':'Local connection'],['Privacy filter',state.failure==='privacy'?'PRIVACY BLOCKED':'Healthy'],['Last successful event',state.lastSuccessfulEvent?.toLocaleTimeString()||'None']];$('healthGrid').replaceChildren(...health.map(([a,b])=>metric(a,b,'CURRENT SESSION')));
  $('outboundPayload').textContent=state.lastOutbound?JSON.stringify(state.lastOutbound,null,2):'No event sent yet.';$('privacyAudit').textContent=`${state.privacyViolations} blocked payload${state.privacyViolations===1?'':'s'} this session. Temporary track IDs and frame coordinates stay in browser memory.`;
  renderQueue();renderEvents();
  const provenance=simulated?'SIMULATED':state.source?'DERIVED FROM CURRENT VIDEO':'NO VIDEO';const metrics=[['Footfall',state.model?String(state.footfallIds.size):'Not available',state.model?'DERIVED · ENTRANCE ZONE':'NEEDS PERSON DETECTION'],['Shelf occupancy',Number.isFinite(shelf)?`${Math.round(shelf)}%`:'Not available',Number.isFinite(shelf)?provenance+' · CALIBRATED REFERENCES':'NEEDS EMPTY + STOCKED REFERENCES'],['Queue length',state.model&&state.zones.some(z=>z.type==='queue')?String(queue):'Not available',state.model?'DERIVED · CHECKOUT ZONE':'NEEDS PERSON DETECTION + QUEUE ZONE'],['Observed queue dwell',state.dwellSamples.length?`${Math.round(Math.max(...state.dwellSamples))} s`:'Not available',state.dwellSamples.length?provenance:'NO WAIT OBSERVED'],['Operational alerts',String(state.events.filter(e=>e.action).length),provenance],['Anonymous events',String(state.events.length),provenance]];$('metricGrid').replaceChildren(...metrics.map(m=>metric(...m)));renderCharts();
  $('layoutLegend').replaceChildren(...(state.zones.length?state.zones.map(z=>node('p',`${z.name} · ${z.type} · ${z.type==='shelf'?(state.shelfPercents.has(z.id)?Math.round(state.shelfPercents.get(z.id))+'% stocked':'needs references'):z.type==='queue'?(state.model?(state.queueCounts.get(z.id)||0)+' people':'needs model'):'configured'}`)): [node('p','Configure zones to see local traffic and alert status.')]));
  const actions=state.events.filter(e=>e.action);$('insightList').replaceChildren(...(actions.length?actions.slice(0,10).map(e=>{const card=node('div','', 'panel');card.append(node('h2',eventTitles[e.type]),node('p',e.action),node('small',`${e.zone} · ${formatTime(e.mediaTime)} · ${e.simulated?'SIMULATED':'DERIVED'}`));const button=node('button','View evidence');button.onclick=()=>{showPage('events');state.selectedEvidence=e;renderEvidence(e);};card.append(button);return card;}):[node('div','No recommendation yet. Run analysis to generate evidence based actions.','panel')]));
}
$('inspectPayload').onclick=()=>{showPage('privacy');$('outboundPayload').scrollIntoView({behavior:'smooth',block:'center'});};
$('privacyProbe').onclick=async()=>{const invalid={type:'retail_signal',shelf_id:'shelf-01',timestamp:new Date().toISOString(),event:'SHELF_LOW',zone:'Shelf A',confidence:80,value:20,forbidden_test_field:'synthetic probe'};const check=validateEvent(invalid);state.privacyViolations++;try{const response=await fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(invalid)});const result=await response.json();$('privacyAudit').textContent=`Edge: ${check.reason}. Receiver: ${result.reason||response.status}. Synthetic test field was rejected; no person data used.`;status(`Privacy boundary test: edge and receiver rejected ${check.reason}.`);}catch{$('privacyAudit').textContent=`Edge: ${check.reason}. Receiver unavailable. No person data used.`;status('Local privacy check passed; receiver unavailable.','warning');}};
const failureMessages={camera:'Camera lost: video analysis paused. No new frame events are generated.',model:'Model failure: person and queue detections stop. Calibrated shelf comparison can continue.',stream:'Event stream offline: validated events buffer locally until restored.',network:'Network disconnected: validated events buffer locally until restored.',privacy:'Privacy filter unavailable: outbound events are blocked.',corrupt:'Corrupt video: analysis stopped. Choose another recording.'};
for(const button of document.querySelectorAll('[data-failure]'))button.onclick=()=>{state.failure=button.dataset.failure;if(['camera','corrupt'].includes(state.failure)){state.running=false;video.pause();}if(state.failure==='model'){state.model=null;state.modelStatus='Unavailable: simulated model failure';state.detected=[];state.tracks.clear();}$('recoveryResult').textContent=`SIMULATED FAILURE · ${failureMessages[state.failure]}`;renderAll();};
$('restoreSystem').onclick=()=>{const previous=state.failure;state.failure=null;if(previous==='model')state.modelStatus='Not loaded · start analysis to reload';$('recoveryResult').textContent='System restored. Buffered anonymous events are being delivered to the local receiver.';void flushBuffer();renderAll();};
state.zones=[zoneDefaults('shelf')];state.selectedZone=state.zones[0].id;renderZones();renderAll();renderCanvas();void loadIncludedLibrary();

