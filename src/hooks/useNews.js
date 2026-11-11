import { useState, useEffect } from 'react'

const API = 'https://api.rss2json.com/v1/api.json?rss_url='
const CACHE_KEY = 'nook_news_last'
const REFRESH_MS = 15 * 60 * 1000

const DEFAULT_FEEDS = [
  { label: 'Top Stories', url: 'https://feeds.npr.org/1001/rss.xml' },
  { label: 'Technology',  url: 'https://feeds.npr.org/1019/rss.xml' },
]

/**
 * Feeds come from VITE_NEWS_FEEDS as a JSON array of {label, url}, e.g.
 *
 *   VITE_NEWS_FEEDS=[{"label":"World","url":"https://feeds.bbci.co.uk/news/world/rss.xml"}]
 *
 * JSON rather than a delimited string because feed URLs contain the obvious
 * separators. Anything malformed falls back to the NPR defaults rather than
 * leaving the Media tab empty — a wall display should degrade, not break.
 */
function resolveFeeds() {
  const raw = import.meta.env.VITE_NEWS_FEEDS
  if (!raw) return DEFAULT_FEEDS
  try {
    const parsed = JSON.parse(raw)
    const valid = Array.isArray(parsed)
      ? parsed
          .filter(f => f && typeof f.url === 'string' && f.url.startsWith('http'))
          .map(f => ({ label: String(f.label || 'News'), url: f.url }))
      : []
    return valid.length ? valid : DEFAULT_FEEDS
  } catch {
    console.warn('VITE_NEWS_FEEDS is not valid JSON — using default feeds')
    return DEFAULT_FEEDS
  }
}

const FEEDS = resolveFeeds()

// Feed content is third-party: only http(s) links are ever shown or encoded.
function safeUrl(u) {
  return typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : null
}

function plainText(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  const text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
  return text.length > 400 ? text.slice(0, 397).trimEnd() + '…' : text
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch { return null }
}

export function useNews() {
  const [feeds, setFeeds] = useState(() => {
    const cached = readCache()
    return FEEDS.map(f => {
      const hit = cached?.[f.url]
      // Yesterday's headlines beat an empty grid while the first request is in
      // flight — or indefinitely, if the feed service is having a bad day.
      return { ...f, items: hit?.items || [], loading: !hit, error: null, stale: !!hit }
    })
  })

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const results = await Promise.all(FEEDS.map(async (feed) => {
        try {
          const res = await fetch(API + encodeURIComponent(feed.url))
          // rss2json is a free, shared-quota service with no API key, so
          // throttling and outages are a normal condition, not an edge case.
          if (!res.ok) throw new Error(`Feed service returned ${res.status}`)
          const data = await res.json()
          if (data.status !== 'ok') throw new Error(data.message || 'Feed error')
          const items = (data.items || []).slice(0, 8).map(i => {
            const when = i.pubDate ? new Date(i.pubDate.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(i.pubDate) ? '' : 'Z')) : null
            return {
              title:     i.title,
              link:      safeUrl(i.link),
              summary:   plainText(i.description || i.content || ''),
              date:      when && !isNaN(when) ? when.toISOString() : null,
              thumbnail: safeUrl(i.thumbnail || i.enclosure?.link || i.enclosure?.url),
            }
          }).filter(i => i.title)
          if (!items.length) throw new Error('Feed returned no items')
          return { url: feed.url, items, error: null }
        } catch (err) {
          return { url: feed.url, items: null, error: err.message }
        }
      }))

      if (cancelled) return

      setFeeds(prev => prev.map((f, i) => {
        const r = results[i]
        // On failure keep what is on screen and mark it stale, rather than
        // replacing real headlines with an error message.
        if (!r.items) return { ...f, loading: false, error: r.error, stale: f.items.length > 0 }
        return { ...f, items: r.items, loading: false, error: null, stale: false }
      }))

      const fresh = {}
      for (const r of results) if (r.items) fresh[r.url] = { items: r.items, at: Date.now() }
      if (Object.keys(fresh).length) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), ...fresh }))
        } catch { /* quota or private mode */ }
      }
    }

    load()
    const t = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  return feeds
}
