const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};
const messages = {}; 

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
  res.render('index');
});

// Serve chat.ejs at '/chat'
app.get('/chat', (req, res) => {
  const { room, identity } = req.query;
  res.render('chat', { room, identity });
});

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const parsedMessage = JSON.parse(message);

    if (parsedMessage.type === 'join') {
      const { room, identity } = parsedMessage.payload;

      if (!rooms[room]) {
        rooms[room] = [];
        messages[room] = [];
      }

      ws.room = room;
      ws.identity = identity;
      rooms[room].push(ws);

      ws.send(JSON.stringify({
        type: 'system',
        payload: `You have joined room: <strong style="color:#4367cb" > ${room} </strong>`
      }));

      // Send existing messages to the user who just joined
      messages[room].forEach(msg => {
        ws.send(JSON.stringify(msg));
      });

      // Broadcast to others in the room that a new user has joined
      rooms[room].forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'system',
            payload: `<strong style="color:#ef9d5a" >${identity}</strong> has joined the room`
          }));
        }
      });
    } else if (parsedMessage.type === 'message') {
      const { room, message: chatMessage } = parsedMessage.payload;

      if (rooms[room]) {
        const newMessage = {
          type: 'message',
          room: room,
          identity: ws.identity,
          payload: chatMessage
        };

        // Store message
        messages[room].push(newMessage);

        // Broadcast message to all clients in the room
        rooms[room].forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(newMessage));
          }
        });
      }
    } else if (parsedMessage.type === 'clear') {
      const { room,identity } = parsedMessage.payload;

      if (rooms[room]) {
        // Clear messages for the room
        messages[room] = [];

        // Notify all clients in the room that messages have been cleared
        rooms[room].forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'clear' }));
            client.send(JSON.stringify({
              type: 'system',
              payload: `The chat has been cleared by <strong style="color:#ff7a7a" >${identity}</strong> `
            }));
            // Optionally, you can send a special clear message to clear the UI
          }
        });
      }
    }
  });

  ws.on('close', () => {
    const { room } = ws;
    if (rooms[room]) {
      rooms[room] = rooms[room].filter(client => client !== ws);
    }
  });
});


server.listen(8080, () => {
  console.log('Server is listening on port 8080');
});
