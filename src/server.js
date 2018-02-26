const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const onRequest = (request, response) => {
  if (request.url === '/client/css.css') {
    fs.readFile(`${__dirname}/../client/css.css`, (err, data) => {
      if (err) throw err;
      response.writeHead(200, { 'Content-Type': 'text/css' });
      response.end(data);
    });
  } 
  else if (request.url === '/client.js') {
    fs.readFile(`${__dirname}/../client/client.js`, (err, data) => {
      if (err) throw err;
      response.writeHead(200, { 'Content-Type': 'application/javascript' });
      response.end(data);
    });
  } 
  else {
    fs.readFile(`${__dirname}/../client/client.html`, (err, data) => {
      if (err) throw err;
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(data);
    });
  }
};

const app = http.createServer(onRequest).listen(port);
app.listen(port);

console.log(`Listening on 127.0.0.1:${port}...`);

const io = socketio(app);

//Words to draw.
const wordLibrary = ['Pine Tree', 'House', 'Plane', 'Boat', 'Car', 'Dog', 'Pencil', 'Book', 'TV', 'Cell Phone', 'Apple', 'Alarm Clock', 'Scissors', 'Hands', 'Eyeball', 'Lamp', 'Spatula', 'Socks', 'Sun', 'Fish', 'Ice Cream', 'Fire'];

//Variables
let userID;
const rooms = {};
let roomNumber = 1;
let roomMember = 1;

//Setup Game
const setupGame = () => {
  //Update Canvas
  io.sockets.in(`room${rooms[`room${roomNumber}`][`roomMember${roomMember}`].coords.roomNumber}`).emit('clearCanvas', { user: 'Server' });
  io.sockets.in(`room${rooms[`room${roomNumber}`][`roomMember${roomMember}`].coords.roomNumber}`).emit('msgToClient', { user: 'Server', msg: 'Ready to start the game...' });

  //Points
  for (let i = 1; i <= roomMember; i++) {
    io.sockets.in(`room${roomNumber}`).emit('displayPoints', { user: rooms[`room${roomNumber}`][`roomMember${i}`].user, points: rooms[`room${roomNumber}`][`roomMember${i}`].points });
  }

  //Select Artist (3 roomMember)
  const memberIndex = Math.floor((Math.random() * (4 - 1)) + 1);
  rooms[`room${roomNumber}`].artist = rooms[`room${roomNumber}`][`roomMember${memberIndex}`];
  rooms[`room${roomNumber}`][`roomMember${memberIndex}`].artist = true;

  //Grab A Word
  const wordIndex = Math.floor(Math.random() * wordLibrary.length);
  rooms[`room${roomNumber}`].randoWord = wordLibrary[wordIndex];
  io.sockets.connected[rooms[`room${roomNumber}`].artist.id].emit('msgToClient', { user: 'Server', msg: `You are the artist... Your word: ${rooms[`room${roomNumber}`].randoWord}` });
};

//Winner
const winState = (data, socket) => {
  io.sockets.in(`room${data.coords.room}`).emit('msgToClient', { user: 'Server', clear: true });
  socket.emit('msgToClient', { user: 'Server', msg: 'You Won!' });
  socket.broadcast.to(`room${data.coords.room}`).emit('msgToClient', { user: 'Server', msg: `${data.user} is the Winner!` });

  //Reset
  for (let i = 1; i <= 3; i++) {
    rooms[`room${data.coords.room}`][`roomMember${i}`].points = 0;
    io.sockets.in(`room${data.coords.room}`).emit('updatePoints', { user: rooms[`room${data.coords.room}`][`roomMember${i}`].user, points: rooms[`room${data.coords.room}`][`roomMember${i}`].points });
  }
};

//Check Guesses - Update Points etc
const correctGuess = (data, socket) => {
  io.sockets.in(`room${data.coords.room}`).emit('msgToClient', { user: 'Server', msg: `${data.user} guessed correctly.` });

  rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].points++;

  io.sockets.in(`room${data.coords.room}`).emit('updatePoints', { user: rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].user, points: rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].points });

  if (rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].points >= 3) {
    winState(data, socket);
  }

  for (let i = 1; i <= 3; i++) {
    if (rooms[`room${data.coords.room}`][`roomMember${i}`].artist) { rooms[`room${data.coords.room}`][`roomMember${i}`].artist = false; }
  }

  rooms[`room${data.coords.room}`].artist = rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`];
  rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].artist = true;

  const wordIndex = Math.floor(Math.random() * wordLibrary.length);
  rooms[`room${data.coords.room}`].randoWord = wordLibrary[wordIndex];

  io.sockets.in(`room${data.coords.room}`).emit('clearCanvas', { user: 'Server' });
  io.sockets.connected[rooms[`room${data.coords.room}`].artist.id].emit('msgToClient', { user: 'Server', msg: `You are the artist... Your word: ${rooms[`room${data.coords.room}`].randoWord}` });
};

io.sockets.on('connection', (sock) => {
  const socket = sock;

  socket.join(`room${roomNumber}`);

  socket.on('join', (data) => {
    //New room and setup
    if (!rooms[`room${roomNumber}`]) rooms[`room${roomNumber}`] = {};

    rooms[`room${roomNumber}`][`roomMember${roomMember}`] = {};
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].id = socket.id;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].user = data.user;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].coords = data.coords;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].coords.roomNumber = roomNumber;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].coords.roomMember = roomMember;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].artist = false;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].points = 0;

    socket.user = data.user;
    socket.roomNumber = roomNumber;
    socket.roomMember = roomMember;

    if (roomMember > 1 && roomMember < 4) {
      userID = socket.id;
      socket.broadcast.emit('getCanvasImage', rooms[`room${roomNumber}`][`roomMember${1}`]);
    }

    //New User
    socket.broadcast.to(`room${rooms[`room${roomNumber}`][`roomMember${roomMember}`].coords.roomNumber}`).emit('msgToClient', { user: 'Server', msg: `${data.user} has joined the room.` });
    socket.emit('msgToClient', { user: 'Server', msg: 'You joined the room' });
    socket.emit('updateRoom', { room: rooms[`room${roomNumber}`][`roomMember${roomMember}`].coords.roomNumber, roomMember: rooms[`room${roomNumber}`][`roomMember${roomMember}`].coords.roomMember });

    //Start with 3 members.
    if (roomMember === 3) {
      setupGame();
      roomMember = 0;
      roomNumber++;
    }
    roomMember++;
  });

  socket.on('sendCanvasData', (data) => {
    io.sockets.connected[userID].emit('joined', data);
  });

  socket.on('clear', (data) => {
    if (rooms[`room${data.coords.room}`]) {
      const keys = Object.keys(rooms[`room${data.coords.room}`]);

      if (keys.length === 6) {
        if (rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].artist) {
          io.sockets.in(`room${data.coords.room}`).emit('clearCanvas', { user: 'Server' });
        }
      } else {
        io.sockets.in(`room${data.coords.room}`).emit('clearCanvas', { user: 'Server' });
      }
    }
  });

  //Update Drawing
  socket.on('updateServer', (data) => {
    if (rooms[`room${data.coords.room}`]) {
      const keys = Object.keys(rooms[`room${data.coords.room}`]);

      //Artist has canvas control
      if (keys.length === 6) {
        if (rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].artist) {
          if (rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].coords.lastUpdate < data.coords.lastUpdate) {
            rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].coords = data.coords;
          }
          io.sockets.in(`room${data.coords.room}`).emit('updateClient', { user: data.user, coords: data.coords });
        }
      } else {
        if (rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].coords.lastUpdate < data.coords.lastUpdate) {
          rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].coords = data.coords;
        }
          io.sockets.in(`room${data.coords.room}`).emit('updateClient', { user: data.user, coords: data.coords });
      }
    }
  });

  //Handles messages
  socket.on('msgToServer', (data) => {
    if (rooms[`room${data.coords.room}`]) {
       const keys = Object.keys(rooms[`room${data.coords.room}`]);

       if (keys.length === 6) {
         if (!rooms[`room${data.coords.room}`][`roomMember${data.coords.roomMember}`].artist) {
           io.sockets.in(`room${data.coords.room}`).emit('msgToClient', { user: data.user, msg: data.msg });

           if (data.msg === rooms[`room${data.coords.room}`].randoWord) {
              correctGuess(data, socket);
              console.log("Correct Word Guessed.");
           }
         }
      } 
      else {
         io.sockets.in(`room${data.coords.room}`).emit('msgToClient', { user: data.user, msg: data.msg });
      }
    }
  });

  socket.on('disconnect', () => {
    const message = `${socket.user} has left the room.`;
    socket.broadcast.to(`room${socket.roomNumber}`).emit('msgToClient', { user: 'Server', msg: message });

    socket.leave(`room${socket.roomNumber}`);

    //Game ends without 3 users.
    socket.broadcast.to(`room${socket.roomNumber}`).emit('msgToClient', { user: 'Server', msg: 'User has disconnected. Not enough roomMembers to continue.' });

    delete rooms[`room${socket.roomNumber}`];
  });
});
