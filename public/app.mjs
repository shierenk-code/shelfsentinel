import {validateEvent} from './contract.mjs';
import {occupancy,stockState} from './perception.mjs';
import {requestLocal} from './api.mjs';
const $=id=>document.getElementById(id), canvas=$('preview'),ctx=canvas.getContext('2d'),video=$('video');
const sample=document.createElement('canvas');sample.width=6;sample.height=3;
const sampleCtx=sample.getContext('2d',{willReadFrequently:true});
let source='demo',demoPercent=100,reachingUntil=0,running=false,refs={},stream=null,objectURL=null,previous=null;
let currentState=null,emptySeconds=0,lastMotion=0,lastTick=0,lastEmit=0,recent=[],localAudit=[],localBlocks=0,timerBusy=false,resetNeeded=true;
const roi=()=>({x:Number($('roiX').value)/100,y:Number($('roiY').value)/100,w:Number($('roiW').value)/100,h:Number($('roiH').value)/100});
function error(text=''){$('error').textContent=text;}
function vectors(){const r=roi();sampleCtx.drawImage(canvas,r.x*640,r.y*360,r.w*640,r.h*360,0,0,6,3);const rgba=sampleCtx.getImageData(0,0,6,3).data;return Array.from(rgba).filter((_,i)=>i%4!==3);}
function drawDemo(percent=demoPercent,reach=false){
  ctx.fillStyle='#243d34';ctx.fillRect(0,0,640,360);
  ctx.fillStyle='#3a5446';ctx.fillRect(32,45,576,260);
  const r=roi(),x=r.x*640,y=r.y*360,w=r.w*640,h=r.h*360;
  ctx.fillStyle='#91a18a';ctx.fillRect(x,y,w,h);
  for(let row=0;row<3;row++)for(let col=0;col<6;col++){
    const tile=row*6+col;if(tile<Math.round(percent/100*18)){
      const bx=x+col*w/6+w/6*.10,by=y+row*h/3+4;
      ctx.fillStyle=['#e4b45b','#ba674b','#dcd5a1'][row];ctx.fillRect(bx,by,w/6*.80,h/3-9);
      ctx.fillStyle='#fff5d4';ctx.fillRect(bx+10,by+15,w/6*.80-20,20);
    }
    ctx.fillStyle='#35513f';ctx.fillRect(x,y+(row+1)*h/3-3,w,3);
  }
  if(reach){ctx.fillStyle='#b89276';ctx.fillRect(x+w*.4,y+h*.2,w*.25,h*.7);}
  ctx.fillStyle='#d9e4d3';ctx.font='12px Segoe UI';ctx.fillText('SYNTHETIC SHELF • CALIBRATED 6 × 3 ZONE',32,27);
}
function frame(){
  if(source==='demo')drawDemo(demoPercent,performance.now()<reachingUntil);
  else if(video.readyState>=2){ctx.fillStyle='#152b26';ctx.fillRect(0,0,640,360);ctx.drawImage(video,0,0,640,360);}
}
function outline(){const r=roi();ctx.strokeStyle='#c4dda6';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.strokeRect(r.x*640,r.y*360,r.w*640,r.h*360);ctx.setLineDash([]);}
function render(){frame();outline();if(source==='recording'&&Number.isFinite(video.duration)){$('seek').value=video.currentTime/video.duration*100;$('time').textContent=`${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;}requestAnimationFrame(render);}
function formatTime(t){return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
function calibrateDemo(){drawDemo(0);refs.empty=vectors();drawDemo(100);refs.full=vectors();frame();calibrationText();}
function calibrationText(){$('calibration').textContent=`Empty reference: ${refs.empty?'captured':'needed'} · Stocked reference: ${refs.full?'captured':'needed'}. Without both, only motion triggers run.`;$('start').disabled=false;}
function pause(message='Paused · metrics retained'){running=false;video.pause();$('runStatus').textContent=message;lastTick=0;}
function stopSource(){pause('Ready');if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;video.removeAttribute('src');video.load();if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;refs={};previous=null;recent=[];currentState=null;emptySeconds=0;lastEmit=0;lastMotion=0;resetNeeded=true;$('seek').disabled=true;error();}
function sourceLabel(text){$('sourceBadge').textContent=text;$('demoControls').hidden=source!=='demo';}
function candidate(type,data){return {type,shelf_id:'shelf-01',timestamp:new Date().toISOString(),...data};}
async function send(event){
  const verdict=validateEvent(event);
  if(!verdict.ok){localBlocks++;localAudit.unshift({timestamp:new Date().toISOString(),reason:verdict.reason});localAudit=localAudit.slice(0,20);return verdict;}
  const res=await requestLocal('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)});
  const reply=await res.json();if(!reply.ok)throw new Error('Receiver rejected an operational event.');return reply;
}
async function tick(){
  if(!running||timerBusy)return;timerBusy=true;
  try{
    frame();const v=vectors(),result=refs.empty&&refs.full?occupancy(v,refs.empty,refs.full):null;
    const now=performance.now();const dt=lastTick?Math.min((now-lastTick)/1000,1.5):0;lastTick=now;
    if(previous&&now-lastMotion>3000&&v.reduce((total,n,i)=>total+Math.abs(n-previous[i]),0)/v.length>8){lastMotion=now;await send(candidate('shelf_interaction',{count:1}));}
    previous=v;
    if(result){
      recent.push(result.percent);if(recent.length>4)recent.shift();
      const percent=Math.round(recent.reduce((a,b)=>a+b,0)/recent.length),next=stockState(percent);
      if(next==='empty')emptySeconds=currentState==='empty'?emptySeconds+dt:0;else emptySeconds=0;
      if(currentState!==next||now-lastEmit>2000){await send(candidate('shelf_status',{state:next,occupancy:percent}));if(next==='empty')await send(candidate('stockout_duration',{seconds:Math.floor(emptySeconds)}));lastEmit=now;}
      currentState=next;
    }
    await dashboard();
  }catch(e){pause('Analysis stopped');error(e.message);}finally{timerBusy=false;}
}
async function dashboard(){
  try{
    const res=await requestLocal('/api/dashboard');if(!res.ok)throw new Error('Dashboard unavailable');const data=await res.json();
    $('accepted').textContent=data.accepted;$('blocked').textContent=data.blocked+localBlocks;
    const status=data.metrics.status;
    if(status){$('stockTag').textContent=status.state==='full'?'Stocked':status.state==='low'?'Low stock':'Empty';$('occupancy').textContent=status.occupancy+'%';$('fill').style.width=status.occupancy+'%';$('alert').className='alert '+(status.state==='empty'?'danger':status.state==='low'?'warning':'');$('alert').textContent=status.state==='empty'?'Restock needed — shelf is empty.':status.state==='low'?'Stock is running low — prioritize replenishment.':'Shelf availability is healthy.';}
    else{$('stockTag').textContent='Uncalibrated';$('occupancy').textContent='—';$('fill').style.width='0%';$('alert').className='alert neutral';$('alert').textContent='Motion analysis available. Capture empty and stocked references to estimate stock.';}
    $('duration').textContent=status?.state==='empty'?data.metrics.stockoutSeconds+'s':'0s';
    $('interactions').textContent=data.metrics.interactions;
    $('events').replaceChildren(...data.events.slice(0,12).map(e=>{const row=document.createElement('div');row.className='event';const title=document.createElement('strong');title.textContent=e.type+' · '+new Date(e.timestamp).toLocaleTimeString();row.append(title,document.createTextNode(JSON.stringify(e)));return row;}));
    $('audit').replaceChildren(...[...localAudit.map(e=>({...e,gate:'Edge'})),...data.audit.map(e=>({...e,gate:'Receiver'}))].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,8).map(e=>{const p=document.createElement('p');p.textContent=`${new Date(e.timestamp).toLocaleTimeString()} · ${e.gate} · ${e.reason} · payload discarded`;return p;}));
  }catch(e){error(e.message);}
}
$('start').onclick=async()=>{error();try{frame();if(refs.empty&&refs.full)occupancy(vectors(),refs.empty,refs.full);if(resetNeeded){if(timerBusy)throw new Error('Previous analysis is finishing. Try again in a moment.');const response=await requestLocal('/api/reset',{method:'POST'});if(!response.ok)throw new Error('Could not start a fresh session.');localAudit=[];localBlocks=0;$('attackResult').textContent='Ready to test the boundary.';resetNeeded=false;}if(source!=='demo'){if(video.ended){video.currentTime=0;previous=null;recent=[];currentState=null;emptySeconds=0;lastEmit=0;}await video.play();}running=true;lastTick=0;$('runStatus').textContent=refs.empty&&refs.full?'Analyzing locally':'Motion-only · stock uncalibrated';await tick();}catch(e){pause('Ready');error(e.message);}};
$('pause').onclick=()=>pause();
$('stockFull').onclick=()=>demoPercent=100;$('stockLow').onclick=()=>demoPercent=33;$('stockEmpty').onclick=()=>demoPercent=0;$('motion').onclick=()=>reachingUntil=performance.now()+1000;
$('demo').onclick=()=>{stopSource();source='demo';sourceLabel('Synthetic demo');calibrateDemo();};
$('file').onchange=()=>{const file=$('file').files[0];if(!file)return;stopSource();source='recording';sourceLabel('Local recording');objectURL=URL.createObjectURL(file);video.src=objectURL;calibrationText();$('runStatus').textContent='Capture empty & stocked reference frames';};
video.onloadedmetadata=()=>{if(source==='recording'){$('seek').disabled=false;video.currentTime=0;}};
video.onended=()=>pause('Recording ended · metrics retained');video.onerror=()=>error('This video format could not be decoded. Use an H.264 MP4 or WebM recording.');
$('seek').oninput=()=>{pause();video.currentTime=Number($('seek').value)/100*video.duration;previous=null;recent=[];currentState=null;emptySeconds=0;lastEmit=0;};
$('camera').onclick=async()=>{stopSource();source='camera';sourceLabel('Local webcam');calibrationText();try{stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:360},audio:false});video.srcObject=stream;await video.play();$('runStatus').textContent='Capture empty & stocked reference frames';}catch{error('Webcam unavailable or access was declined. Choose a recording instead.');}};
for(const [button,key] of [['captureEmpty','empty'],['captureFull','full']])$(button).onclick=()=>{error();if(source!=='demo'&&video.readyState<2)return error('Wait for a video frame to load.');frame();refs[key]=vectors();calibrationText();};
for(const id of ['roiX','roiY','roiW','roiH'])$(id).onchange=()=>{const r=roi();if(![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.x<0||r.y<0||r.w<.05||r.h<.05||r.x+r.w>1||r.y+r.h>1){error('Shelf zone must fit within the image.');$(id).value={roiX:10,roiY:22,roiW:80,roiH:60}[id];return;}pause('Zone changed · recalibrate');refs={};previous=null;recent=[];if(source==='demo')calibrateDemo();else calibrationText();error();};
$('attack').onclick=async()=>{
  $('attack').disabled=true;try{
    const attack=candidate('shelf_status',{state:'full',occupancy:100,face_embedding:[0.12,0.34],pixel_coordinates:[22,55]});
    const edge=await send(attack);
    // Explicit synthetic receiver probe, never a frame, identity or genuine biometric.
    const receiver=await requestLocal('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attack)});
    const verdict=await receiver.json();$('attackResult').textContent=`Edge gate: ${edge.ok?'FAILED':'BLOCKED'} · Receiver gate: ${verdict.ok?'FAILED':'BLOCKED'} — ${verdict.reason}. Only the reason is retained.`;await dashboard();
  }catch{error('Privacy test could not reach the local server.');}finally{$('attack').disabled=false;}
};
window.addEventListener('pagehide',()=>{if(stream)stream.getTracks().forEach(t=>t.stop());if(objectURL)URL.revokeObjectURL(objectURL);});
calibrateDemo();render();dashboard();setInterval(tick,500);
