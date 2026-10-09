// Files are deliberately named and served from an allow-list; no directory browsing.
export const recordings = [
  {id:'entrance-exit',purpose:'entry',file:'entrance-exit-pexels-4077491.mp4',title:'Revolving building door',detail:'People move through a revolving entrance · public sample · 20 seconds',visitSample:true,visitZones:{entrance:[.24,.42,.20,.55],exit:[.53,.42,.20,.55]}},
  {id:'store-entrance',purpose:'entry',file:'store-entrance-pexels-6641527.mp4',title:'Grocery store sliding doors',detail:'Exterior view of shoppers at grocery sliding doors · public sample · 20 seconds',visitSample:true,visitZones:{entrance:[.27,.4,.17,.55],exit:[.44,.4,.16,.55]}},
  {id:'store-exit',purpose:'entry',file:'store-exit-pexels-6565790.mp4',title:'Shoppers leaving a clothing store',detail:'Two shoppers visibly leave through the storefront · public exit-only sample · 9 seconds',visitSample:true,exitOnly:true,visitZones:{exit:[.05,.8,.9,.19]}},
  {id:'clip-03',purpose:'shelf',file:'clip-03.mp4',title:'Restocking the middle shelf',detail:'A shopper refills the middle shelf · 22 seconds · calibrated demo',calibration:{roi:[50,52,19,14],emptyAt:0.6,fullAt:21}},
  {id:'clip-02',purpose:'shelf',file:'clip-02.mp4',title:'Removing products from middle shelf',detail:'A shopper removes several middle-shelf products · 11 seconds',shelfRoi:[50,52,19,14]},
  {id:'clip-01',purpose:'shelf',file:'clip-01.mp4',title:'First middle-shelf pickup',detail:'A shopper reaches for a product on the middle shelf · 21 seconds',shelfRoi:[50,52,19,14]},
  {id:'clip-04',purpose:'shelf',file:'clip-04.mp4',title:'Stocked shelf snapshot',detail:'Stationary shelf view · half a second · reference only'},
  {id:'clip-05',purpose:'shelf',file:'clip-05.mp4',title:'Shelf after interaction',detail:'Short stationary view of the shelf after a shopper leaves · 6 seconds'},
  {id:'clip-06',purpose:'shelf',file:'clip-06.mp4',title:'Wide store context view',detail:'Wide view across the store and shelves · 3 seconds · not calibrated'},
  {id:'clip-07',purpose:'shelf',file:'clip-07.mp4',title:'Shopper examines a purple bottle',detail:'Shopper lifts and looks at a purple bottle from the shelf · 13 seconds',shelfRoi:[47,30,25,42]},
  {id:'clip-08',purpose:'shelf',file:'clip-08.mp4',title:'Shopper examines a green package',detail:'Shopper bends toward the lower shelf and inspects a green package · 14 seconds',shelfRoi:[47,30,25,42]},
  {id:'clip-09',purpose:'shelf',file:'clip-09.mp4',title:'Shopper compares two shelf items',detail:'Shopper holds a green package and purple bottle near the shelf · 12 seconds',shelfRoi:[47,30,25,42]},
  {id:'clip-10',purpose:'shelf',file:'clip-10.mp4',title:'Shopper reaches for a second item',detail:'Shopper holds one product while reaching toward a purple bottle · 17 seconds',shelfRoi:[47,30,25,42]}
];
