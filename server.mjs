import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateEvent} from './public/contract.mjs';
const files = new Map(['index.html','styles.css','app.mjs','api.mjs','contract.mjs','perception.mjs'].map(name=>['/'+(name==='index.html'?'':name),new URL('./public/'+name,import.meta.url)]));
const mime={html:'text/html',css:'text/css',mjs:'text/javascript'};
export function createServer() {
  const state={events:[],audit:[],accepted:0,blocked:0,metrics:{interactions:0,status:null,stockoutSeconds:0}};
  function audit(reason){ state.blocked++; state.audit.unshift({timestamp:new Date().toISOString(),reason}); state.audit=state.audit.slice(0,50); }
  return http.createServer(async(req,res)=>{
    const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
    const origin=req.headers.origin;
    if(origin && origin !== `http://${req.headers.host}`) return json(403,{error:'ORIGIN_DENIED'});
    if(req.method==='GET' && req.url==='/api/dashboard') return json(200,state);
    if(req.method==='POST' && req.url==='/api/reset') {state.events=[];state.audit=[];state.accepted=0;state.blocked=0;state.metrics={interactions:0,status:null,stockoutSeconds:0};return json(200,{ok:true});}
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
        }
        if(event.type==='stockout_duration'&&state.metrics.status?.state==='empty')state.metrics.stockoutSeconds=event.seconds;
        return json(200,{ok:true});
      } catch {audit('INVALID_JSON');return json(400,{ok:false,reason:'INVALID_JSON'});}
    }
    if(req.method==='GET' && files.has(req.url)) {
      try {const path=files.get(req.url);res.writeHead(200,{'Content-Type':mime[path.pathname.split('.').pop()], 'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; img-src 'self' blob:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}); res.end(await readFile(path));return;}catch{return json(500,{error:'FILE_UNAVAILABLE'});}
    }
    json(404,{error:'NOT_FOUND'});
  });
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  const port=Number(process.env.PORT || 8787);
  createServer().listen(port,'127.0.0.1',()=>console.log(`ShelfSentinel is ready: http://127.0.0.1:${port}`));
}
