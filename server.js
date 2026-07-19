const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Cấu hình để nhận dữ liệu dạng JSON từ Script gửi về
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint tiếp nhận comment từ điện thoại phụ gửi lên
app.post('/api/stream-comment', (req, res) => {
    const { uniqueId, nickname, comment, profilePictureUrl } = req.body;
    
    if (comment) {
        // Phát dữ liệu comment tới tất cả màn hình giao diện hồng đang mở
        io.emit('new-comment', {
            uniqueId: uniqueId || 'Ẩn danh',
            nickname: nickname || 'Người dùng TikTok',
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
