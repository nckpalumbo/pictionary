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
  } else if (request.url === '/client.js') {
    fs.readFile(`${__dirname}/../client/client.js`, (err, data) => {
      if (err) throw err;
      response.writeHead(200, { 'Content-Type': 'application/javascript' });
      response.end(data);
    });
  } else {
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
//Variables
let userID;
const rooms = {};
let roomNumber = 1;
let roomMember = 1;

//Words to draw.
const wordLibrary = ['Pine Tree', 'House', 'Calculator', 'Plane', 'Boat', 'Car', 'Dog', 'Pencil', 'Book', 'TV', 'Cell Phone', 'Apple', 'Alarm Clock', 'Scissors', 'Hands', 'Eyeball', 'Lamp', 'Spatula', 'Socks', 'Sun', 'Fish', 'Ice Cream', 'Fire', 'Coconut', 'Acorn', 'Soccer Ball'];

//Setup Game
const setupGame = () => {
  //Update Canvas
  io.sockets.in(`room${rooms[`room${roomNumber}`][`roomMember${roomMember}`].coordinates.roomNumber}`).emit('clearCanvas', { user: 'Server' });
  io.sockets.in(`room${rooms[`room${roomNumber}`][`roomMember${roomMember}`].coordinates.roomNumber}`).emit('msgToClient', { user: 'Server', msg: 'Starting the game...' });

  //Points
  for (let i = 1; i <= roomMember; i++) {
    io.sockets.in(`room${roomNumber}`).emit('displayPoints', { user: rooms[`room${roomNumber}`][`roomMember${i}`].user, points: rooms[`room${roomNumber}`][`roomMember${i}`].points });
  }

  //Select Artist (3 users)
  const memberIndex = Math.floor((Math.random() * (4 - 1)) + 1);
  rooms[`room${roomNumber}`].artist = rooms[`room${roomNumber}`][`roomMember${memberIndex}`];
  rooms[`room${roomNumber}`][`roomMember${memberIndex}`].artist = true;

  //Grab A Word
  const wordIndex = Math.floor(Math.random() * wordLibrary.length);
  rooms[`room${roomNumber}`].randoWord = wordLibrary[wordIndex];
  io.sockets.connected[rooms[`room${roomNumber}`].artist.id].emit('msgToClient', { user: 'Server', msg: `Artist your word is... ${rooms[`room${roomNumber}`].randoWord}` });
};

//Winner
const winState = (data, socket) => {
  io.sockets.in(`room${data.coordinates.room}`).emit('msgToClient', { user: 'Server', clear: true });
  socket.emit('msgToClient', { user: 'Server', msg: 'You Won! Resetting the game...' });
  socket.broadcast.to(`room${data.coordinates.room}`).emit('msgToClient', { user: 'Server', msg: `${data.user} is the Winner! Resetting the game...` });
  //To Do: Track winners
    
  //Reset
  for (let i = 1; i <= 3; i++) {
    rooms[`room${data.coordinates.room}`][`roomMember${i}`].points = 0;
    io.sockets.in(`room${data.coordinates.room}`).emit('updatePoints', { user: rooms[`room${data.coordinates.room}`][`roomMember${i}`].user, points: rooms[`room${data.coordinates.room}`][`roomMember${i}`].points });
  }
};

//Check Guesses - Update Points etc
const correctGuess = (data, socket) => {
  io.sockets.in(`room${data.coordinates.room}`).emit('msgToClient', { user: 'Server', msg: `${data.user} guessed correctly and is now the artist...` });

  rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].points++;

  io.sockets.in(`room${data.coordinates.room}`).emit('updatePoints', { user: rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].user, points: rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].points });

  if (rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].points >= 3) {
    winState(data, socket);
  }

  for (let i = 1; i <= 3; i++) {
    if (rooms[`room${data.coordinates.room}`][`roomMember${i}`].artist) { rooms[`room${data.coordinates.room}`][`roomMember${i}`].artist = false; }
  }

  rooms[`room${data.coordinates.room}`].artist = rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`];
  rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].artist = true;

  //Get random word
  const wordIndex = Math.floor(Math.random() * wordLibrary.length);
  rooms[`room${data.coordinates.room}`].randoWord = wordLibrary[wordIndex];

  io.sockets.in(`room${data.coordinates.room}`).emit('clearCanvas', { user: 'Server' });
  io.sockets.connected[rooms[`room${data.coordinates.room}`].artist.id].emit('msgToClient', { user: 'Server', msg: `Artist your word is... ${rooms[`room${data.coordinates.room}`].randoWord}` });
};

io.sockets.on('connection', (sock) => {
  const socket = sock;
  socket.join(`room${roomNumber}`);

  socket.on('join', (data) => {
    //New room?
    if (!rooms[`room${roomNumber}`]) { rooms[`room${roomNumber}`] = {}; }

    //Setup room data
    rooms[`room${roomNumber}`][`roomMember${roomMember}`] = {};
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].points = 0;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].id = socket.id;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].artist = false;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].user = data.user;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].coordinates = data.coordinates;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].coordinates.roomNumber = roomNumber;
    rooms[`room${roomNumber}`][`roomMember${roomMember}`].coordinates.roomMember = roomMember;

    socket.user = data.user;
    socket.roomNumber = roomNumber;
    socket.roomMember = roomMember;

    if (roomMember > 1 && roomMember < 4) {
      userID = socket.id;
      socket.broadcast.emit('getCanvasImage', rooms[`room${roomNumber}`][`roomMember${1}`]);
    }

    //New User
    socket.broadcast.to(`room${rooms[`room${roomNumber}`][`roomMember${roomMember}`].coordinates.roomNumber}`).emit('msgToClient', { user: 'Server', msg: `${data.user} has joined the room.` });
    socket.emit('msgToClient', { user: 'Server', msg: 'You joined the room. Three members are required to play...' });
    socket.emit('updateRoom', { room: rooms[`room${roomNumber}`][`roomMember${roomMember}`].coordinates.roomNumber, roomMember: rooms[`room${roomNumber}`][`roomMember${roomMember}`].coordinates.roomMember });

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
    if (rooms[`room${data.coordinates.room}`]) {
      const keys = Object.keys(rooms[`room${data.coordinates.room}`]);

      if (keys.length === 5) {
        if (rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].artist) {
          io.sockets.in(`room${data.coordinates.room}`).emit('clearCanvas', { user: 'Server' });
        }
      } else {
        io.sockets.in(`room${data.coordinates.room}`).emit('clearCanvas', { user: 'Server' });
      }
    }
  });

  //Update Drawing
  socket.on('updateServer', (data) => {
    if (rooms[`room${data.coordinates.room}`]) {
      const keys = Object.keys(rooms[`room${data.coordinates.room}`]);

      //Artist is only drawing that transmits to others but others can still draw on their own
      if (keys.length === 5) {
        if (rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].artist) {
//         if (rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].coordinates.lastUpdate < data.coordinates.lastUpdate) {
//           rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].coordinates = data.coordinates;
//         }
          io.sockets.in(`room${data.coordinates.room}`).emit('updateClient', { user: data.user, coordinates: data.coordinates });
        }
      } else {
        if (rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].coordinates.lastUpdate < data.coordinates.lastUpdate) {
          rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].coordinates = data.coordinates;
        }
        io.sockets.in(`room${data.coordinates.room}`).emit('updateClient', { user: data.user, coordinates: data.coordinates });
      }
    }
  });

  //Handles messages
  socket.on('msgToServer', (data) => {
    if (rooms[`room${data.coordinates.room}`]) {
      const keys = Object.keys(rooms[`room${data.coordinates.room}`]);

      if (keys.length === 5) { //Key of rooms
        if (!rooms[`room${data.coordinates.room}`][`roomMember${data.coordinates.roomMember}`].artist) {
          io.sockets.in(`room${data.coordinates.room}`).emit('msgToClient', { user: data.user, msg: data.msg });

          //If correct guess, call correct guesses
          if (data.msg.toUpperCase() === rooms[`room${data.coordinates.room}`].randoWord.toUpperCase()) {
            correctGuess(data, socket);
          }
        }
      } else {
        io.sockets.in(`room${data.coordinates.room}`).emit('msgToClient', { user: data.user, msg: data.msg }); //Handle normal messages
      }
    }
  });

  socket.on('disconnect', () => {
    const message = `${socket.user} has left the room.`;
    socket.broadcast.to(`room${socket.roomNumber}`).emit('msgToClient', { user: 'Server', msg: message });
    socket.leave(`room${socket.roomNumber}`);

    //Game ends without 3 users.
    socket.broadcast.to(`room${socket.roomNumber}`).emit('msgToClient', { user: 'Server', msg: 'User has disconnected. Not enough players to continue.' });

    delete rooms[`room${socket.roomNumber}`];
  });
});
