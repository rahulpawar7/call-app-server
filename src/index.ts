import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from "cors"

const app = express();
const httpServer = createServer(app);
const io: any = new Server(httpServer, {
  cors: {
    origin: '*', // specify your frontend domain
    credentials: true, // Allow cookies or authentication tokens
  },
});
const PORT = process.env.PORT || 3001;

let socketList: Record<string, any> = {};

// Get the current file's directory name (equivalent to __dirname in CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use CORS middleware with default settings (open to all origins)
app.use(cors({
  origin: '*', // specify your frontend domain
  credentials: true,
}));

app.use(express.static(path.join(__dirname, 'public')));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('/*', (req: any, res: { sendFile: (arg0: string) => void; }) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Route
app.get('/ping', (req: any, res: any) => {
  res.status(200).send({ success: true });
});

// // Socket events
// io.on('connection', (socket) => {
//   console.log(`New User connected: ${socket.id}`);

//   socket.on('disconnect', () => {
//     socket.disconnect();
//     console.log('User disconnected!');
//   });

//   socket.on('BE-check-user', async ({ roomId, userName }) => {
//     let error = false;

//     // Get all clients in the room
//     const clients = await io.in(roomId).fetchSockets();

//     clients.forEach((client) => {
//       if (socketList[client.id] === userName) {
//         error = true;
//       }
//     });
//     socket.emit('FE-error-user-exist', { error });
//   });

//   socket.on('BE-join-room', async ({ roomId, userName }) => {
//     // Socket Join RoomName
//     socket.join(roomId);
//     socketList[socket.id] = { userName, video: true, audio: true };

//     // Get all clients in the room
//     const clients = await io.in(roomId).fetchSockets();

//     try {
//       const users = clients.map((client) => ({
//         userId: client.id,
//         info: socketList[client.id],
//       }));
//       socket.broadcast.to(roomId).emit('FE-user-join', users);
//     } catch (e) {
//       socket.emit('FE-error-user-exist', { err: true });
//     }
//   });

//   socket.on('BE-call-user', ({ userToCall, from, signal }) => {
//     io.to(userToCall).emit('FE-receive-call', {
//       signal,
//       from,
//       info: socketList[socket.id],
//     });
//   });

//   socket.on('BE-accept-call', ({ signal, to }) => {
//     io.to(to).emit('FE-call-accepted', {
//       signal,
//       answerId: socket.id,
//     });
//   });

//   socket.on('BE-send-message', ({ roomId, msg, sender }) => {
//     io.sockets.in(roomId).emit('FE-receive-message', { msg, sender });
//   });

//   socket.on('BE-leave-room', ({ roomId }) => {
//     delete socketList[socket.id];
//     socket.broadcast
//       .to(roomId)
//       .emit('FE-user-leave', { userId: socket.id, userName: socketList[socket.id] });
//     socket.leave(roomId);
//   });

//   socket.on('BE-toggle-camera-audio', ({ roomId, switchTarget }) => {
//     const user = socketList[socket.id];
//     if (switchTarget === 'video') {
//       user.video = !user.video;
//     } else {
//       user.audio = !user.audio;
//     }
//     socket.broadcast
//       .to(roomId)
//       .emit('FE-toggle-camera', { userId: socket.id, switchTarget });
//   });
// });

// Socket
io.on('connection', (socket: any) => {
  console.log(`New User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    socket.disconnect();
    console.log('User disconnected!');
  });

  socket.on('BE-check-user', ({ roomId, userName }: any) => {
    let error = false;

    // io.sockets.in(roomId).clients((err: any, clients: any[]) => {
    //   clients.forEach((client: string | number) => {
    //     if (socketList[client] == userName) {
    //       error = true;
    //     }
    //   });
    //   socket.emit('FE-error-user-exist', { error });
    // });

    io.in(roomId).allSockets()
      .then((clients: (string | number)[]) => {
        clients.forEach((client: string | number) => {
          if (socketList[client] == userName) {
            error = true;
          }
        });
        socket.emit('FE-error-user-exist', { error });
      })
      .catch((err: any) => {
        console.error(err);
      });
  });

  /**
   * Join Room
   */
  socket.on('BE-join-room', ({ roomId, userName }: any) => {
    // Socket Join RoomName
    socket.join(roomId);
    socketList[socket.id] = { userName, video: true, audio: true };

    // Set User List
    console.log("roomId, userName", roomId, userName);

    // io.sockets.in(roomId).clients((err: any, clients: any[]) => {
    //   try {
    //     const users: { userId: any; info: any; }[] = [];
    //     console.log("users===", users);

    //     clients.forEach((client: string | number) => {
    //       // Add User List
    //       users.push({ userId: client, info: socketList[client] });
    //     });
    //     socket.broadcast.to(roomId).emit('FE-user-join', users);
    //     console.log("users===222", users);
    //     // io.sockets.in(roomId).emit('FE-user-join', users);
    //   } catch (e) {
    //     io.sockets.in(roomId).emit('FE-error-user-exist', { err: true });
    //   }
    // });

    io.in(roomId).allSockets()
      .then((clients: (string | number)[]) => {
        try {
          const users: { userId: any; info: any; }[] = [];
          console.log("users===", users);

          clients.forEach((client: string | number) => {
            // Add User List
            users.push({ userId: client, info: socketList[client] });
          });
          socket.broadcast.to(roomId).emit('FE-user-join', users);
          console.log("users===222", users);
          // io.sockets.in(roomId).emit('FE-user-join', users);
        } catch (e) {
          io.sockets.in(roomId).emit('FE-error-user-exist', { err: true });
        }
      })
      .catch((err: any) => {
        console.error(err);
      });
  });

  socket.on('BE-call-user', ({ userToCall, from, signal }: any) => {
    io.to(userToCall).emit('FE-receive-call', {
      signal,
      from,
      info: socketList[socket.id],
    });
  });

  socket.on('BE-accept-call', ({ signal, to }: any) => {
    io.to(to).emit('FE-call-accepted', {
      signal,
      answerId: socket.id,
    });
  });

  socket.on('BE-send-message', ({ roomId, msg, sender }: any) => {
    io.sockets.in(roomId).emit('FE-receive-message', { msg, sender });
  });

  socket.on('BE-leave-room', ({ roomId, leaver }: any) => {
    delete socketList[socket.id];
    socket.broadcast
      .to(roomId)
      .emit('FE-user-leave', { userId: socket.id, userName: [socket.id] });
    // io.sockets.sockets[socket.id].leave(roomId);
    socket.leave(roomId);
  });

  socket.on('BE-toggle-camera-audio', ({ roomId, switchTarget }: any) => {
    if (switchTarget === 'video') {
      socketList[socket.id].video = !socketList[socket.id].video;
    } else {
      socketList[socket.id].audio = !socketList[socket.id].audio;
    }
    socket.broadcast
      .to(roomId)
      .emit('FE-toggle-camera', { userId: socket.id, switchTarget });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
