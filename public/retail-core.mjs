export const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function zoneAtPoint(x,y,zones){
  for(const zone of zones){
    if(zone.type==='ignore'&&x>=zone.x&&x<=zone.x+zone.w&&y>=zone.y&&y<=zone.y+zone.h)return null;
  }
  return zones.find(zone=>zone.type!=='ignore'&&x>=zone.x&&x<=zone.x+zone.w&&y>=zone.y&&y<=zone.y+zone.h)||null;
}

export function updateTemporaryTracks(previous,detections,mediaSeconds,zones,nextId){
  const active=new Map([...previous].filter(([,track])=>mediaSeconds-track.lastSeen<=3&&mediaSeconds>=track.lastSeen));
  const used=new Set(),entered=[];
  for(const detection of detections){
    const [x,y,w,h]=detection.bbox;
    const px=clamp((x+w/2)/640,0,1),py=clamp((y+h)/360,0,1);
    let best=null,distance=.14;
    for(const track of active.values()){
      if(used.has(track.id))continue;
      const d=Math.hypot(px-track.x,py-track.y);
      if(d<distance){distance=d;best=track;}
    }
    const zone=zoneAtPoint(px,py,zones);
    if(!best){
      best={id:`tmp-${nextId++}`,firstSeen:mediaSeconds,lastSeen:mediaSeconds,x:px,y:py,zoneId:zone?.id||null,zoneEnteredAt:mediaSeconds,lastDwellEventAt:null,score:detection.score};
      entered.push(best.id);
    }else{
      if(best.zoneId!==(zone?.id||null)){best.zoneId=zone?.id||null;best.zoneEnteredAt=mediaSeconds;best.lastDwellEventAt=null;entered.push(best.id);}
      best.x=px;best.y=py;best.lastSeen=mediaSeconds;best.score=detection.score;
    }
    used.add(best.id);active.set(best.id,best);
  }
  return {tracks:active,nextId,entered};
}

export function shelfRule(previousPercent,currentPercent,threshold=25){
  if(!Number.isFinite(currentPercent))return null;
  if(currentPercent<=15&&previousPercent>15)return 'SHELF_EMPTY';
  if(currentPercent<=threshold&&previousPercent>threshold)return 'SHELF_LOW';
  if(Number.isFinite(previousPercent)&&currentPercent-previousPercent>=20)return 'RESTOCK_DETECTED';
  if(Number.isFinite(previousPercent)&&previousPercent-currentPercent>=20)return 'PRODUCT_REMOVED';
  return null;
}

export function safeOutbound(event){
  return {type:'retail_signal',shelf_id:'shelf-01',timestamp:new Date().toISOString(),event:event.type,zone:event.zone,confidence:clamp(Math.round(event.confidence*100),0,100),value:clamp(Math.round(event.value||0),0,1000)};
}
