import { useState, useEffect } from 'react'

const API = 'https://api.rss2json.com/v1/api.json?rss_url='

const FEEDS = [
  { label: 'Top Stories', url: 'https://feeds.npr.org/1001/rss.xml' },
  { label: 'Technology',  url: 'https://feeds.npr.org/1019/rss.xml' },
]

export function useNews() {
  const [feeds, setFeeds] = useState(FEEDS.map(f => ({ ...f, items: [], loading: true, error: null })))

  useEffect(() => {
    FEEDS.forEach((feed, idx) => {
      fetch(API + encodeURIComponent(feed.url))
        .then(r => r.json())
        .then(data => {
          if (data.status !== 'ok') throw new Error(data.message || 'Feed error')
          const items = (data.items || []).slice(0, 8).map(i => ({
            title: i.title,
            link:  i.link,
            date:  i.pubDate ? new Date(i.pubDate).toISOString() : null,
          })).filter(i => i.title)
          setFeeds(prev => prev.map((f, i) => i === idx ? { ...f, items, loading: false } : f))
        })
        .catch(err => {
          setFeeds(prev => prev.map((f, i) => i === idx ? { ...f, loading: false, error: err.message } : f))
        })
    })
  }, [])

  return feeds
}
