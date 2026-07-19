const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Cho phép nhận dữ liệu JSON từ Bot VPS gửi lên
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint xử lý tiếp nhận comment từ Bot ngầm gửi về
app.post('/api/stream-comment', (req, res) => {
    const { uniqueId, nickname, comment, profilePictureUrl } = req.body;
    
    if (comment) {
        // Bắn trực tiếp dữ liệu xuống giao diện trang màu hồng qua Socket.io
        io.emit('new-comment', {
            uniqueId: uniqueId || 'Ẩn danh',
            nickname: nickname || 'Người dùng',
            comment: comment,
            profilePictureUrl: profilePictureUrl || ''
        });
    }
    res.status(200).json({ success: true });
});

io.on('connection', (socket) => {
    console.log(`Thiết bị xem giao diện kết nối: ${socket.id}`);
});

server.listen(PORT, () => {
    console.log(`Server chạy ổn định tại port: ${PORT}`);
});
