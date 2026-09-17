import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createLevel, DIRS, edgeKey, keyFor, LEVELS } from './game';
import { loadProgress, saveCompletion } from './api';
import './styles.css';

const playerId = (() => {
  const saved = localStorage.getItem('hiddenMazePlayerId');
  if (saved) return saved;
  const id = `player-${crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  localStorage.setItem('hiddenMazePlayerId', id);
  return id;
})();

function App() {
  const [screen, setScreen] = useState('menu');
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
    setScreen('game');
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

  const restartAfterWall = useCallback((current) => {
    const next = {
      ...current,
      player: { ...current.start },
      visited: new Set([keyFor(current.start.r, current.start.c)])
    };
    setGame(next);
  }, []);

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
    if (screen !== 'game' || modal) return;
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
      if (!map[event.key]) return;
      event.preventDefault();
      attemptMove(map[event.key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attemptMove]);

  const unlocked = game.collected.size === game.keys.length;
  const progressCount = completed.length;
  const highest = completed.length ? Math.max(...completed) + 1 : 0;

  const openMenu = () => { clearInterval(timerRef.current); setModal(null); setScreen('menu'); };
  const nextLevel = () => startLevel(Math.min(LEVELS.length - 1, levelIndex + 1));

  return <div className="app">
    <div className="shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">⌁</div><div><strong>Hidden Maze Challenge</strong><span>Remember the path. Trust nothing.</span></div></div>
        <button className="btn ghost" onClick={openMenu}>Levels</button>
      </header>

      {screen === 'menu' ? <MenuScreen completed={completed} onStart={startLevel} progressCount={progressCount} continueIndex={Math.min(19, highest)} onReset={() => { setCompleted([]); localStorage.removeItem('hiddenMazeCompleted'); showToast('Progress reset.'); }} /> :
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

function MenuScreen({ completed, onStart, progressCount, continueIndex, onReset }) {
  return <section className="screen active"><div className="hero">
    <div className="hero-copy"><div><div className="eyebrow">A memory-first maze</div><h1>Find the route you can't see.</h1><p>The walls are hidden. Your footsteps are not. Reach every key, unlock the door, and build a map in your head before the clock runs dry.</p>
      <div className="cta-row"><button className="btn primary" onClick={() => onStart(continueIndex)}>{completed.length === 20 ? 'Replay final level' : `Continue · Level ${continueIndex + 1}`}</button><button className="btn" onClick={onReset}>Reset progress</button></div>
      <div className="mini-preview" aria-hidden="true">{Array.from({length:24}).map((_,i)=><i key={i} className={[1,2,7,8,9,14,15].includes(i)?'trail':i===9?'player':i===3?'key':i===17?'door':''}></i>)}</div>
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

export default App;
