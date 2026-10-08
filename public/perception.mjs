// Compare shelf cells with empty and stocked references. No person model.
export function occupancy(frame, empty, full, columns=6, rows=3) {
  if (!frame || !empty || !full || frame.length !== empty.length || frame.length !== full.length || frame.length !== columns*rows*3) throw new Error('Invalid calibration vectors');
  let occupied=0, usable=0, observed=0;
  const tiles=[];
  for(let tile=0; tile<columns*rows; tile++) {
    let separation=0, de=0, df=0;
    for(let c=0;c<3;c++) {
      const i=tile*3+c;
      separation+=(empty[i]-full[i])**2;
      de+=(frame[i]-empty[i])**2;
      df+=(frame[i]-full[i])**2;
    }
    if(separation < 400) { tiles.push('unusable'); continue; }
    usable++;
    // Withhold a tile that matches neither reference or matches both nearly equally.
    if(Math.min(de,df)>Math.min(7500,Math.max(1200,separation*.35)) || Math.abs(de-df)<separation*.18){tiles.push('uncertain');continue;}
    observed++;
    const stocked=df < de;
    if(stocked) occupied++;
    tiles.push(stocked?'stocked':'empty');
  }
  if(usable < 6) throw new Error('References are too similar. Capture visibly empty and stocked shelf states in the same lighting.');
  const reliable=observed>=Math.max(6,Math.ceil(usable*.65));
  return {percent:reliable?Math.round(occupied/observed*100):null,usable,observed,reliable,tiles};
}
export const stockState = percent => percent <= 15 ? 'empty' : percent <= 45 ? 'low' : 'full';

export function createStockTracker(required=3){
  let current=null,candidate=null,count=0;
  return {
    update(state){
      if(!['full','low','empty'].includes(state))throw new Error('Invalid stock state');
      if(state===current){candidate=null;count=0;return current;}
      if(state!==candidate){candidate=state;count=1;}else count++;
      if(count>=required){current=state;candidate=null;count=0;}
      return current;
    },
    uncertain(){candidate=null;count=0;return current;},
    reset(){current=null;candidate=null;count=0;}
  };
}

// Suppress broad changes that are more consistent with camera or lighting shifts.
export function localizedMotion(frame,previous,columns=6,rows=3){
  if(!previous||frame.length!==previous.length||frame.length!==columns*rows*3)return false;
  let changed=0;
  for(let tile=0;tile<columns*rows;tile++){
    let delta=0;
    for(let c=0;c<3;c++)delta+=Math.abs(frame[tile*3+c]-previous[tile*3+c]);
    if(delta/3>15)changed++;
  }
  return changed>=1&&changed<=Math.floor(columns*rows*.6);
}
