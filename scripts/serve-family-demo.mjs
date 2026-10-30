// Local-only allowlisted synthetic demonstration. Never a production app/server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['tests/fixtures/family-integration.html',...['creative-workspace.css','owner-app.css','mobile-owner-workflow.js','owner-app.js','creative-media.js','creative-workspace.js'].map(s=>'MyPersonas.Online_v0/'+s)];
http.createServer((req,res)=>{
 if(req.headers.host!=='127.0.0.1:8786'||req.method!=='GET'){res.writeHead(403);return res.end()}
 const name=req.url==='/'?files[0]:req.url?.slice(1);
 if(!files.includes(name)){res.writeHead(404);return res.end()}
 res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':'text/javascript','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src blob: data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",'X-Content-Type-Options':'nosniff'});
 res.end(fs.readFileSync(path.join(root,name)));
}).listen(8786,'127.0.0.1',()=>console.log('Synthetic demo only: http://127.0.0.1:8786 (no outbound connections; Ctrl+C stops)'));
