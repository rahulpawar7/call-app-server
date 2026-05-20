import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from "cors";

const app = express();
const httpServer = createServer(app);
const io: any = new Server(httpServer, {
  cors: { origin: '*', credentials: true },
});
const PORT = process.env.PORT || 3001;

// socketList: keyed by socket.id, holds userName + media state
let socketList: Record<string, { userName: string; video: boolean; audio: boolean }> = {};
// Track which room each socket is in (for disconnect cleanup)
let socketRooms: Record<string, string> = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({ origin: '*', credentials: true }));
app.use(express.static(path.join(__dirname, 'public')));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('/*', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

app.get('/ping', (_req: any, res: any) => res.status(200).send({ success: true }));

io.on('connection', (socket: any) => {
  console.log(`New User connected: ${socket.id}`);

  /**
   * Unexpected disconnect (browser close / network drop)
   */
  socket.on('disconnect', () => {
    const roomId = socketRooms[socket.id];
    const userInfo = socketList[socket.id];
    if (roomId && userInfo) {
      socket.broadcast.to(roomId).emit('FE-user-leave', {
        userId: socket.id,
        userName: userInfo.userName,
      });
    }
    delete socketList[socket.id];
    delete socketRooms[socket.id];
    console.log(`User disconnected: ${socket.id}`);
  });

  /**
   * Check if username already exists in room
   */
  socket.on('BE-check-user', ({ roomId, userName }: any) => {
    let error = false;
    io.in(roomId).allSockets()
      .then((clients: Set<string>) => {
        clients.forEach((clientId: string) => {
          if (socketList[clientId]?.userName === userName) error = true;
        });
        socket.emit('FE-error-user-exist', { error });
      })
      .catch((err: any) => console.error('BE-check-user error:', err));
  });

  /**
   * Join Room
   */
  socket.on('BE-join-room', ({ roomId, userName, video, audio }: any) => {
    socket.join(roomId);
    socketList[socket.id] = {
      userName,
      video: typeof video === 'boolean' ? video : true,
      audio: typeof audio === 'boolean' ? audio : true,
    };
    socketRooms[socket.id] = roomId;
    console.log(`User "${userName}" joined room: ${roomId}`);

    io.in(roomId).allSockets()
      .then((clients: Set<string>) => {
        try {
          const users: { userId: string; info: any }[] = [];
          clients.forEach((clientId: string) => {
            users.push({ userId: clientId, info: socketList[clientId] });
          });
          socket.broadcast.to(roomId).emit('FE-user-join', users);
        } catch (e) {
          socket.emit('FE-error-user-exist', { err: true });
        }
      })
      .catch((err: any) => console.error('BE-join-room error:', err));
  });

  /**
   * WebRTC: initiator sends offer
   */
  socket.on('BE-call-user', ({ userToCall, from, signal }: any) => {
    io.to(userToCall).emit('FE-receive-call', {
      signal,
      from,
      info: socketList[socket.id],
    });
  });

  /**
   * WebRTC: callee accepts
   */
  socket.on('BE-accept-call', ({ signal, to }: any) => {
    io.to(to).emit('FE-call-accepted', { signal, answerId: socket.id });
  });

  /**
   * Chat message
   */
  socket.on('BE-send-message', ({ roomId, msg, sender }: any) => {
    io.sockets.in(roomId).emit('FE-receive-message', { msg, sender });
  });

  /**
   * Explicit leave
   */
  socket.on('BE-leave-room', ({ roomId }: any) => {
    const userInfo = socketList[socket.id];
    delete socketList[socket.id];
    delete socketRooms[socket.id];
    socket.broadcast.to(roomId).emit('FE-user-leave', {
      userId: socket.id,
      userName: userInfo?.userName ?? 'Unknown',
    });
    socket.leave(roomId);
  });

  /**
   * Toggle camera / audio
   * IMPORTANT: emit the actual resulting boolean values so clients stay in sync
   * and don't need to track state independently.
   */
  socket.on('BE-toggle-camera-audio', ({ roomId, switchTarget }: any) => {
    if (!socketList[socket.id]) return;

    if (switchTarget === 'video') {
      socketList[socket.id].video = !socketList[socket.id].video;
    } else {
      socketList[socket.id].audio = !socketList[socket.id].audio;
    }

    // Send the ACTUAL state values — not just "toggle" — so clients are always authoritative
    socket.broadcast.to(roomId).emit('FE-toggle-camera', {
      userId: socket.id,
      switchTarget,
      video: socketList[socket.id].video,
      audio: socketList[socket.id].audio,
    });
  });
});

httpServer.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
