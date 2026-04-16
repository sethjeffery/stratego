import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { applyMove, createRoom, getRoom, getRuleset, joinRoom } from './gameEngine.js';

const app = express();
const httpServer = createServer(app);
const clientOrigin = process.env.CLIENT_ORIGIN ?? '*';

const io = new Server(httpServer, {
  cors: { origin: clientOrigin },
});

app.get('/api/config', (_req, res) => {
  res.json(getRuleset());
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  socket.on('room:create', ({ playerName }) => {
    const player = {
      id: socket.id,
      name: playerName || 'Commander',
      connected: true,
    };

    const room = createRoom(player);
    socket.join(room.roomCode);
    socket.emit('room:joined', { playerId: socket.id, state: room });
  });

  socket.on('room:join', ({ roomCode, playerName }) => {
    const result = joinRoom(roomCode?.toUpperCase(), {
      id: socket.id,
      name: playerName || 'Challenger',
      connected: true,
    });

    if ('error' in result) {
      socket.emit('game:error', { message: result.error });
      return;
    }

    socket.join(roomCode.toUpperCase());
    io.to(roomCode.toUpperCase()).emit('game:state', result.room);
    socket.emit('room:joined', { playerId: socket.id, state: result.room });
  });

  socket.on('game:move', ({ roomCode, from, to }) => {
    const result = applyMove(roomCode.toUpperCase(), socket.id, from, to);
    if ('error' in result) {
      socket.emit('game:error', { message: result.error });
      return;
    }

    io.to(roomCode.toUpperCase()).emit('game:state', result.room);
  });

  socket.on('disconnect', () => {
    io.emit('game:error', {
      message: 'A player disconnected. Rejoin to continue from this session.',
    });

    io.sockets.sockets.forEach((connectedSocket) => {
      connectedSocket.rooms.forEach((roomCode) => {
        const room = getRoom(roomCode);
        if (!room) return;
        const player = room.players.find((p) => p.id === socket.id);
        if (player) player.connected = false;
      });
    });
  });
});

const port = 3001;
httpServer.listen(port, () => {
  console.log(`Stratego server online at http://localhost:${port} (CORS: ${clientOrigin})`);
});
