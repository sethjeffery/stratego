import { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, PieceDefinition, PiecesConfig, Position, RulesConfig } from './shared/schema';

type ConfigPayload = {
  piecesConfig: PiecesConfig;
  rulesConfig: RulesConfig;
};

type Particle = { id: number; left: number; top: number; size: number; hue: number };

const socket: Socket = io('/', { autoConnect: false });

const colorForOwner = (ownerId: string, myId: string | null) => (ownerId === myId ? 'ally' : 'enemy');

export function App() {
  const [playerName, setPlayerName] = useState('Commander Nova');
  const [roomCode, setRoomCode] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [pieces, setPieces] = useState<PieceDefinition[]>([]);
  const [rules, setRules] = useState<RulesConfig | null>(null);
  const [selected, setSelected] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((config: ConfigPayload) => {
        setPieces(config.piecesConfig.pieces);
        setRules(config.rulesConfig);
      });

    socket.connect();
    socket.on('room:joined', ({ playerId, state: nextState }) => {
      setMyId(playerId);
      setState(nextState);
      setRoomCode(nextState.roomCode);
      setError(null);
    });
    socket.on('game:state', (nextState) => {
      setState(nextState);
      if (nextState.lastBattle) {
        const burst = Array.from({ length: 16 }, (_, idx) => ({
          id: Date.now() + idx,
          left: Math.random() * 100,
          top: Math.random() * 100,
          size: 4 + Math.random() * 12,
          hue: 5 + Math.random() * 55,
        }));
        setParticles(burst);
        setTimeout(() => setParticles([]), 650);
      }
    });
    socket.on('game:error', (payload) => setError(payload.message));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  const pieceById = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces]);

  const onCellClick = (target: Position) => {
    if (!state || !myId) return;

    if (!selected) {
      const mine = state.units.find((unit) => unit.x === target.x && unit.y === target.y && unit.ownerId === myId);
      if (mine) setSelected(target);
      return;
    }

    socket.emit('game:move', {
      roomCode: state.roomCode,
      from: selected,
      to: target,
    });
    setSelected(null);
  };

  const battleText = state?.lastBattle
    ? `${pieceById.get(state.lastBattle.attackerPieceId)?.label ?? 'Attacker'} vs ${pieceById.get(state.lastBattle.defenderPieceId)?.label ?? 'Defender'} • ${state.lastBattle.winner.toUpperCase()}!`
    : 'Awaiting clash...';

  return (
    <div className="app-shell">
      <div className="aurora" />
      {particles.map((p) => (
        <span
          key={p.id}
          className="particle"
          style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, background: `hsl(${p.hue},100%,60%)` }}
        />
      ))}

      <header>
        <h1>Stratego Pulse Arena</h1>
        <p>Host on one device. Join from another. Real-time tactical chaos.</p>
      </header>

      {!state && (
        <section className="lobby card">
          <label>
            Callsign
            <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
          </label>
          <div className="lobby-actions">
            <button onClick={() => socket.emit('room:create', { playerName })}>Host Battle</button>
            <input
              placeholder="ROOM"
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            />
            <button onClick={() => socket.emit('room:join', { roomCode, playerName })}>Join Battle</button>
          </div>
          {rules && <small>Config-loaded ruleset: {rules.gameName} ({rules.board.width}x{rules.board.height})</small>}
        </section>
      )}

      {state && rules && (
        <main className="arena-layout">
          <aside className="hud card">
            <h2>Room {state.roomCode}</h2>
            <p>Turn: <strong>{state.players.find((p) => p.id === state.turnPlayerId)?.name ?? 'Complete'}</strong></p>
            <p>{battleText}</p>
            {state.winnerId && <p className="winner">🏆 {state.players.find((p) => p.id === state.winnerId)?.name} wins!</p>}
            <ul>
              {state.players.map((player) => (
                <li key={player.id}>{player.name} {player.connected ? '🟢' : '🔴'}</li>
              ))}
            </ul>
          </aside>

          <section
            className={`board card ${state.lastBattle ? 'shake' : ''}`}
            style={{ gridTemplateColumns: `repeat(${rules.board.width}, minmax(34px, 1fr))` }}
          >
            {Array.from({ length: rules.board.height }, (_, y) =>
              Array.from({ length: rules.board.width }, (_, x) => {
                const key = `${x}-${y}`;
                const unit = state.units.find((u) => u.x === x && u.y === y);
                const blocked = rules.board.blockedCells.some((c) => c.x === x && c.y === y);
                const isSelected = selected?.x === x && selected?.y === y;
                const visible = unit && (unit.ownerId === myId || unit.revealedTo.includes(myId || ''));

                return (
                  <button
                    key={key}
                    className={`cell ${blocked ? 'lake' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => !blocked && onCellClick({ x, y })}
                    disabled={blocked}
                  >
                    {unit && (
                      <span className={`piece ${colorForOwner(unit.ownerId, myId)} ${state.lastBattle?.at.x === x && state.lastBattle?.at.y === y ? 'impact' : ''}`}>
                        {visible ? pieceById.get(unit.pieceId)?.label.slice(0, 2) : '??'}
                      </span>
                    )}
                  </button>
                );
              }),
            )}
          </section>
        </main>
      )}

      {error && <div className="error card">{error}</div>}
    </div>
  );
}
