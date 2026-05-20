import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from "cors";
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        credentials: true,
    },
});
const PORT = process.env.PORT || 3001;
let socketList = {};
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(cors({
    origin: '*',
    credentials: true,
}));
app.use(express.static(path.join(__dirname, 'public')));
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));
    app.get('/*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build/index.html'));
    });
}
app.get('/ping', (req, res) => {
    res.status(200).send({ success: true });
});
io.on('connection', (socket) => {
    console.log(`New User connected: ${socket.id}`);
    socket.on('disconnect', () => {
        socket.disconnect();
        console.log('User disconnected!');
    });
    socket.on('BE-check-user', ({ roomId, userName }) => {
        let error = false;
        io.in(roomId).allSockets()
            .then((clients) => {
            clients.forEach((client) => {
                if (socketList[client] == userName) {
                    error = true;
                }
            });
            socket.emit('FE-error-user-exist', { error });
        })
            .catch((err) => {
            console.error(err);
        });
    });
    socket.on('BE-join-room', ({ roomId, userName }) => {
        socket.join(roomId);
        socketList[socket.id] = { userName, video: true, audio: true };
        console.log("roomId, userName", roomId, userName);
        io.in(roomId).allSockets()
            .then((clients) => {
            try {
                const users = [];
                console.log("users===", users);
                clients.forEach((client) => {
                    users.push({ userId: client, info: socketList[client] });
                });
                socket.broadcast.to(roomId).emit('FE-user-join', users);
                console.log("users===222", users);
            }
            catch (e) {
                io.sockets.in(roomId).emit('FE-error-user-exist', { err: true });
            }
        })
            .catch((err) => {
            console.error(err);
        });
    });
    socket.on('BE-call-user', ({ userToCall, from, signal }) => {
        io.to(userToCall).emit('FE-receive-call', {
            signal,
            from,
            info: socketList[socket.id],
        });
    });
    socket.on('BE-accept-call', ({ signal, to }) => {
        io.to(to).emit('FE-call-accepted', {
            signal,
            answerId: socket.id,
        });
    });
    socket.on('BE-send-message', ({ roomId, msg, sender }) => {
        io.sockets.in(roomId).emit('FE-receive-message', { msg, sender });
    });
    socket.on('BE-leave-room', ({ roomId, leaver }) => {
        delete socketList[socket.id];
        socket.broadcast
            .to(roomId)
            .emit('FE-user-leave', { userId: socket.id, userName: [socket.id] });
        socket.leave(roomId);
    });
    socket.on('BE-toggle-camera-audio', ({ roomId, switchTarget }) => {
        if (switchTarget === 'video') {
            socketList[socket.id].video = !socketList[socket.id].video;
        }
        else {
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
