/* Lumitrace 应用离线 Service Worker（通用，按 scope 隔离各应用） */
const CACHE = 'lumitrace' + new URL(self.registration.scope).pathname.replace(/\//g, '-')
const SCOPE_PATH = new URL(self.registration.scope).pathname

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // 导航请求：网络优先，离线时回退到缓存的入口页
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const net = await fetch(req)
        const cache = await caches.open(CACHE)
        cache.put(SCOPE_PATH, net.clone())
        return net
      } catch {
        const cache = await caches.open(CACHE)
        return (await cache.match(SCOPE_PATH)) || (await cache.match(req)) || Response.error()
      }
    })())
    return
  }

  // 静态资源（内容哈希命名）：缓存优先，回源后写入缓存
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const hit = await cache.match(req)
    if (hit) return hit
    try {
      const net = await fetch(req)
      if (net.ok && net.type === 'basic') cache.put(req, net.clone())
      return net
    } catch {
      return hit || Response.error()
    }
  })())
})
