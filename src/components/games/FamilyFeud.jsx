import { useState, useEffect, useRef, useMemo } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import GamePanel from './GamePanel'
import { FEUD_SURVEYS, FAST_MONEY_QUESTIONS } from '../../data/familyFeudSeed'
import { useGameRoom, generateRoomCode } from '../../hooks/useGameRoom'

const COMPANION_URL = 'https://skylight-16f44.web.app'
const MAX_STRIKES  = 3
const TEAM_COLORS  = ['#e11d48', '#2563eb']
const MULTIPLIERS  = [1, 1, 2, 3]
const MAIN_ROUNDS  = 4
const FM_COUNT     = 5

function normalizeAnswer(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\b(a|an|the|their|your|its|my)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function answersMatch(submitted, correct) {
  const s = normalizeAnswer(submitted)
  const c = normalizeAnswer(correct)
  if (!s || !c) return false
  if (s === c) return true
  if (s.length >= 3 && (c.includes(s) || s.includes(c))) return true
  const words = s.split(' ').filter(w => w.length >= 3)
  return words.length > 0 && words.every(w => c.includes(w))
}

function calcFmScore(answers, questions) {
  return answers.reduce((sum, ans, i) => {
    if (!ans) return sum
    const match = questions[i].answers.find(a => answersMatch(ans, a.text))
    return sum + (match ? match.pts : 0)
  }, 0)
}

export default function FamilyFeud({ onExit }) {
  const [roomCode] = useState(generateRoomCode)

  const [phase, setPhase]       = useState('setup')
  const [names, setNames]       = useState(['Family 1', 'Family 2'])
  const [scores, setScores]     = useState([0, 0])
  const [roundIdx, setRoundIdx] = useState(0)

  const [revealed, setRevealed] = useState(new Set())
  const [strikes, setStrikes]   = useState(0)
  const [active, setActive]     = useState(0)
  const [stealing, setStealing] = useState(false)
  const [showAll, setShowAll]   = useState(false)

  const [faceofState, setFaceofState] = useState('open')
  const [faceofRank1, setFaceofRank1] = useState(null)
  const [faceofTeam1, setFaceofTeam1] = useState(null)

  const [fmPhase, setFmPhase]         = useState('intro')
  const [fmTeam, setFmTeam]           = useState(0)
  const [fmCurrentQ, setFmCurrentQ]   = useState(0)
  const [fmAnswers1, setFmAnswers1]   = useState(Array(FM_COUNT).fill(''))
  const [fmAnswers2, setFmAnswers2]   = useState(Array(FM_COUNT).fill(''))
  const [fmTimerStart, setFmTimerStart] = useState(null)
  const [fmDuplicate, setFmDuplicate] = useState(false)
  const [fmTimeLeft, setFmTimeLeft]   = useState(20)
  const [fmManualText, setFmManualText] = useState('')

  const roomDocRef  = useRef(null)
  const roomCreated = useRef(false)
  const lastBoardVerified  = useRef(null)
  const lastFaceofVerified = useRef(null)
  const lastFmVerified     = useRef(null)

  const revealedRef    = useRef(revealed)
  const strikesRef     = useRef(strikes)
  const stealingRef    = useRef(stealing)
  const showAllRef     = useRef(showAll)
  const roundIdxRef    = useRef(roundIdx)
  const activeRef      = useRef(active)
  const faceofStateRef = useRef('open')
  const faceofRank1Ref = useRef(null)
  const faceofTeam1Ref = useRef(null)
  const fmPhaseRef     = useRef('intro')
  const fmAnswers1Ref  = useRef(Array(FM_COUNT).fill(''))
  const fmAnswers2Ref  = useRef(Array(FM_COUNT).fill(''))
  const fmCurrentQRef  = useRef(0)


  const { players, payload, createRoom, removeRoom } = useGameRoom(roomCode)

  const playUrl = `${COMPANION_URL}/play/${roomCode}`
  const qrUrl   = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(playUrl)}`,
    [roomCode] // eslint-disable-line
  )

  useEffect(() => {
    roomDocRef.current = doc(db, 'gameRooms', roomCode)
    if (roomCreated.current) return
    roomCreated.current = true
    createRoom('feud')
    return () => removeRoom()
  }, []) // eslint-disable-line

  const survey     = FEUD_SURVEYS[roundIdx % FEUD_SURVEYS.length]
  const multiplier = roundIdx < MULTIPLIERS.length ? MULTIPLIERS[roundIdx] : 1

  const closeBuzzers = () =>
    updateDoc(roomDocRef.current, {
      'payload.buzzersOpen':     false,
      'payload.buzzedBy':        null,
      'payload.submittedAnswer': null,
      'payload.answerResult':    null,
    })

  const startFaceof = (idx) => {
    const s = FEUD_SURVEYS[idx % FEUD_SURVEYS.length]
    setFaceofState('open')
    setFaceofRank1(null)
    setFaceofTeam1(null)
    faceofStateRef.current = 'open'
    faceofRank1Ref.current = null
    faceofTeam1Ref.current = null
    setPhase('faceof')
    lastFaceofVerified.current = null
    lastBoardVerified.current  = null
    updateDoc(roomDocRef.current, {
      'payload.phase':           'faceof',
      'payload.faceofState':     'open',
      'payload.activeTeam':      null,
      'payload.buzzersOpen':     players.length > 0,
      'payload.buzzedBy':        null,
      'payload.submittedAnswer': null,
      'payload.answerResult':    null,
      'payload.strikes':         0,
      'payload.stealing':        false,
      'payload.stealTeam':       null,
      'payload.questionText':    s.question,
      'payload.teamNames':       names,
    })
  }

  const moveToBoard = (winningTeam) => {
    setActive(winningTeam)
    activeRef.current = winningTeam
    setPhase('board')
    updateDoc(roomDocRef.current, {
      'payload.phase':           'board',
      'payload.faceofState':     'done',
      'payload.activeTeam':      winningTeam,
      'payload.buzzersOpen':     players.length > 0,
      'payload.buzzedBy':        null,
      'payload.submittedAnswer': null,
      'payload.answerResult':    null,
    })
  }

  const goNextRound = (idx) => {
    setRoundIdx(idx)
    roundIdxRef.current = idx
    const emptyRev = new Set()
    revealedRef.current = emptyRev
    setRevealed(emptyRev)
    strikesRef.current = 0
    setStrikes(0)
    stealingRef.current = false
    setStealing(false)
    showAllRef.current = false
    setShowAll(false)
    startFaceof(idx)
  }

  const startFastMoney = () => {
    const winTeam = scores[0] >= scores[1] ? 0 : 1
    const empty   = Array(FM_COUNT).fill('')
    setFmTeam(winTeam)
    setFmPhase('intro')
    fmPhaseRef.current = 'intro'
    setFmCurrentQ(0)
    fmCurrentQRef.current = 0
    setFmAnswers1(empty)
    setFmAnswers2(empty)
    fmAnswers1Ref.current = empty
    fmAnswers2Ref.current = empty
    setFmTimerStart(null)
    setFmDuplicate(false)
    setFmTimeLeft(20)
    setFmManualText('')
    setPhase('fastmoney')
    updateDoc(roomDocRef.current, {
      'payload.phase':        'fastmoney',
      'payload.fmPhase':      'intro',
      'payload.fmTeam':       winTeam,
      'payload.fmCurrentQ':   0,
      'payload.fmAnswers1':   empty,
      'payload.fmAnswers2':   empty,
      'payload.fmTimerStart': null,
      'payload.fmDuplicate':  false,
      'payload.fmSubmit':     null,
      'payload.questionText': FAST_MONEY_QUESTIONS[0].question,
      'payload.buzzersOpen':  false,
      'payload.buzzedBy':     null,
    })
  }

  // ── Face-off auto-verify ──────────────────────────────────────
  useEffect(() => {
    if (phase !== 'faceof') return
    const sub = payload.submittedAnswer
    if (!sub) return
    const key = `${sub.id}:${sub.submittedAt}`
    if (key === lastFaceofVerified.current) return
    lastFaceofVerified.current = key

    const s    = FEUD_SURVEYS[roundIdxRef.current % FEUD_SURVEYS.length]
    const rank = s.answers.findIndex(a => answersMatch(sub.text, a.text))

    if (faceofStateRef.current === 'open') {
      if (rank === 0) {
        updateDoc(roomDocRef.current, {
          'payload.answerResult':    'found',
          'payload.buzzedBy':        null,
          'payload.submittedAnswer': null,
          'payload.buzzersOpen':     false,
        })
        setTimeout(() => moveToBoard(sub.team ?? 0), 1500)
      } else {
        const storedRank  = rank < 0 ? 999 : rank
        const counterTeam = 1 - (sub.team ?? 0)
        setFaceofRank1(storedRank)
        setFaceofTeam1(sub.team ?? 0)
        setFaceofState('counter')
        faceofRank1Ref.current = storedRank
        faceofTeam1Ref.current = sub.team ?? 0
        faceofStateRef.current = 'counter'
        updateDoc(roomDocRef.current, {
          'payload.faceofState':     'counter',
          'payload.faceofRank1':     storedRank,
          'payload.faceofTeam1':     sub.team ?? 0,
          'payload.answerResult':    rank >= 0 ? 'found' : 'strike',
          'payload.buzzedBy':        null,
          'payload.submittedAnswer': null,
          'payload.buzzersOpen':     false,
          'payload.activeTeam':      counterTeam,
        })
        setTimeout(() => {
          updateDoc(roomDocRef.current, {
            'payload.buzzersOpen':  players.length > 0,
            'payload.answerResult': null,
          })
        }, 1500)
      }
    } else if (faceofStateRef.current === 'counter') {
      const r1  = faceofRank1Ref.current ?? 999
      const t1  = faceofTeam1Ref.current ?? 0
      const counterWins = rank >= 0 && rank < r1
      const winner      = counterWins ? (1 - t1) : t1
      updateDoc(roomDocRef.current, {
        'payload.answerResult':    rank >= 0 ? 'found' : 'strike',
        'payload.buzzedBy':        null,
        'payload.submittedAnswer': null,
        'payload.buzzersOpen':     false,
      })
      setTimeout(() => moveToBoard(winner), 1500)
    }
  }, [payload.submittedAnswer]) // eslint-disable-line

  // ── Board auto-verify ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'board') return
    const sub = payload.submittedAnswer
    if (!sub) return
    const key = `${sub.id}:${sub.submittedAt}`
    if (key === lastBoardVerified.current) return
    lastBoardVerified.current = key
    if (showAllRef.current) return

    const s       = FEUD_SURVEYS[roundIdxRef.current % FEUD_SURVEYS.length]
    const mult    = roundIdxRef.current < MULTIPLIERS.length ? MULTIPLIERS[roundIdxRef.current] : 1
    const curRev  = revealedRef.current
    const curStr  = strikesRef.current
    const curSteal = stealingRef.current
    const curActive = activeRef.current

    const pot = [...curRev].reduce((sum, i) => sum + s.answers[i].pts * mult, 0)

    let foundIdx = -1
    for (let i = 0; i < s.answers.length; i++) {
      if (!curRev.has(i) && answersMatch(sub.text, s.answers[i].text)) {
        foundIdx = i; break
      }
    }

    if (foundIdx >= 0) {
      const pts      = s.answers[foundIdx].pts * mult
      const newRev   = new Set([...curRev, foundIdx])
      revealedRef.current = newRev
      setRevealed(newRev)

      if (curSteal) {
        const totalPot   = pot + pts
        const stealerIdx = sub.team ?? 0
        setScores(sc => sc.map((v, i) => i === stealerIdx ? v + totalPot : v))
        updateDoc(roomDocRef.current, {
          'payload.answerResult':    'found',
          'payload.foundAnswerIdx':  foundIdx,
          'payload.buzzedBy':        null,
          'payload.submittedAnswer': null,
        })
        setTimeout(() => {
          showAllRef.current = true
          setShowAll(true)
          updateDoc(roomDocRef.current, {
            'payload.buzzersOpen':  false,
            'payload.answerResult': null,
            'payload.stealing':     false,
            'payload.stealTeam':    null,
          })
        }, 1500)
      } else {
        setScores(sc => sc.map((v, i) => i === (sub.team ?? 0) ? v + pts : v))
        const allFound = newRev.size === s.answers.length
        updateDoc(roomDocRef.current, {
          'payload.answerResult':    'found',
          'payload.foundAnswerIdx':  foundIdx,
          'payload.buzzedBy':        null,
          'payload.submittedAnswer': null,
          'payload.strikes':         curStr,
        })
        setTimeout(() => {
          if (allFound) {
            showAllRef.current = true
            setShowAll(true)
            updateDoc(roomDocRef.current, {
              'payload.buzzersOpen':  false,
              'payload.answerResult': null,
              'payload.stealing':     false,
              'payload.stealTeam':    null,
            })
          } else {
            updateDoc(roomDocRef.current, {
              'payload.buzzersOpen':  players.length > 0,
              'payload.answerResult': null,
            })
          }
        }, 1500)
      }
    } else {
      const newStr = curStr + 1
      strikesRef.current = newStr
      setStrikes(newStr)
      updateDoc(roomDocRef.current, {
        'payload.answerResult':    'strike',
        'payload.strikes':         newStr,
        'payload.buzzedBy':        null,
        'payload.submittedAnswer': null,
      })

      if (curSteal) {
        setTimeout(() => {
          if (pot > 0) setScores(sc => sc.map((v, i) => i === curActive ? v + pot : v))
          showAllRef.current = true
          setShowAll(true)
          updateDoc(roomDocRef.current, {
            'payload.buzzersOpen':  false,
            'payload.answerResult': null,
            'payload.stealing':     false,
            'payload.stealTeam':    null,
          })
        }, 1500)
      } else if (newStr >= MAX_STRIKES) {
        const stealIdx = 1 - (sub.team ?? 0)
        stealingRef.current = true
        setStealing(true)
        setTimeout(() => {
          updateDoc(roomDocRef.current, {
            'payload.buzzersOpen':  players.length > 0,
            'payload.answerResult': null,
            'payload.stealing':     true,
            'payload.stealTeam':    stealIdx,
            'payload.activeTeam':   stealIdx,
          })
        }, 1500)
      } else {
        setTimeout(() => {
          updateDoc(roomDocRef.current, {
            'payload.buzzersOpen':  players.length > 0,
            'payload.answerResult': null,
          })
        }, 1000)
      }
    }
  }, [payload.submittedAnswer]) // eslint-disable-line

  // ── Fast Money auto-verify ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'fastmoney') return
    const sub = payload.fmSubmit
    if (!sub) return
    const key = `${sub.playerId}:${sub.submittedAt}`
    if (key === lastFmVerified.current) return
    lastFmVerified.current = key

    const qIdx = sub.qIdx
    const q    = FAST_MONEY_QUESTIONS[qIdx]
    let best   = sub.text
    for (const a of q.answers) {
      if (answersMatch(sub.text, a.text)) { best = a.text; break }
    }

    if (fmPhaseRef.current === 'p1') {
      const next1 = [...fmAnswers1Ref.current]
      next1[qIdx] = best
      setFmAnswers1(next1)
      fmAnswers1Ref.current = next1
      const nextQ = qIdx + 1
      if (nextQ >= FM_COUNT) {
        setFmPhase('p1_done')
        fmPhaseRef.current = 'p1_done'
        setFmCurrentQ(0)
        fmCurrentQRef.current = 0
        updateDoc(roomDocRef.current, {
          'payload.fmPhase':    'p1_done',
          'payload.fmAnswers1': next1,
          'payload.fmSubmit':   null,
          'payload.fmCurrentQ': 0,
        })
      } else {
        setFmCurrentQ(nextQ)
        fmCurrentQRef.current = nextQ
        setFmManualText('')
        updateDoc(roomDocRef.current, {
          'payload.fmCurrentQ':   nextQ,
          'payload.fmAnswers1':   next1,
          'payload.fmSubmit':     null,
          'payload.questionText': FAST_MONEY_QUESTIONS[nextQ].question,
        })
      }
    } else if (fmPhaseRef.current === 'p2') {
      const p1Ans = fmAnswers1Ref.current[qIdx]
      const isDup = Boolean(p1Ans) && answersMatch(sub.text, p1Ans)
      if (isDup) {
        setFmDuplicate(true)
        updateDoc(roomDocRef.current, {
          'payload.fmDuplicate': true,
          'payload.fmSubmit':    null,
        })
      } else {
        setFmDuplicate(false)
        const next2 = [...fmAnswers2Ref.current]
        next2[qIdx] = best
        setFmAnswers2(next2)
        fmAnswers2Ref.current = next2
        const nextQ = qIdx + 1
        if (nextQ >= FM_COUNT) {
          setFmPhase('result')
          fmPhaseRef.current = 'result'
          setFmCurrentQ(0)
          fmCurrentQRef.current = 0
          updateDoc(roomDocRef.current, {
            'payload.fmPhase':     'result',
            'payload.fmAnswers2':  next2,
            'payload.fmSubmit':    null,
            'payload.fmCurrentQ':  0,
            'payload.fmDuplicate': false,
          })
        } else {
          setFmCurrentQ(nextQ)
          fmCurrentQRef.current = nextQ
          setFmManualText('')
          updateDoc(roomDocRef.current, {
            'payload.fmCurrentQ':   nextQ,
            'payload.fmAnswers2':   next2,
            'payload.fmSubmit':     null,
            'payload.fmDuplicate':  false,
            'payload.questionText': FAST_MONEY_QUESTIONS[nextQ].question,
          })
        }
      }
    }
  }, [payload.fmSubmit]) // eslint-disable-line

  // ── Fast Money timer ──────────────────────────────────────────
  useEffect(() => {
    if ((fmPhase !== 'p1' && fmPhase !== 'p2') || !fmTimerStart) return
    const limit = fmPhase === 'p1' ? 20000 : 25000
    const id = setInterval(() => {
      const rem = Math.max(0, limit - (Date.now() - fmTimerStart))
      setFmTimeLeft(Math.ceil(rem / 1000))
      if (rem === 0) {
        clearInterval(id)
        if (fmPhaseRef.current === 'p1') {
          const a1 = [...fmAnswers1Ref.current]
          setFmPhase('p1_done')
          fmPhaseRef.current = 'p1_done'
          setFmCurrentQ(0)
          fmCurrentQRef.current = 0
          updateDoc(roomDocRef.current, {
            'payload.fmPhase':    'p1_done',
            'payload.fmAnswers1': a1,
            'payload.fmSubmit':   null,
            'payload.fmCurrentQ': 0,
          })
        } else {
          const a2 = [...fmAnswers2Ref.current]
          setFmPhase('result')
          fmPhaseRef.current = 'result'
          updateDoc(roomDocRef.current, {
            'payload.fmPhase':    'result',
            'payload.fmAnswers2': a2,
            'payload.fmSubmit':   null,
          })
        }
      }
    }, 1000)
    return () => clearInterval(id)
  }, [fmPhase, fmTimerStart]) // eslint-disable-line

  const buzzedBy    = payload.buzzedBy
  const buzzersOpen = payload.buzzersOpen
  const answerResult = payload.answerResult
  const autoMode    = players.length > 0
  const totalRevPts = [...revealed].reduce((sum, i) => sum + survey.answers[i].pts * multiplier, 0)

  const fmManualSubmit = () => {
    const text = fmManualText.trim()
    if (!text) return
    const qIdx = fmCurrentQRef.current
    setFmManualText('')
    updateDoc(roomDocRef.current, {
      'payload.fmSubmit': { playerId: '__manual__', qIdx, text, submittedAt: Date.now() },
    })
  }

  // ── Setup ─────────────────────────────────────────────────────
  if (phase === 'setup') return (
    <GamePanel title="Family Feud" onExit={onExit}>
      <div className="feud-setup-layout">
        <div className="feud-setup-left">
          <p className="feud-setup-sub">Enter family names, then start playing.</p>
          {names.map((name, i) => (
            <div key={i} className="feud-setup-team">
              <span className="feud-setup-num" style={{ background: TEAM_COLORS[i] }}>{i + 1}</span>
              <input
                className="feud-setup-input"
                value={name}
                onChange={e => setNames(n => n.map((v, j) => j === i ? e.target.value : v))}
              />
            </div>
          ))}
          <button
            className="feud-start-btn"
            onClick={() => {
              setScores([0, 0])
              setRoundIdx(0)
              roundIdxRef.current = 0
              const emptyRev = new Set()
              revealedRef.current = emptyRev
              setRevealed(emptyRev)
              strikesRef.current = 0
              setStrikes(0)
              stealingRef.current = false
              setStealing(false)
              showAllRef.current = false
              setShowAll(false)
              startFaceof(0)
            }}
          >
            Start Game →
          </button>
        </div>
        <div className="feud-setup-qr">
          <div className="feud-lobby-label">Buzz in from phone</div>
          <img src={qrUrl} alt="QR" className="feud-lobby-qr" />
          <div className="feud-lobby-code">{roomCode}</div>
          {players.length > 0
            ? <ul className="feud-lobby-players">
                {players.map(p => (
                  <li key={p.id} style={{ color: p.team != null ? TEAM_COLORS[p.team] : undefined }}>
                    ● {p.name}{p.team != null ? ` (${names[p.team]})` : ''}
                  </li>
                ))}
              </ul>
            : <div className="feud-lobby-hint">Waiting for players…</div>
          }
        </div>
      </div>
    </GamePanel>
  )

  // ── Fast Money ────────────────────────────────────────────────
  if (phase === 'fastmoney') {
    const score1     = calcFmScore(fmAnswers1, FAST_MONEY_QUESTIONS)
    const score2     = calcFmScore(fmAnswers2, FAST_MONEY_QUESTIONS)
    const fmTotal    = score1 + score2
    const won        = fmTotal >= 200
    const timerLimit = fmPhase === 'p1' ? 20 : 25
    const timerPct   = Math.max(0, (fmTimeLeft / timerLimit) * 100)
    const timerClr   = fmTimeLeft > 10 ? '#22c55e' : fmTimeLeft > 5 ? '#f59e0b' : '#ef4444'

    return (
      <div className="feud-screen feud-fm-screen">
        <div className="feud-header">
          <div className="feud-team-score feud-team-score--left">
            <span className="feud-team-name">{names[0]}</span>
            <span className="feud-team-pts">{scores[0]}</span>
          </div>
          <div className="feud-fm-banner">⭐ FAST MONEY ⭐</div>
          <div className="feud-team-score feud-team-score--right">
            <span className="feud-team-name">{names[1]}</span>
            <span className="feud-team-pts">{scores[1]}</span>
          </div>
          <button className="feud-exit-btn" onClick={onExit}>✕</button>
        </div>

        {fmPhase === 'intro' && (
          <div className="feud-fm-intro">
            <div className="feud-fm-intro-team" style={{ color: TEAM_COLORS[fmTeam] }}>
              {names[fmTeam]} plays Fast Money!
            </div>
            <div className="feud-fm-intro-sub">
              Two players · 5 questions · 20 s + 25 s · Score 200+ to win the bonus!
            </div>
            <button
              className="feud-ctrl-btn feud-ctrl-btn--next feud-fm-start-btn"
              onClick={() => {
                const ts = Date.now()
                setFmPhase('p1')
                fmPhaseRef.current = 'p1'
                setFmTimerStart(ts)
                setFmTimeLeft(20)
                setFmCurrentQ(0)
                fmCurrentQRef.current = 0
                updateDoc(roomDocRef.current, {
                  'payload.fmPhase':      'p1',
                  'payload.fmCurrentQ':   0,
                  'payload.fmTimerStart': ts,
                  'payload.questionText': FAST_MONEY_QUESTIONS[0].question,
                  'payload.fmDuplicate':  false,
                })
              }}
            >
              Start Player 1 — 20 seconds →
            </button>
          </div>
        )}

        {(fmPhase === 'p1' || fmPhase === 'p2') && (
          <div className="feud-fm-play">
            <div className="feud-fm-timer-bar">
              <div className="feud-fm-timer-fill" style={{ width: `${timerPct}%`, background: timerClr }} />
            </div>
            <div className="feud-fm-timer-num" style={{ color: timerClr }}>
              {fmTimeLeft}s — {fmPhase === 'p1' ? 'Player 1' : 'Player 2'}
            </div>

            {fmDuplicate && (
              <div className="feud-fm-duplicate">⚠ Duplicate answer — try again!</div>
            )}

            <div className="feud-fm-q-num">Q{fmCurrentQ + 1} / {FM_COUNT}</div>
            <div className="feud-fm-q-text">{FAST_MONEY_QUESTIONS[fmCurrentQ].question}</div>

            {!autoMode && (
              <div className="feud-fm-manual">
                <input
                  className="feud-fm-manual-input"
                  placeholder="Host types answer…"
                  value={fmManualText}
                  onChange={e => setFmManualText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fmManualText.trim() && fmManualSubmit()}
                  autoFocus
                  maxLength={80}
                />
                <button
                  className="feud-ctrl-btn feud-ctrl-btn--correct"
                  onClick={fmManualSubmit}
                  disabled={!fmManualText.trim()}
                >
                  Submit
                </button>
              </div>
            )}
            {autoMode && (
              <div className="feud-fm-waiting">
                {fmPhase === 'p1' ? 'Player 1' : 'Player 2'} answering on their phone…
              </div>
            )}

            <div className="feud-fm-prev">
              {(fmPhase === 'p1' ? fmAnswers1 : fmAnswers2).map((ans, i) =>
                i < fmCurrentQ
                  ? <div key={i} className="feud-fm-prev-row">
                      <span className="feud-fm-prev-q">{FAST_MONEY_QUESTIONS[i].question}</span>
                      <span className="feud-fm-prev-a">{ans || '—'}</span>
                    </div>
                  : null
              )}
            </div>
          </div>
        )}

        {fmPhase === 'p1_done' && (
          <div className="feud-fm-p1done">
            <div className="feud-fm-p1done-title">Player 1 done!</div>
            <div className="feud-fm-p1-score">P1 locked in — {score1} pts (hidden from P2)</div>
            <div className="feud-fm-scoreboard">
              {FAST_MONEY_QUESTIONS.map((q, i) => (
                <div key={i} className="feud-fm-row">
                  <span className="feud-fm-row-q">{q.question}</span>
                  <span className="feud-fm-row-a feud-fm-row-a--hidden">●●●●●</span>
                </div>
              ))}
            </div>
            <button
              className="feud-ctrl-btn feud-ctrl-btn--next"
              onClick={() => {
                const ts    = Date.now()
                const empty = Array(FM_COUNT).fill('')
                setFmPhase('p2')
                fmPhaseRef.current = 'p2'
                setFmTimerStart(ts)
                setFmTimeLeft(25)
                setFmCurrentQ(0)
                fmCurrentQRef.current = 0
                setFmManualText('')
                setFmDuplicate(false)
                setFmAnswers2(empty)
                fmAnswers2Ref.current = empty
                updateDoc(roomDocRef.current, {
                  'payload.fmPhase':      'p2',
                  'payload.fmCurrentQ':   0,
                  'payload.fmTimerStart': ts,
                  'payload.fmAnswers2':   empty,
                  'payload.fmDuplicate':  false,
                  'payload.questionText': FAST_MONEY_QUESTIONS[0].question,
                })
              }}
            >
              Start Player 2 — 25 seconds →
            </button>
          </div>
        )}

        {fmPhase === 'result' && (
          <div className="feud-fm-result">
            <div className={`feud-fm-result-verdict ${won ? 'feud-fm-result-verdict--won' : 'feud-fm-result-verdict--lost'}`}>
              {won ? `🎉 ${fmTotal} pts — YOU WIN THE BONUS!` : `${fmTotal} / 200 — So close!`}
            </div>
            <div className="feud-fm-result-grid">
              <div className="feud-fm-result-header">Question</div>
              <div className="feud-fm-result-header">Player 1</div>
              <div className="feud-fm-result-header">Player 2</div>
              <div className="feud-fm-result-header">Pts</div>
              {FAST_MONEY_QUESTIONS.map((q, i) => {
                const a1  = fmAnswers1[i]
                const a2  = fmAnswers2[i]
                const m1  = a1 ? q.answers.find(a => answersMatch(a1, a.text)) : null
                const m2  = a2 ? q.answers.find(a => answersMatch(a2, a.text)) : null
                const pts = (m1?.pts || 0) + (m2?.pts || 0)
                return [
                  <div key={`q${i}`}  className="feud-fm-result-cell">{q.question}</div>,
                  <div key={`a1${i}`} className={`feud-fm-result-cell ${m1 ? 'feud-fm-result-cell--hit' : ''}`}>
                    {a1 || '—'}{m1 ? ` (${m1.pts})` : ''}
                  </div>,
                  <div key={`a2${i}`} className={`feud-fm-result-cell ${m2 ? 'feud-fm-result-cell--hit' : ''}`}>
                    {a2 || '—'}{m2 ? ` (${m2.pts})` : ''}
                  </div>,
                  <div key={`p${i}`}  className="feud-fm-result-cell feud-fm-result-cell--pts">{pts || ''}</div>,
                ]
              })}
            </div>
            <div className="feud-fm-total">Total: {fmTotal} / 200</div>
            <button className="feud-ctrl-btn feud-ctrl-btn--next" onClick={() => setPhase('done')}>
              Final Score →
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Face-off & Board (shared layout) ─────────────────────────
  const isFaceof = phase === 'faceof'

  return (
    <div className="feud-screen">
      <div className="feud-header">
        <div className="feud-team-score feud-team-score--left">
          <span className="feud-team-name" style={{ opacity: isFaceof || active === 0 ? 1 : 0.5 }}>
            {names[0]}
          </span>
          <span className="feud-team-pts">{scores[0]}</span>
          {!isFaceof && active === 0 && <span className="feud-active-badge">● Playing</span>}
        </div>

        <div className="feud-header-center">
          {isFaceof
            ? <div className="feud-faceof-badge">FACE-OFF</div>
            : <>
                <div className="feud-strikes">
                  {Array.from({ length: MAX_STRIKES }).map((_, i) => (
                    <span key={i} className={`feud-x ${i < strikes ? 'feud-x--active' : ''}`}>✕</span>
                  ))}
                </div>
                <div className="feud-round-badge">
                  Rd {roundIdx + 1}
                  {multiplier > 1 && <span className="feud-mult-badge">{multiplier}×</span>}
                </div>
              </>
          }
        </div>

        <div className="feud-team-score feud-team-score--right">
          <span className="feud-team-name" style={{ opacity: isFaceof || active === 1 ? 1 : 0.5 }}>
            {names[1]}
          </span>
          <span className="feud-team-pts">{scores[1]}</span>
          {!isFaceof && active === 1 && <span className="feud-active-badge">● Playing</span>}
        </div>

        <button className="feud-exit-btn" onClick={onExit}>✕</button>
      </div>

      {isFaceof && (
        <div className="feud-faceof-status">
          {faceofState === 'open'
            ? 'Any player — buzz in and name the #1 answer!'
            : `${names[1 - (faceofTeam1 ?? 0)]} — counter chance! Try to beat them.`}
        </div>
      )}

      <div className="feud-question">{survey.question}</div>

      <div className="feud-answers">
        {survey.answers.map((ans, i) => (
          <button
            key={i}
            className={`feud-answer ${!isFaceof && (revealed.has(i) || showAll) ? 'feud-answer--revealed' : ''}`}
            onClick={() => {
              if (!autoMode && !isFaceof && !showAll && !revealed.has(i)) {
                const newRev = new Set([...revealed, i])
                revealedRef.current = newRev
                setRevealed(newRev)
              }
            }}
            disabled={(autoMode || showAll || isFaceof) && !revealed.has(i)}
          >
            <span className="feud-answer-num">{i + 1}</span>
            <span className="feud-answer-text">
              {!isFaceof && (revealed.has(i) || showAll) ? ans.text : '▬▬▬▬▬▬▬▬▬'}
            </span>
            <span className="feud-answer-pts">
              {!isFaceof && (revealed.has(i) || showAll)
                ? (multiplier > 1 ? `${ans.pts * multiplier}` : ans.pts)
                : ''}
            </span>
          </button>
        ))}
      </div>

      {!isFaceof && totalRevPts > 0 && (
        <div className="feud-round-total">
          Pot: {totalRevPts} pts{multiplier > 1 ? ` (${multiplier}× round)` : ''}
        </div>
      )}

      {(buzzersOpen || buzzedBy || answerResult) && (
        <div className="feud-buzzer-bar">
          {isFaceof && !buzzedBy && !answerResult && buzzersOpen && faceofState === 'open' && (
            <span className="feud-buzzer-waiting">Face-off — first to buzz answers!</span>
          )}
          {isFaceof && !buzzedBy && !answerResult && buzzersOpen && faceofState === 'counter' && (
            <span className="feud-steal-label">Counter → {names[1 - (faceofTeam1 ?? 0)]} buzzing!</span>
          )}
          {!isFaceof && stealing && !buzzedBy && !answerResult && (
            <span className="feud-steal-label">⭐ STEAL — {names[payload.stealTeam ?? 0]} buzzing!</span>
          )}
          {!isFaceof && !stealing && !buzzedBy && !answerResult && buzzersOpen && (
            <span className="feud-buzzer-waiting">Buzzers open — waiting…</span>
          )}
          {buzzedBy && !answerResult && (
            <span className="feud-buzzed-name">⚡ {buzzedBy.name} is answering…</span>
          )}
          {answerResult === 'found' && <span className="feud-answer-found">✓ Answer found!</span>}
          {answerResult === 'strike' && (
            <span className="feud-answer-strike">
              ✗ {isFaceof ? 'Not the #1 answer!' : `Strike ${strikes}/${MAX_STRIKES}!`}
            </span>
          )}
          <button className="feud-buzzer-reset" onClick={closeBuzzers}>Reset</button>
        </div>
      )}

      {isFaceof && (
        <div className="feud-controls">
          <span className="feud-faceof-manual-label">Override control:</span>
          {names.map((name, i) => (
            <button key={i} className="feud-ctrl-btn feud-ctrl-btn--pass" onClick={() => moveToBoard(i)}>
              → {name}
            </button>
          ))}
        </div>
      )}

      {!isFaceof && (
        <div className="feud-controls">
          {!showAll && !stealing && (
            <>
              {!autoMode && (
                <>
                  <button className="feud-ctrl-btn feud-ctrl-btn--strike" onClick={() => {
                    const next = strikes + 1
                    strikesRef.current = next
                    setStrikes(next)
                    if (next >= MAX_STRIKES) { stealingRef.current = true; setStealing(true) }
                  }}>✕ Strike</button>
                  <button className="feud-ctrl-btn feud-ctrl-btn--correct" onClick={() => {
                    const pot = [...Array(survey.answers.length).keys()].reduce(
                      (s, i) => revealed.has(i) ? s + survey.answers[i].pts * multiplier : s, 0
                    )
                    if (pot > 0) setScores(sc => sc.map((v, i) => i === active ? v + pot : v))
                    showAllRef.current = true
                    setShowAll(true)
                    closeBuzzers()
                  }}>✓ Award {names[active]}</button>
                </>
              )}
              <button className="feud-ctrl-btn feud-ctrl-btn--pass" onClick={() => {
                const next = 1 - active
                setActive(next)
                activeRef.current = next
                strikesRef.current = 0
                setStrikes(0)
                updateDoc(roomDocRef.current, { 'payload.activeTeam': next, 'payload.strikes': 0 })
              }}>⇄ Pass</button>
              {autoMode && (
                <button className="feud-ctrl-btn feud-ctrl-btn--next" onClick={() => { showAllRef.current = true; setShowAll(true) }}>
                  Reveal All
                </button>
              )}
            </>
          )}

          {stealing && !showAll && (
            <div className="feud-steal">
              <div className="feud-steal-label">
                STEAL! {names[payload.stealTeam ?? 1]} — one answer!
              </div>
              {!autoMode && (
                <div className="feud-steal-btns">
                  {names.map((name, i) => i !== active && (
                    <button key={i} className="feud-ctrl-btn feud-ctrl-btn--steal" onClick={() => {
                      const pot = [...Array(survey.answers.length).keys()].reduce(
                        (s, j) => revealed.has(j) ? s + survey.answers[j].pts * multiplier : s, 0
                      )
                      if (pot > 0) setScores(sc => sc.map((v, j) => j === i ? v + pot : v))
                      showAllRef.current = true
                      setShowAll(true)
                      closeBuzzers()
                    }}>
                      {name} steals!
                    </button>
                  ))}
                  <button className="feud-ctrl-btn feud-ctrl-btn--pass" onClick={() => {
                    const pot = [...Array(survey.answers.length).keys()].reduce(
                      (s, j) => revealed.has(j) ? s + survey.answers[j].pts * multiplier : s, 0
                    )
                    if (pot > 0) setScores(sc => sc.map((v, i) => i === active ? v + pot : v))
                    showAllRef.current = true
                    setShowAll(true)
                    closeBuzzers()
                  }}>No steal — award {names[active]}</button>
                </div>
              )}
              {autoMode && (
                <button className="feud-ctrl-btn feud-ctrl-btn--pass" onClick={() => { showAllRef.current = true; setShowAll(true) }}>
                  Skip steal
                </button>
              )}
            </div>
          )}

          {showAll && (
            <div className="feud-round-end">
              {roundIdx + 1 < MAIN_ROUNDS
                ? <button className="feud-ctrl-btn feud-ctrl-btn--next" onClick={() => goNextRound(roundIdx + 1)}>
                    Round {roundIdx + 2} →
                  </button>
                : <button className="feud-ctrl-btn feud-ctrl-btn--next" onClick={startFastMoney}>
                    ⭐ Fast Money →
                  </button>
              }
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="feud-done-overlay">
          <div className="feud-done-box">
            <div className="feud-done-title">Final Score</div>
            {names.map((name, i) => (
              <div key={i} className="feud-done-row" style={{ color: TEAM_COLORS[i] }}>
                <span>{name}</span><span>{scores[i]}</span>
              </div>
            ))}
            <div className="feud-done-winner">
              {(() => {
                const maxScore = Math.max(...scores)
                const winners = names.filter((_, i) => scores[i] === maxScore)
                const winnerText = winners.length > 1 ? "It's a tie!" : `${winners[0]} wins!`
                return winnerText
              })()}
            </div>
            <button className="feud-start-btn" onClick={() => {
              setScores([0, 0])
              setRoundIdx(0)
              roundIdxRef.current = 0
              const emptyRev = new Set()
              revealedRef.current = emptyRev
              setRevealed(emptyRev)
              strikesRef.current = 0
              setStrikes(0)
              stealingRef.current = false
              setStealing(false)
              showAllRef.current = false
              setShowAll(false)
              startFaceof(0)
            }}>
              Play Again
            </button>
            <button className="feud-ctrl-btn feud-ctrl-btn--pass" onClick={onExit}>
              Exit to Games
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
