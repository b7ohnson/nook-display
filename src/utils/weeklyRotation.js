function getWeekSeed() {
  const d = new Date()
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dow = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7)
  return utc.getUTCFullYear() * 1000 + week
}

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function weeklyShuffled(arr) {
  const rand = mulberry32(getWeekSeed())
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
