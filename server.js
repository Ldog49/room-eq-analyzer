const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 100e6 });

app.use(express.static('public'));

app.get('/api/qrcode', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    const dataUrl = await QRCode.toDataURL(url, {
      width: 240,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.json({ dataUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

io.on('connection', socket => {
  socket.on('join', ({ session, role }) => {
    socket.join(session);
    socket.data = { session, role };

    if (role === 'mobile') {
      socket.to(session).emit('phone:connected');
    } else {
      const room = io.sockets.adapter.rooms.get(session);
      if (room && room.size > 1) socket.emit('phone:connected');
    }
  });

  socket.on('recording:start', () => {
    socket.to(socket.data.session).emit('recording:start');
  });

  socket.on('recording:done', () => {
    socket.to(socket.data.session).emit('recording:done');
  });

  socket.on('audio:chunk', (chunk) => {
    socket.to(socket.data.session).emit('audio:chunk', chunk);
  });

  socket.on('audio:final', (data) => {
    socket.to(socket.data.session).emit('audio:final', data);
  });

  socket.on('disconnect', () => {
    if (socket.data?.role === 'mobile') {
      socket.to(socket.data.session).emit('phone:disconnected');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Room EQ Analyzer running on port ${PORT}`);
});
