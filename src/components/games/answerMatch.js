// Answer checking shared by Family Feud and Jeopardy.
//
// The old check accepted any substring, so "ton" matched "Washington" and
// "a" matched nearly everything. This one compares whole words only:
//   - the full answer, ignoring case, accents, punctuation, "the/a/their" and
//     simple plurals ("Dogs" = "dog");
//   - the key words of the answer in order, as long as they include the last
//     word ("Washington" or "George Washington" for "George Washington",
//     "Gettysburg" for "Battle of Gettysburg", "phone" for "Check their phone");
//   - every word of the answer inside a slightly longer reply ("my phone");
//   - one typo in words of five letters or more, two from nine letters.
// Numbers must match exactly.

const FILLER = new Set(['a', 'an', 'the', 'their', 'your', 'its', 'my', 'his', 'her', 'our', 'some'])

function tokens(text) {
  return String(text ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(w => w && !FILLER.has(w))
    .map(w => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
}

export function normalizeAnswer(text) {
  return tokens(text).join(' ')
}

function distance(a, b) {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return prev[b.length]
}

function allowance(word) {
  if (/^\d+$/.test(word)) return 0
  if (word.length >= 9) return 2
  if (word.length >= 5) return 1
  return 0
}

function sameWord(a, b) {
  if (a === b) return true
  return distance(a, b) <= Math.min(allowance(a), allowance(b))
}

// True when every word of `part` appears in `whole`, in order.
function inOrder(part, whole) {
  let j = 0
  for (const w of part) {
    while (j < whole.length && !sameWord(w, whole[j])) j++
    if (j === whole.length) return false
    j++
  }
  return true
}

export function answersMatch(submitted, correct) {
  const s = tokens(submitted)
  const c = tokens(correct)
  if (s.length === 0 || c.length === 0) return false

  if (c.every(w => /^\d+$/.test(w))) return s.join(' ') === c.join(' ')

  if (s.length === c.length && s.every((w, i) => sameWord(w, c[i]))) return true

  // A shorter reply made of the answer's words, ending on its key word.
  if (s.length < c.length && inOrder(s, c) && sameWord(s[s.length - 1], c[c.length - 1])) return true

  // The whole answer said inside a slightly longer reply.
  if (s.length > c.length && s.length <= c.length + 2 && inOrder(c, s)) return true

  return false
}
