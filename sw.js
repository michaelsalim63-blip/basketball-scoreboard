'use strict';
const CACHE='courtside-v1-0-1-release';
const ASSETS=['./','./index.html','./app.js?v=1.0.1','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{
  // Bypass the HTTP cache so the offline bundle contains one complete release.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(asset=>new Request(new URL(asset,self.registration.scope),{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('courtside-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  const url=new URL(event.request.url);
  const asset=ASSETS.find(path=>{const target=new URL(path,self.registration.scope);return target.pathname===url.pathname&&(!url.pathname.endsWith('.js')||target.search===url.search)});
  if(!asset)return;
  // Serve each HTML/script pair from the release installed together.
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(new URL(asset,self.registration.scope).href);
    if(cached)return cached;
    return fetch(event.request,{cache:'no-store'});
  }));
});
