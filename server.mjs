import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runLiveScan} from './collector/live-runtime.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PUBLIC=path.join(__dirname,'public');
const PORT=Number(process.env.PORT||4173);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'};
function json(res,code,value){const body=Buffer.from(JSON.stringify(value));res.writeHead(code,{'content-type':'application/json; charset=utf-8','content-length':body.length,'cache-control':'no-store'});res.end(body);}
function sendFile(res,file){if(!fs.existsSync(file)||!fs.statSync(file).isFile())return false;const ext=path.extname(file).toLowerCase(),body=fs.readFileSync(file);res.writeHead(200,{'content-type':MIME[ext]||'application/octet-stream','content-length':body.length,'cache-control':'no-store'});res.end(body);return true;}
function safePublicPath(urlPath){const clean=decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/,''),p=path.normalize(path.join(PUBLIC,clean||'index.html'));return p.startsWith(PUBLIC)?p:null;}
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(u.pathname==='/api/live'||u.pathname==='/api/events'){const scan=await runLiveScan(null,{concurrency:12,mode:'local-live'});return scan.accepted?json(res,200,scan.payload):json(res,503,{error:'Live collection failed',generatedAt:null,events:[],stats:scan.attemptStats});}const p=safePublicPath(u.pathname);if(p&&sendFile(res,p))return;sendFile(res,path.join(PUBLIC,'index.html'))||res.writeHead(404).end('Not found');});
server.listen(PORT,'127.0.0.1',()=>console.log(`SORTIR.BE live-only server: http://127.0.0.1:${PORT}`));
