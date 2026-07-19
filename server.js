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

    // Chuyển hẳn sang cơ chế async/await để bắt được mọi lỗi bất đồng bộ từ lõi thư viện
    socket.on('start-tiktok-stream', async ({ tiktokUsername }) => {
        disconnectTikTok(socket.id);

        socket.emit('system-status', { status: 'connecting', message: `Đang kết nối tới: ${tiktokUsername}...` });

        try {
            let tiktokConnection = new WebcastPushConnection(tiktokUsername, {
                enableExtendedGiftInfo: true,
                requestOptions: {
                    timeout: 10000 // Giới hạn thời gian phản hồi tránh treo luồng
                }
            });

            // Bắt sự kiện lỗi trực tiếp từ instance trước khi thực hiện connect
            tiktokConnection.on('error', (err) => {
                console.error('Lỗi phát sinh từ luồng TikTok:', err);
                socket.emit('system-status', { 
                    status: 'error', 
                    message: `Luồng Live gặp lỗi: ${err?.message || 'Mất kết nối đột ngột'}` 
                });
            });

            // Tiến hành kết nối bất đồng bộ một cách an toàn
            await tiktokConnection.connect();
            
            // Nếu chạy đến đây tức là đã kết nối thành công
            socket.emit('system-status', { status: 'connected', message: `Đã kết nối luồng Live của ${tiktokUsername}` });
            activeConnections.set(socket.id, tiktokConnection);

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
            // Bắt toàn bộ lỗi "reading status" hoặc lỗi từ server TikTok tại đây
            console.error('Bắt được ngoại lệ kết nối:', error);
            
            let friendlyMessage = 'ID không tồn tại, tài khoản không Live hoặc IP Server bị TikTok chặn tạm thời.';
            if (error && error.message) {
                friendlyMessage = error.message;
            }
            
            socket.emit('system-status', { 
                status: 'error', 
                message: `Lỗi kết nối: ${friendlyMessage}` 
            });
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
