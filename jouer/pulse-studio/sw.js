var V="pulse-v30";
var CORE=["./","index.html","manifest.json","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(V).then(function(c){return c.addAll(CORE)}).then(function(){return self.skipWaiting()}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x.indexOf("pulse-")===0&&x!==V}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
function put(r,res){if(res&&(res.ok||res.type==="opaque")){var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp)})}return res}
self.addEventListener("fetch",function(e){
  var r=e.request;if(r.method!=="GET")return;
  var u=new URL(r.url),same=u.origin===location.origin,ok=same||/cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u.hostname);
  if(!ok)return;
  if(r.mode==="navigate"||(same&&/\.html$/.test(u.pathname))){
    e.respondWith(fetch(r).then(function(res){return put(r,res)}).catch(function(){return caches.match(r,{ignoreSearch:true}).then(function(hit){return hit||caches.match("index.html")})}));return}
  e.respondWith(caches.match(r).then(function(hit){
    var net=fetch(r).then(function(res){return put(r,res)}).catch(function(){return hit});
    return hit||net}))});
