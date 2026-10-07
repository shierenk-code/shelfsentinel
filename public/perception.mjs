// Compare each shelf tile with empty and stocked reference images. No person model.
export function occupancy(frame, empty, full, columns=6, rows=3) {
  if (!frame || !empty || !full || frame.length !== empty.length || frame.length !== full.length || frame.length !== columns*rows*3) throw new Error('Invalid calibration vectors');
  let occupied=0, usable=0;
  for(let tile=0; tile<columns*rows; tile++) {
    let separation=0, de=0, df=0;
    for(let c=0;c<3;c++) {
      const i=tile*3+c;
      separation+=(empty[i]-full[i])**2;
      de+=(frame[i]-empty[i])**2;
      df+=(frame[i]-full[i])**2;
    }
    if(separation < 400) continue;
    usable++;
    if(df < de) occupied++;
  }
  if(usable < 6) throw new Error('References are too similar. Capture visibly empty and stocked shelf states in the same lighting.');
  return {percent: Math.round(occupied / usable * 100), usable};
}
export const stockState = percent => percent <= 15 ? 'empty' : percent <= 45 ? 'low' : 'full';
