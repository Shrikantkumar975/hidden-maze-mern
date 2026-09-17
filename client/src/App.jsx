import { useCallback, useEffect, useRef, useState } from 'react';
import { createLevel, DIRS, edgeKey, keyFor, LEVELS } from './game';
import { loadProgress, resetProgress, saveCompletion } from './api';
import './styles.css';

const playerId = (() => {
  const saved = localStorage.getItem('hiddenMazePlayerId');
  if (saved) return saved;
  const id = `player-${crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  localStorage.setItem('hiddenMazePlayerId', id);
  return id;
})();

const BUBBLE_ROUND_SECONDS = 15;
const BUBBLE_SESSION_SECONDS = 7 * 60;

function formatNumber(value) {
  return Number(value.toFixed(1)).toString();
}

function randomDecimalOperand() {
  return Number((Math.random() * 20 + 1).toFixed(1));
}

function randomIntegerOperand() {
  return Math.floor(Math.random() * 12) + 1;
}

function createArithmeticBubble(roundNumber, index) {
  const operator = ['+', '-', '*', '/'][Math.floor(Math.random() * 4)];

  let operandA;
  let operandB;
  let value;
  let label;

  if (operator === '+') {
    operandA = randomDecimalOperand();
    operandB = randomDecimalOperand();
    value = operandA + operandB;
    label = `${formatNumber(operandA)} + ${formatNumber(operandB)}`;
  } else if (operator === '-') {
    operandA = randomDecimalOperand();
    operandB = randomDecimalOperand();
    const bigger = Math.max(operandA, operandB);
    const smaller = Math.min(operandA, operandB);
    value = bigger - smaller;
    label = `${formatNumber(bigger)} - ${formatNumber(smaller)}`;
  } else if (operator === '*') {
    operandA = randomIntegerOperand();
    operandB = randomIntegerOperand();
    value = operandA * operandB;
    label = `${operandA} × ${operandB}`;
  } else {
    const divisor = randomIntegerOperand();
    const quotient = randomIntegerOperand();
    operandA = quotient * divisor;
    operandB = divisor;
    value = operandA / operandB;
    label = `${operandA} ÷ ${operandB}`;
  }

  return {
    id: `${roundNumber}-${index}-${label}-${Math.random().toString(36).slice(2)}`,
    value: Number(value.toFixed(2)),
    label,
    tone: ['cyan', 'yellow', 'green'][index]
  };
}

function bubbleSortAscending(values) {
  const sorted = [...values];
  for (let i = 0; i < sorted.length; i += 1) {
    let swapped = false;
    for (let j = 0; j < sorted.length - i - 1; j += 1) {
      if (sorted[j] > sorted[j + 1]) {
        [sorted[j], sorted[j + 1]] = [sorted[j + 1], sorted[j]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return sorted;
}

function createBubbleRound(roundNumber) {
  const used = new Set();
  const values = [];

  while (values.length < 3) {
    const bubble = createArithmeticBubble(roundNumber, values.length);
    if (!used.has(bubble.value)) {
      used.add(bubble.value);
      values.push(bubble);
    }
  }

  return values;
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function App() {
  const [screen, setScreen] = useState('home');
  const [levelIndex, setLevelIndex] = useState(0);
  const [game, setGame] = useState(() => createLevel(0));
  const [completed, setCompleted] = useState(() => JSON.parse(localStorage.getItem('hiddenMazeCompleted') || '[]'));
  const [message, setMessage] = useState('Move one tile at a time.');
  const [messageType, setMessageType] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const timerRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 1500);
  }, []);

  useEffect(() => {
    loadProgress(playerId).then((data) => {
      setCompleted(data.completedLevels || []);
      localStorage.setItem('hiddenMazeCompleted', JSON.stringify(data.completedLevels || []));
    }).catch(() => {});
  }, []);

  const startLevel = useCallback((index) => {
    setLevelIndex(index);
    setGame(createLevel(index));
    setMessage('Move one tile at a time.');
    setMessageType('');
    setModal(null);
    setScreen('maze-game');
  }, []);

  const resetLevel = useCallback(() => {
    startLevel(levelIndex);
  }, [levelIndex, startLevel]);

  const finishLevel = useCallback(async (nextGame) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setMessage('Door reached. Level cleared.');
    setMessageType('good');
    setGame(nextGame);
    setCompleted((old) => {
      const next = [...new Set([...old, levelIndex])].sort((a,b)=>a-b);
      localStorage.setItem('hiddenMazeCompleted', JSON.stringify(next));
      saveCompletion(playerId, levelIndex, nextGame.moves, nextGame.remaining)
        .then((data) => {
          if (data?.completedLevels) {
            setCompleted(data.completedLevels);
            localStorage.setItem('hiddenMazeCompleted', JSON.stringify(data.completedLevels));
          }
        }).catch(() => {});
      return next;
    });
    const final = levelIndex === LEVELS.length - 1;
    setModal({
      icon: final ? '🏁' : '🚪',
      title: final ? 'You cleared all 20' : 'Level complete',
      text: final ? 'Twenty hidden-wall mazes. The final door is open, and the whole challenge is complete.' : `You reached the door with ${nextGame.remaining.toFixed(1)} seconds left.`,
      primary: final ? 'Replay final' : 'Next level',
      secondary: 'Level map',
      action: final ? 'replay' : 'next'
    });
  }, [levelIndex]);

  const attemptMove = useCallback((name) => {
    setGame((current) => {
      if (modal || !current) return current;
      const { dr, dc } = DIRS[name];
      const { r, c } = current.player;
      const nr = r + dr, nc = c + dc, size = current.spec.size;

      if (nr < 0 || nr >= size || nc < 0 || nc >= size || current.walls.has(edgeKey(r,c,nr,nc))) {
        document.querySelector('.maze-shell')?.classList.remove('wall-hit');
        requestAnimationFrame(() => document.querySelector('.maze-shell')?.classList.add('wall-hit'));
        setTimeout(() => document.querySelector('.maze-shell')?.classList.remove('wall-hit'), 440);
        showToast('Hidden wall. Back to start.');
        return { ...current, player: { ...current.start }, visited: new Set([keyFor(current.start.r,current.start.c)]) };
      }

      const collected = new Set(current.collected);
      const found = current.keys.find(k => k.r === nr && k.c === nc && !collected.has(k.id));
      if (found) {
        collected.add(found.id);
        showToast(collected.size === current.keys.length ? 'Every key found. Door unlocked.' : 'Key collected.');
      }

      const next = {
        ...current,
        player: { r: nr, c: nc },
        visited: new Set([...current.visited, keyFor(nr,nc)]),
        collected,
        moves: current.moves + 1
      };

      if (nr === current.exit.r && nc === current.exit.c) {
        if (collected.size === current.keys.length) {
          setTimeout(() => finishLevel(next), 0);
        } else {
          setTimeout(() => { setMessage('The door is locked.'); setMessageType('bad'); showToast('The door needs every key.'); }, 0);
        }
      }
      return next;
    });
  }, [finishLevel, modal, showToast]);

  useEffect(() => {
    if (screen !== 'maze-game' || modal) return;
    timerRef.current = setInterval(() => {
      setGame((current) => {
        const remaining = Math.max(0, current.remaining - 0.1);
        if (remaining <= 0) {
          clearInterval(timerRef.current);
          setModal({ icon:'⏳', title:'Time ran out', text:'The clock won this round. Restart and use your darker trail to remember the route.', primary:'Try again', secondary:'Level map', action:'retry' });
          return { ...current, remaining: 0 };
        }
        return { ...current, remaining };
      });
    }, 100);
    return () => clearInterval(timerRef.current);
  }, [screen, modal, levelIndex]);

  useEffect(() => {
    const map = { ArrowUp:'up',w:'up',W:'up', ArrowDown:'down',s:'down',S:'down', ArrowLeft:'left',a:'left',A:'left', ArrowRight:'right',d:'right',D:'right' };
    const onKey = (event) => {
      if (screen !== 'maze-game') return;
      if (!map[event.key]) return;
      event.preventDefault();
      attemptMove(map[event.key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attemptMove, screen]);

  const unlocked = game.collected.size === game.keys.length;
  const progressCount = completed.length;
  const highest = completed.length ? Math.max(...completed) + 1 : 0;

  const openHome = () => { clearInterval(timerRef.current); setModal(null); setScreen('home'); };
  const openMenu = () => { clearInterval(timerRef.current); setModal(null); setScreen('maze-menu'); };
  const nextLevel = () => startLevel(Math.min(LEVELS.length - 1, levelIndex + 1));
  const isMazeScreen = screen === 'maze-menu' || screen === 'maze-game';
  const brandCopy = screen === 'bubble'
    ? { title: 'Bubble Sort Practice', text: 'Order fast. Stay accurate.' }
    : isMazeScreen
      ? { title: 'Hidden Maze Challenge', text: 'Remember the path. Trust nothing.' }
      : { title: 'Practice Arcade', text: 'Choose a challenge and sharpen up.' };

  return <div className="app">
    <div className="shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">⌁</div><div><strong>{brandCopy.title}</strong><span>{brandCopy.text}</span></div></div>
        <div className="top-actions">
          {screen === 'maze-game' && <button className="btn ghost" onClick={openMenu}>Levels</button>}
          {screen !== 'home' && <button className="btn ghost" onClick={openHome}>Games</button>}
        </div>
      </header>

      {screen === 'home' ? <HomeScreen onMaze={() => setScreen('maze-menu')} onBubble={() => setScreen('bubble')} progressCount={progressCount} /> :
      screen === 'maze-menu' ? <MenuScreen completed={completed} onStart={startLevel} progressCount={progressCount} continueIndex={Math.min(19, highest)} onReset={() => {
        setCompleted([]);
        localStorage.removeItem('hiddenMazeCompleted');
        resetProgress(playerId).then(() => showToast('Progress reset.')).catch(() => showToast('Local progress reset.'));
      }} /> :
      screen === 'bubble' ? <BubbleSortPractice onExit={openHome} /> :
      <GameScreen game={game} levelIndex={levelIndex} unlocked={unlocked} message={message} messageType={messageType} onMove={attemptMove} onRestart={resetLevel} onMenu={openMenu} />}
    </div>

    {modal && <div className="modal show">
      <div className="modal-card">
        <div className="modal-icon">{modal.icon}</div><h2>{modal.title}</h2><p>{modal.text}</p>
        <div className="modal-actions">
          <button className="btn" onClick={openMenu}>{modal.secondary}</button>
          <button className="btn primary" onClick={() => modal.action === 'retry' ? resetLevel() : modal.action === 'replay' ? startLevel(19) : nextLevel()}>{modal.primary}</button>
        </div>
      </div>
    </div>}
    <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
  </div>;
}

function HomeScreen({ onMaze, onBubble, progressCount }) {
  return <section className="screen active">
    <div className="hub">
      <div className="hub-copy">
        <div className="eyebrow">Two quick challenges</div>
        <h1>Pick your practice.</h1>
        <p>Train memory with hidden paths or train ordering speed with timed bubble rounds.</p>
      </div>
      <div className="game-cards">
        <button className="game-card maze-card" onClick={onMaze}>
          <span className="game-card-label">Memory maze</span>
          <strong>Hidden Maze Challenge</strong>
          <small>{progressCount} / 20 levels cleared</small>
          <div className="game-card-art maze-art" aria-hidden="true">{Array.from({ length: 16 }).map((_, i) => <i key={i} className={[1, 5, 6, 10].includes(i) ? 'on' : ''}></i>)}</div>
        </button>
        <button className="game-card bubble-card" onClick={onBubble}>
          <span className="game-card-label">Ordering sprint</span>
          <strong>Bubble Sort Practice</strong>
          <small>3 bubbles · 15 second rounds · 7 minute session</small>
          <div className="game-card-art bubble-art" aria-hidden="true"><i>18</i><i>42</i><i>77</i></div>
        </button>
      </div>
    </div>
  </section>;
}

function MenuScreen({ completed, onStart, progressCount, continueIndex, onReset }) {
  return <section className="screen active"><div className="hero">
    <div className="hero-copy"><div><div className="eyebrow">A memory-first maze</div><h1>Find the route you can't see.</h1><p>The walls are hidden. Your footsteps are not. Reach every key, unlock the door, and build a map in your head before the clock runs dry.</p>
      <div className="cta-row"><button className="btn primary" onClick={() => onStart(continueIndex)}>{completed.length === 20 ? 'Replay final level' : `Continue · Level ${continueIndex + 1}`}</button><button className="btn" onClick={onReset}>Reset progress</button></div>
      <div className="mini-preview" aria-hidden="true">{Array.from({length:24}).map((_,i)=><i key={i} className={i===9?'player':[1,2,7,8,14,15].includes(i)?'trail':i===3?'key':i===17?'door':''}></i>)}</div>
    </div><div className="hero-foot">Keyboard: arrows / WASD · Mouse: click an adjacent tile · Mobile: D-pad</div></div>
    <div className="progress-panel"><div className="panel-head"><div><h2>Challenge map</h2><p>Choose any unlocked level.</p></div><div className="progress-count">{progressCount} / 20 cleared</div></div>
      <div className="levels">{LEVELS.map((level,i) => {const open=i===0 || completed.includes(i-1) || completed.includes(i); const done=completed.includes(i); return <button key={i} disabled={!open} className={`level-btn ${i===continueIndex?'current ':''}${done?'done ':''}${open?'':'locked'}`} onClick={()=>onStart(i)}><div className="num">{String(i+1).padStart(2,'0')}</div><small>{level.size}×{level.size} · {level.keys} key{level.keys>1?'s':''}</small></button>})}</div>
      <div className="tips"><Tip icon="↯" title="Hit a hidden wall?" text="The maze flashes red and you return to the start."/><Tip icon="●" title="Leave yourself clues." text="Visited cells stay darker so your memory has an anchor."/><Tip icon="⌁" title="Keys first." text="The exit opens only after every key on the level is collected."/></div>
    </div>
  </div></section>;
}

function Tip({icon,title,text}) { return <div className="tip"><div className="tip-icon">{icon}</div><div><strong>{title}</strong><span>{text}</span></div></div>; }

function GameScreen({game,levelIndex,unlocked,message,messageType,onMove,onRestart,onMenu}) {
  const {spec}=game;
  return <section className="screen active"><div className="game-layout">
    <aside className="side-card"><div className="level-kicker">LEVEL {String(levelIndex+1).padStart(2,'0')}</div><h2 className="level-title">{spec.name}</h2>
      <Stat label="Grid" value={`${spec.size} × ${spec.size}`}/><Stat label="Moves" value={game.moves}/><Stat label="Keys" value={`${game.collected.size} / ${game.keys.length}`}/>
      <div className="timer-wrap"><div className="timer-row"><span>Time</span><strong className={`timer ${game.remaining/spec.time<.25?'warn':''}`}>{game.remaining.toFixed(1)}</strong></div><div className="timer-bar"><div className={`timer-fill ${game.remaining/spec.time<.25?'warn':''}`} style={{width:`${Math.max(0,game.remaining/spec.time)*100}%`}}/></div></div>
      <div className="key-section"><div className="side-label">Keys to collect</div><div className="keys-list">{game.keys.map(k=><div key={k.id} className={`key-dot ${game.collected.has(k.id)?'collected':''}`}>{game.collected.has(k.id)?'✓':'🔑'}</div>)}</div></div>
      <div className="side-actions"><button className="btn" onClick={onRestart}>Restart</button><button className="btn" onClick={onMenu}>Level map</button></div>
    </aside>
    <main className="game-board-card"><div className="board-top"><div className={`board-message ${messageType}`}>{unlocked?'All keys found. Find the door.':message}</div><div className="board-meta">{unlocked?'Door unlocked':`${game.keys.length-game.collected.size} key${game.keys.length-game.collected.size===1?'':'s'} remain`}</div></div>
      <div className="maze-shell"><div className="maze" style={{gridTemplateColumns:`repeat(${spec.size},1fr)`,gridTemplateRows:`repeat(${spec.size},1fr)`}}>
        {Array.from({length:spec.size*spec.size}).map((_,i)=>{const r=Math.floor(i/spec.size),c=i%spec.size,k=keyFor(r,c);const key=game.keys.find(x=>x.r===r&&x.c===c&&!game.collected.has(x.id));const isPlayer=r===game.player.r&&c===game.player.c;const isExit=r===game.exit.r&&c===game.exit.c;let cls=`cell ${game.visited.has(k)?'trail ':''}${isPlayer?'player ':''}${key?'key ':''}${isExit?'exit ':''}`;return <button key={k} className={cls} onClick={()=>{const dr=r-game.player.r,dc=c-game.player.c;if(Math.abs(dr)+Math.abs(dc)!==1)return;if(dr<0)onMove('up');else if(dr>0)onMove('down');else if(dc<0)onMove('left');else onMove('right')}} aria-label={`Cell ${r+1}, ${c+1}`}>{isPlayer?<span className="player-dot"/>:key?<span className="glyph">🔑</span>:isExit?<span className={`glyph ${unlocked?'':'locked-glyph'}`}>{unlocked?'🚪':'🔒'}</span>:null}</button>})}
      </div></div>
      <div className="dpad"><button onPointerDown={(e)=>{e.preventDefault();onMove('up')}}>↑</button><button onPointerDown={(e)=>{e.preventDefault();onMove('left')}}>←</button><button onPointerDown={(e)=>{e.preventDefault();onMove('down')}}>↓</button><button onPointerDown={(e)=>{e.preventDefault();onMove('right')}}>→</button></div>
      <div className="controls-note">Click an adjacent tile, use WASD / arrows, or use the D-pad.</div>
    </main>
  </div></section>;
}
function Stat({label,value}){return <div className="stat"><span>{label}</span><strong>{value}</strong></div>}

function BubbleSortPractice({ onExit }) {
  const [mode, setMode] = useState('intro');
  const [roundNumber, setRoundNumber] = useState(1);
  const [round, setRound] = useState(() => createBubbleRound(1));
  const [selected, setSelected] = useState([]);
  const [roundTime, setRoundTime] = useState(BUBBLE_ROUND_SECONDS);
  const [sessionTime, setSessionTime] = useState(BUBBLE_SESSION_SECONDS);
  const [stats, setStats] = useState({ played: 0, correct: 0, wrong: 0 });
  const [feedback, setFeedback] = useState('Select bubbles from lowest to highest.');
  const [isAdvancing, setIsAdvancing] = useState(false);
  const selectedRef = useRef(selected);
  const roundRef = useRef(round);
  const advancingRef = useRef(isAdvancing);
  const sessionTimeRef = useRef(sessionTime);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { roundRef.current = round; }, [round]);
  useEffect(() => { advancingRef.current = isAdvancing; }, [isAdvancing]);
  useEffect(() => { sessionTimeRef.current = sessionTime; }, [sessionTime]);

  const startSession = useCallback(() => {
    const firstRound = createBubbleRound(1);
    setMode('practice');
    setRoundNumber(1);
    setRound(firstRound);
    setSelected([]);
    setRoundTime(BUBBLE_ROUND_SECONDS);
    setSessionTime(BUBBLE_SESSION_SECONDS);
    setStats({ played: 0, correct: 0, wrong: 0 });
    setFeedback('Select bubbles from lowest to highest.');
    setIsAdvancing(false);
  }, []);

  const completeRound = useCallback((choice, timedOut = false) => {
    if (advancingRef.current) return;
    const orderedValues = bubbleSortAscending(roundRef.current.map((bubble) => bubble.value));
    const ordered = orderedValues.map((value) => {
      const bubble = roundRef.current.find((item) => item.value === value);
      return bubble ? bubble.id : null;
    }).filter(Boolean);
    const correct = choice.length === 3 && choice.every((id, index) => id === ordered[index]);

    setIsAdvancing(true);
    setStats((current) => ({
      played: current.played + 1,
      correct: current.correct + (correct ? 1 : 0),
      wrong: current.wrong + (correct ? 0 : 1)
    }));
    setFeedback(correct ? 'Correct. Next round.' : timedOut ? 'Time up. Next round.' : 'Wrong order. Next round.');

    setTimeout(() => {
      if (sessionTimeRef.current <= 0) return;
      setRoundNumber((current) => {
        const nextNumber = current + 1;
        setRound(createBubbleRound(nextNumber));
        return nextNumber;
      });
      setSelected([]);
      setRoundTime(BUBBLE_ROUND_SECONDS);
      setFeedback('Select bubbles from lowest to highest.');
      setIsAdvancing(false);
    }, 650);
  }, []);

  useEffect(() => {
    if (mode !== 'practice') return;
    const interval = setInterval(() => {
      setSessionTime((current) => {
        if (current <= 1) {
          setMode('summary');
          return 0;
        }
        return current - 1;
      });
      setRoundTime((current) => {
        if (current <= 1) {
          completeRound(selectedRef.current, true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [completeRound, mode]);

  const toggleBubble = (bubbleId) => {
    if (mode !== 'practice' || isAdvancing) return;
    setSelected((current) => {
      if (current.includes(bubbleId)) {
        return current.filter((id) => id !== bubbleId);
      }
      if (current.length >= 3) return current;
      const next = [...current, bubbleId];
      if (next.length === 3) {
        setTimeout(() => completeRound(next), 260);
      }
      return next;
    });
  };

  const stopSession = () => {
    setMode('summary');
    setIsAdvancing(false);
  };

  const accuracy = stats.played ? Math.round((stats.correct / stats.played) * 100) : 0;

  if (mode === 'intro') {
    return <section className="screen active">
      <div className="bubble-intro">
        <div className="bubble-rules">
          <div className="eyebrow">Timed ordering drill</div>
          <h1>Bubble Sort Practice</h1>
          <h2>How to Play</h2>
          <ul>
            <li>Select bubbles from <strong>LOWEST → HIGHEST</strong>.</li>
            <li>You can <strong>unselect</strong> any bubble by tapping it again.</li>
            <li>Each round has <strong>15 seconds</strong>.</li>
            <li>Entire session lasts <strong>7 minutes</strong>.</li>
            <li>After selecting 3 bubbles the round automatically advances.</li>
            <li>Press <strong>Stop / Submit</strong> to view the session summary.</li>
          </ul>
          <button className="btn primary wide" onClick={startSession}>Let's Practice</button>
        </div>
        <div className="bubble-demo" aria-hidden="true">
          <div className="demo-bubble small">12</div>
          <div className="demo-bubble medium">45</div>
          <div className="demo-bubble large">83</div>
        </div>
      </div>
    </section>;
  }

  if (mode === 'summary') {
    return <section className="screen active">
      <div className="bubble-summary">
        <div className="modal-icon">✓</div>
        <h1>Session Summary</h1>
        <div className="summary-grid">
          <Stat label="Rounds Played" value={stats.played} />
          <Stat label="Correct" value={stats.correct} />
          <Stat label="Wrong" value={stats.wrong} />
          <Stat label="Accuracy" value={`${accuracy}%`} />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onExit}>Games</button>
          <button className="btn primary" onClick={startSession}>Practice Again</button>
        </div>
      </div>
    </section>;
  }

  return <section className="screen active">
    <div className="bubble-layout">
      <aside className="side-card">
        <div className="level-kicker">BUBBLE SESSION</div>
        <h2 className="level-title">Round {roundNumber}</h2>
        <Stat label="Session" value={formatClock(sessionTime)} />
        <Stat label="Round" value={`${roundTime}s`} />
        <Stat label="Correct" value={stats.correct} />
        <Stat label="Wrong" value={stats.wrong} />
        <div className="timer-wrap">
          <div className="timer-row"><span>Round Time</span><strong className={`timer ${roundTime <= 4 ? 'warn' : ''}`}>{roundTime}</strong></div>
          <div className="timer-bar"><div className={`timer-fill ${roundTime <= 4 ? 'warn' : ''}`} style={{ width: `${(roundTime / BUBBLE_ROUND_SECONDS) * 100}%` }} /></div>
        </div>
        <div className="side-actions single">
          <button className="btn primary" onClick={stopSession}>Stop / Submit</button>
        </div>
      </aside>
      <main className="game-board-card bubble-board-card">
        <div className="board-top">
          <div className={`board-message ${feedback.startsWith('Correct') ? 'good' : feedback.startsWith('Wrong') || feedback.startsWith('Time') ? 'bad' : ''}`}>{feedback}</div>
          <div className="board-meta">{selected.length} / 3 selected</div>
        </div>
        <div className="bubble-stage">
          {round.map((bubble) => {
            const selectedIndex = selected.indexOf(bubble.id);
            return <button key={bubble.id} className={`bubble-choice ${bubble.tone} ${selectedIndex >= 0 ? 'selected' : ''}`} onClick={() => toggleBubble(bubble.id)} disabled={isAdvancing}>
              <span className="selection-badge">{selectedIndex >= 0 ? selectedIndex + 1 : ''}</span>
              <strong>{bubble.label}</strong>
            </button>;
          })}
        </div>
        <div className="selection-tray">
          {Array.from({ length: 3 }).map((_, index) => {
            const bubble = round.find((item) => item.id === selected[index]);
            return <div key={index} className="selection-slot"><span>{index + 1}</span><strong>{bubble ? bubble.label : '-'}</strong></div>;
          })}
        </div>
      </main>
    </div>
  </section>;
}

export default App;
