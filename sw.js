// Pixel Pulse : cache pour jouer même avec une connexion faible
var V="pp-2026-11-11-4";
var CORE=["/","/en/","/offline.html","/style.css","/fonts/bricolage.woff2","/fonts/nunito-sans.woff2","/fonts/silkscreen.woff2","/favicon.svg","/img/icon-192.png"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(V).then(function(c){return c.addAll(CORE)}).then(function(){return self.skipWaiting()}))});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x.indexOf("pp-")===0&&x!==V}).map(function(x){return caches.delete(x)}))}).then(function(){return self.clients.claim()}))});
function put(r,res){if(res&&res.ok&&res.type==="basic"){var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp)})}return res}
self.addEventListener("fetch",function(e){
  var r=e.request;if(r.method!=="GET")return;
  var u=new URL(r.url);if(u.origin!==location.origin)return;
  if(r.mode==="navigate"){
    e.respondWith(fetch(r).then(function(res){return put(r,res)}).catch(function(){return caches.match(r,{ignoreSearch:true}).then(function(hit){return hit||caches.match("/offline.html")})}));
    return;}
  e.respondWith(caches.match(r).then(function(hit){
    var net=fetch(r).then(function(res){return put(r,res)}).catch(function(){return hit});
    return hit||net}));
});
