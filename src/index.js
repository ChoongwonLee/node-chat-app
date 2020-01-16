const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const {
  generateMessage,
  generateLocationMessage
} = require('./utils/messages');
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom
} = require('./utils/users');

const app = express();
// Create and configure server outside of express library
// to use express library
const server = http.createServer(app);
const io = socketio(server);

// Setup port
const port = process.env.PORT || 3000;
// Setup public directory path
const publicDirectoryPath = path.join(__dirname, '../public');
// Setup static directory to serve
app.use(express.static(publicDirectoryPath));

// socket.emit: sends event to specific client
// socket.io: sends event to every connected client
// socket.broadcast.emit: sends event to every client except this socket
io.on('connection', socket => {
  console.log('New WebSocket connection');
  // // send event to client (refeing sigle client)
  // socket.emit('message', generateMessage('Welcome!'));
  // // send everyone except the socket
  // socket.broadcast.emit('message', generateMessage('A new user has joined!'));

  socket.on('join', (options, callback) => {
    const { error, user } = addUser({ id: socket.id, ...options });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);

    socket.emit('message', generateMessage('Admin', 'Welcome!'));
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        generateMessage('Admin', `${user.username} has joined!`)
      );
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room)
    });
    callback();
  });

  // // receive from client
  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);
    const filter = new Filter();

    if (filter.isProfane(message)) {
      return callback('Profanity is not allowed!');
    }

    // emmit to every connection availible
    io.to(user.room).emit('message', generateMessage(user.username, message));
    callback('Delivered!');
  });

  socket.on('sendLocation', (coords, callback) => {
    const user = getUser(socket.id);
    io.to(user.room).emit(
      'locationMessage',
      generateLocationMessage(
        user.username,
        `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
      )
    );
    callback();
  });

  // when user disconnect
  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        generateMessage('Admin', `${user.username} has left!`)
      );
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room)
      });
    }
  });
});

server.listen(port, () => {
  console.log(`Server is up on port ${port}`);
});
