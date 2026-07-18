const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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

        try {
            let tiktokConnection = new WebcastPushConnection(tiktokUsername, {
                enableExtendedGiftInfo: true
            });

            tiktokConnection.connect().then(state => {
                socket.emit('system-status', { status: 'connected', message: `Đã kết nối luồng Live của ${tiktokUsername}` });
                activeConnections.set(socket.id, tiktokConnection);
            }).catch(err => {
                // SỬA TẠI ĐÂY: Kiểm tra lỗi an toàn tránh đọc thuộc tính undefined
                let errorMsg = 'ID không tồn tại hoặc tài khoản hiện không livestream.';
                if (err && err.message) {
                    errorMsg = err.message;
                } else if (typeof err === 'string') {
                    errorMsg = err;
                }
                socket.emit('system-status', { status: 'error', message: `Lỗi kết nối: ${errorMsg}` });
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

        } catch (error) {
            socket.emit('system-status', { status: 'error', message: `Lỗi khởi tạo module: ${error.message}` });
        }
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
