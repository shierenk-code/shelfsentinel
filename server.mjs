import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {existsSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateEvent} from './public/contract.mjs';
import {recordings} from './public/recordings.mjs';
import {createVisitStore} from './visit-store.mjs';
const files = new Map(['index.html','styles.css','app.mjs','api.mjs','contract.mjs','perception.mjs','recordings.mjs','retail-app.mjs','retail-core.mjs','retail.css','model-bundle.mjs'].map(name=>['/'+(name==='index.html'?'':name),new URL('./public/'+name,import.meta.url)]));
const media = new Map(recordings.map(item=>['/recordings/'+item.file,new URL('./public/recordings/'+item.file,import.meta.url)]).filter(([,path])=>existsSync(path)));
const modelFiles=['model.json','group1-shard1of5','group1-shard2of5','group1-shard3of5','group1-shard4of5','group1-shard5of5'];
for(const name of modelFiles)files.set('/models/ssdlite_mobilenet_v2/'+name,new URL('./public/models/ssdlite_mobilenet_v2/'+name,import.meta.url));
const mime={html:'text/html',css:'text/css',mjs:'text/javascript',json:'application/json'};
export function createServer() {
  const state={events:[],audit:[],accepted:0,blocked:0,metrics:{interactions:0,status:null,stockoutSeconds:0,alertsResolved:0,lastResponseSeconds:null},alert:null};
  const visits=createVisitStore();
  function audit(reason){ state.blocked++; state.audit.unshift({timestamp:new Date().toISOString(),reason}); state.audit=state.audit.slice(0,50); }
  return http.createServer(async(req,res)=>{
    const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
    const origin=req.headers.origin;
    if(origin && origin !== `http://${req.headers.host}`) return json(403,{error:'ORIGIN_DENIED'});
    if(req.method==='GET' && req.url==='/api/dashboard') return json(200,state);
    if(req.method==='GET' && req.url==='/api/recordings') return json(200,{available:recordings.filter(item=>media.has('/recordings/'+item.file)).map(item=>item.id)});
    if(req.method==='GET' && req.url==='/api/visits') return json(200,visits.snapshot());
    if(req.method==='POST' && ['/api/visits/open','/api/visits/close','/api/visits/clear'].includes(req.url)) {
      if(req.headers['content-type']!=='application/json')return json(415,{ok:false,reason:'INVALID_CONTENT_TYPE'});
      let body='',size=0;
      try{for await(const chunk of req){size+=chunk.length;if(size>256)return json(413,{ok:false,reason:'PAYLOAD_TOO_LARGE'});body+=chunk.toString();}
        const input=JSON.parse(body);
        if(!input||typeof input!=='object'||Array.isArray(input))return json(422,{ok:false,reason:'INVALID_OBJECT'});
        if(req.url==='/api/visits/open'){
          if(Object.keys(input).length!==1||input.type!=='visit_open')return json(422,{ok:false,reason:'FORBIDDEN_FIELD'});
          return json(200,{ok:true,...visits.open(),activeCount:visits.snapshot().activeCount});
        }
        if(req.url==='/api/visits/close'){
          if(Object.keys(input).length!==2||input.type!=='visit_close'||typeof input.visitId!=='string'||!/^[0-9a-f-]{36}$/.test(input.visitId))return json(422,{ok:false,reason:'INVALID_VISIT'});
          if(!visits.close(input.visitId))return json(404,{ok:false,reason:'VISIT_NOT_ACTIVE'});
          return json(200,{ok:true,activeCount:visits.snapshot().activeCount});
        }
        if(Object.keys(input).length!==1||input.type!=='visit_clear')return json(422,{ok:false,reason:'FORBIDDEN_FIELD'});
        visits.clear();return json(200,{ok:true,activeCount:0});
      }catch{return json(400,{ok:false,reason:'INVALID_JSON'});}
    }
    if(req.method==='POST' && ['/api/reset','/api/acknowledge'].includes(req.url) && (req.headers['transfer-encoding'] || (req.headers['content-length'] && req.headers['content-length']!=='0'))) {audit('UNEXPECTED_ACTION_BODY');return json(413,{ok:false,reason:'UNEXPECTED_ACTION_BODY'});}
    if(req.method==='POST' && req.url==='/api/reset') {state.events=[];state.audit=[];state.accepted=0;state.blocked=0;state.metrics={interactions:0,status:null,stockoutSeconds:0,alertsResolved:0,lastResponseSeconds:null};state.alert=null;return json(200,{ok:true});}
    if(req.method==='POST' && req.url==='/api/acknowledge') {
      if(!state.alert || state.alert.acknowledgedAt) return json(409,{ok:false,reason:'NO_OPEN_ALERT'});
      state.alert.acknowledgedAt=new Date().toISOString();
      return json(200,{ok:true,alert:state.alert});
    }
    if(req.method==='POST' && req.url==='/api/events') {
      if(req.headers['content-type'] !== 'application/json') {audit('INVALID_CONTENT_TYPE');return json(415,{ok:false,reason:'INVALID_CONTENT_TYPE'});}
      let body=''; let size=0;
      try {
        for await (const chunk of req) { size+=chunk.length; if(size>2048){audit('PAYLOAD_TOO_LARGE');return json(413,{ok:false,reason:'PAYLOAD_TOO_LARGE'});} body+=chunk.toString(); }
        const event=JSON.parse(body);
        const verdict=validateEvent(event);
        if(!verdict.ok){audit(verdict.reason);return json(422,verdict);}
        state.accepted++; state.events.unshift(event);state.events=state.events.slice(0,200);
        if(event.type==='shelf_interaction')state.metrics.interactions+=event.count;
        if(event.type==='shelf_status'){
          if(event.state!=='empty'||state.metrics.status?.state!=='empty')state.metrics.stockoutSeconds=0;
          state.metrics.status=event;
          if(event.state==='low'||event.state==='empty') {
            if(!state.alert) state.alert={openedAt:new Date().toISOString(),severity:event.state,acknowledgedAt:null};
            else if(event.state==='empty') state.alert.severity='empty';
          } else if(state.alert) {
            state.metrics.alertsResolved++;
            state.metrics.lastResponseSeconds=Math.max(0,Math.round((Date.now()-Date.parse(state.alert.openedAt))/1000));
            state.alert=null;
          }
        }
        if(event.type==='stockout_duration'&&state.metrics.status?.state==='empty')state.metrics.stockoutSeconds=event.seconds;
        return json(200,{ok:true});
      } catch {audit('INVALID_JSON');return json(400,{ok:false,reason:'INVALID_JSON'});}
    }
    if(req.method==='GET' && files.has(req.url)) {
      try {const path=files.get(req.url);const extension=path.pathname.split('.').pop();res.writeHead(200,{'Content-Type':mime[extension]||'application/octet-stream', 'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; img-src 'self' blob:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}); res.end(await readFile(path));return;}catch{return json(500,{error:'FILE_UNAVAILABLE'});}
    }
    if((req.method==='GET'||req.method==='HEAD') && media.has(req.url)) {
      try {
        const path=media.get(req.url),size=(await stat(path)).size;
        const range=req.headers.range;
        let start=0,end=size-1,status=200;
        if(range){
          const match=/^bytes=(\d+)-(\d*)$/.exec(range);
          if(!match) {res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
          start=Number(match[1]);end=match[2]?Number(match[2]):size-1;
          if(start>=size||end<start||end>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
          status=206;
        }
        const headers={'Content-Type':'video/mp4','Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'};
        if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
        res.writeHead(status,headers);
        if(req.method==='HEAD')res.end();else createReadStream(path,{start,end}).pipe(res);
        return;
      }catch{return json(500,{error:'RECORDING_UNAVAILABLE'});}
    }
    json(404,{error:'NOT_FOUND'});
  });
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  const port=Number(process.env.PORT || 8787);
  createServer().listen(port,'127.0.0.1',()=>console.log(`ShelfSentinel is ready: http://127.0.0.1:${port}`));
}
