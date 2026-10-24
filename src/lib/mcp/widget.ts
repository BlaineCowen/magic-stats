/**
 * The result card ChatGPT and Claude show under a tool call: a sortable table,
 * or the "make the case" findings. One self-contained page (hosts sandbox it
 * with no network access), fed the tool's structuredContent by either host:
 * ChatGPT through window.openai, Claude and other MCP Apps hosts through
 * JSON-RPC postMessage (ui/initialize, then ui/notifications/tool-result).
 */

export const WIDGET_URI = "ui://magic-stats/card-v1.html";
// MCP Apps profile; ChatGPT accepts it alongside its own text/html+skybridge.
export const WIDGET_MIME = "text/html;profile=mcp-app";

export const WIDGET_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#fff;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--head:#f8fafc;--accent:#166534;--hi:#f0fdf4;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0f172a;--ink:#e2e8f0;--muted:#94a3b8;--line:#1e293b;--head:#111c33;--accent:#4ade80;--hi:#052e16;color-scheme:dark}}
:root[data-theme=dark]{--bg:#0f172a;--ink:#e2e8f0;--muted:#94a3b8;--line:#1e293b;--head:#111c33;--accent:#4ade80;--hi:#052e16;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{padding:12px 14px}
h1{font-size:15px;margin:0 0 2px;font-weight:650}
.note{color:var(--muted);font-size:12.5px;margin:0 0 10px}
.scroll{overflow:auto;max-height:420px;border:1px solid var(--line);border-radius:8px}
table{border-collapse:separate;border-spacing:0;width:100%;font-variant-numeric:tabular-nums;font-size:13px}
th,td{padding:6px 10px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--line)}
th:first-child,td:first-child{text-align:left}
td.txt,th.txt{text-align:left}
.card th{position:static;cursor:default;background:none;padding:3px 6px}
th{position:sticky;top:0;background:var(--head);font-weight:600;color:var(--muted);font-size:12px;cursor:pointer;user-select:none}
th[aria-sort] {color:var(--ink)}
th[aria-sort=descending]::after{content:" \\2193";color:var(--accent)}
th[aria-sort=ascending]::after{content:" \\2191";color:var(--accent)}
tr:last-child td{border-bottom:0}
tr.me td{background:var(--hi);font-weight:600}
.cards{display:grid;gap:10px}
.card{border:1px solid var(--line);border-radius:8px;padding:10px 12px}
.card h2{font-size:13.5px;margin:0 0 6px;font-weight:600}
.rank{color:var(--accent);font-weight:700}
.card table{font-size:12.5px}
.card td{padding:3px 6px}
.foot{color:var(--muted);font-size:11.5px;margin-top:10px}
.foot a{color:inherit}
</style></head>
<body><div class="wrap" id="root"><p class="note">Loading…</p></div>
<script>
(function(){
var root=document.getElementById("root");
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function fmt(v){if(v==null)return"";if(typeof v!=="number")return esc(v);if(Number.isInteger(v))return String(v);var a=Math.abs(v);return String(Number(v.toFixed(a<1?3:a<10?2:a<100?1:0)))}
var FOOT='<p class="foot">Magic Stats. Data: nflverse (CC-BY 4.0).</p>';
function table(d){
  var sort=null,desc=true,rows=d.rows.slice();
  // A column with no values (breakout % for players already at starter level) only takes room.
  d={title:d.title,note:d.note,rows:d.rows,columns:d.columns.filter(function(c){return d.rows.some(function(r){return r[c.key]!=null&&r[c.key]!==""})})};
  function draw(){
    var h='<h1>'+esc(d.title)+'</h1>'+(d.note?'<p class="note">'+esc(d.note)+'</p>':'');
    h+='<div class="scroll"><table><thead><tr>';
    d.columns.forEach(function(c,i){
      var txt=typeof (d.rows[0]||{})[c.key]==="string";
      h+='<th data-i="'+i+'" class="'+(txt?"txt":"")+'"'+(sort===c.key?' aria-sort="'+(desc?"descending":"ascending")+'"':'')+'>'+esc(c.label)+'</th>'});
    h+='</tr></thead><tbody>';
    rows.forEach(function(r){h+='<tr>';d.columns.forEach(function(c){h+='<td class="'+(typeof r[c.key]==="string"?"txt":"")+'">'+fmt(r[c.key])+'</td>'});h+='</tr>'});
    root.innerHTML=h+'</tbody></table></div>'+FOOT;
    root.querySelectorAll("th").forEach(function(th){th.onclick=function(){
      var k=d.columns[+th.dataset.i].key;desc=sort===k?!desc:true;sort=k;
      rows.sort(function(a,b){var x=a[k],y=b[k];if(x==null)return 1;if(y==null)return -1;
        var c=typeof x==="number"&&typeof y==="number"?x-y:String(x).localeCompare(String(y),undefined,{numeric:true});return desc?-c:c});
      draw()}});
    size();
  }
  draw();
}
function ord(n){var s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function proof(p){
  var h='<h1>The case '+(p.worst?"against ":"for ")+esc(p.player)+'</h1><p class="note">'+esc(p.scope)+(p.note?". "+esc(p.note):"")+'</p><div class="cards">';
  p.findings.forEach(function(f){
    var place=p.worst?(f.rank===1?"Last":ord(f.rank)+" from the bottom"):ord(f.rank);
    h+='<div class="card"><h2><span class="rank">'+place+(f.tied?" (tied)":"")+'</span> of '+f.pool+' '+esc(f.noun)+': '+esc(f.title)+'</h2><table><thead><tr><th></th><th class="txt">'+esc(f.entity)+'</th><th class="txt">Team</th><th>'+esc(f.column)+'</th><th>'+esc(f.sampleLabel)+'</th></tr></thead>';
    f.rows.forEach(function(r){h+='<tr class="'+(r.target?"me":"")+'"><td>'+r.rank+'</td><td class="txt">'+esc(r.player)+'</td><td class="txt">'+esc(r.team)+'</td><td>'+esc(r.value)+'</td><td>'+r.sample+'</td></tr>'});
    h+='</table></div>'});
  root.innerHTML=h+'</div>'+FOOT;size();
}
function render(d){
  if(!d||typeof d!=="object")return;
  if(d.view==="table"&&d.columns)table(d);
  else if(d.view==="case"&&d.proof)proof(d.proof);
  else if(d.title){root.innerHTML='<h1>'+esc(d.title)+'</h1>'+FOOT;size()}
}
// MCP Apps hosts
var nextId=1,inited=false;
function send(m){window.parent.postMessage(Object.assign({jsonrpc:"2.0"},m),"*")}
function size(){if(inited)send({method:"ui/notifications/size-changed",params:{height:document.documentElement.scrollHeight}})}
window.addEventListener("message",function(e){
  var m=e.data;if(!m||m.jsonrpc!=="2.0")return;
  if(m.id===1&&m.result){inited=true;var t=m.result.hostContext&&m.result.hostContext.theme;if(t)document.documentElement.dataset.theme=t;send({method:"ui/notifications/initialized",params:{}});size()}
  if(m.method==="ui/notifications/tool-result"&&m.params)render(m.params.structuredContent);
  if(m.method==="ui/notifications/host-context-changed"&&m.params&&m.params.theme)document.documentElement.dataset.theme=m.params.theme;
});
send({id:nextId++,method:"ui/initialize",params:{protocolVersion:"2026-01-26",appInfo:{name:"magic-stats-card",version:"1"},appCapabilities:{}}});
// ChatGPT
function fromOpenai(){var o=window.openai;if(!o)return;if(o.theme)document.documentElement.dataset.theme=o.theme;if(o.toolOutput)render(o.toolOutput)}
fromOpenai();
window.addEventListener("openai:set_globals",fromOpenai);
})();
</script></body></html>`;
