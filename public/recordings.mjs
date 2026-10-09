// Files are deliberately named and served from an allow-list; no directory browsing.
export const recordings = [
  {id:'entrance-exit',file:'entrance-exit-pexels-4077491.mp4',title:'Entrance / exit sample',detail:'Generic building entrance · Pexels video 4077491 · 20 seconds',visitSample:true,visitZones:{entrance:[.24,.42,.20,.55],exit:[.53,.42,.20,.55]}},
  {id:'store-entrance',file:'store-entrance-pexels-6641527.mp4',title:'Store entrance sample',detail:'Grocery entrance · Pexels video 6641527 · 20 seconds',visitSample:true,visitZones:{entrance:[.27,.4,.17,.55],exit:[.44,.4,.16,.55]}},
  {id:'clip-03',file:'clip-03.mp4',title:'Restock the middle shelf',detail:'Best demo · empty shelf becomes stocked · 21 seconds',calibration:{roi:[42,40,32,32],emptyAt:0.6,fullAt:20}},
  {id:'clip-02',file:'clip-02.mp4',title:'Products removed from middle shelf',detail:'Stocked shelf becomes nearly empty · 11 seconds'},
  {id:'clip-01',file:'clip-01.mp4',title:'First product removal',detail:'Customer interaction at the shelf · 21 seconds'},
  {id:'clip-04',file:'clip-04.mp4',title:'Short shelf frame',detail:'Very short recording · may not play as motion'},
  {id:'clip-05',file:'clip-05.mp4',title:'Shelf after interaction',detail:'Short shelf view · 5 seconds'},
  {id:'clip-06',file:'clip-06.mp4',title:'Wide store view',detail:'Different camera angle · 3 seconds'},
  {id:'clip-07',file:'clip-07.mp4',title:'Pickup scenario 1',detail:'Supplied pickup recording'},
  {id:'clip-08',file:'clip-08.mp4',title:'Pickup scenario 2',detail:'Supplied pickup recording'},
  {id:'clip-09',file:'clip-09.mp4',title:'Pickup scenario 3',detail:'Supplied pickup recording'},
  {id:'clip-10',file:'clip-10.mp4',title:'Pickup scenario 4',detail:'Supplied pickup recording'}
];
