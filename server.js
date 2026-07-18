const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Thay vì dùng express.static('public'), ta cấu hình trả về file index.html nằm cùng thư mục
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Quản lý các kết nối TikTok theo từng Socket ID
const activeConnections = new Map();

io.on('connection', (socket) => {
    console.log(`Thiết bị kết nối mới: ${socket.id}`);

    const disconnectTikTok = (socketId) => {
        if (activeConnections.has(socketId)) {
            try {
                activeConnections.get(socketId).disconnect();
            } catch (e) {
                console.error('Lỗi khi đóng kết nối cũ:', e.message);
            }
            activeConnections.delete(socketId);
        }
    };

    socket.on('start-tiktok-stream', ({ tiktokUsername }) => {
        disconnectTikTok(socket.id);

        socket.emit('system-status', { status: 'connecting', message: `Đang kết nối tới: ${tiktokUsername}...` });

        let tiktokConnection = new WebcastPushConnection(tiktokUsername, {
            enableExtendedGiftInfo: true
        });

        tiktokConnection.connect().then(state => {
            socket.emit('system-status', { status: 'connected', message: `Đã kết nối luồng Live của ${tiktokUsername}` });
            activeConnections.set(socket.id, tiktokConnection);
        }).catch(err => {
            socket.emit('system-status', { status: 'error', message: `Lỗi kết nối: ${err.message}. Hãy kiểm tra lại ID.` });
        });

        tiktokConnection.on('chat', (data) => {
            socket.emit('new-comment', {
                userId: data.userId,
                uniqueId: data.uniqueId,
                nickname: data.nickname,
                comment: data.comment,
                profilePictureUrl: data.profilePictureUrl
            });
        });

        tiktokConnection.on('disconnected', () => {
            socket.emit('system-status', { status: 'disconnected', message: 'Luồng livestream đã dừng hoặc bị ngắt.' });
            disconnectTikTok(socket.id);
        });
    });

    socket.on('request-reset', () => {
        disconnectTikTok(socket.id);
        socket.emit('system-status', { status: 'idle', message: 'Hệ thống đã reset. Sẵn sàng kết nối mới.' });
    });

    socket.on('disconnect', () => {
        console.log(`Thiết bị ngắt kết nối: ${socket.id}`);
        disconnectTikTok(socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server đang chạy tại port: ${PORT}`);
});
