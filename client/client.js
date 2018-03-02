"use strict";

var canvas;
var ctx;
var dragging = false;
var lineWidth;
var strokeStyle;

var draws = {};
var user;

var clientCoordinates = {
  prevX: 0, prevY: 0, destX: 0, destY: 0,
  lineWidth: 5,
  strokeStyle: 'black',
  room: 1, roomMember: 1
};

//Mouse
var getMouse = function getMouse(e) {
  return {
    x: e.pageX - e.target.offsetLeft,
    y: e.pageY - e.target.offsetTop
  };
};

var doMouseDown = function doMouseDown(e) {
  dragging = true;
  var mouse = getMouse(e);
  clientCoordinates.prevX = mouse.x;
  clientCoordinates.prevY = mouse.y;

  clientCoordinates.destX = mouse.x;
  clientCoordinates.destY = mouse.y;
};

var doMouseMove = function doMouseMove(e) {
  if (!dragging) {
    clientCoordinates.destX = clientCoordinates.prevX;
    clientCoordinates.destY = clientCoordinates.prevY;
    return;
  }

  var mouse = getMouse(e);
  clientCoordinates.prevX = clientCoordinates.destX;
  clientCoordinates.prevY = clientCoordinates.destY;

  clientCoordinates.destX = mouse.x;
  clientCoordinates.destY = mouse.y;
};

var doMouseUp = function doMouseUp(e) {
  dragging = false;
};

var doMouseOut = function doMouseOut(e) {
  dragging = false;
};

var changeLine = function changeLine(e) {
  lineWidth = e.target.value;
};

var changeStroke = function changeStroke(e) {
  strokeStyle = e.target.value;
};

var clearCanvas = function clearCanvas() {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};

//Draw
var draw = function draw() {
  var keys = Object.keys(draws);
  
  for (var i = 0; i < keys.length; i++) {
    var drawCall = draws[keys[i]];

    ctx.lineWidth = drawCall.lineWidth;
    ctx.strokeStyle = drawCall.strokeStyle;

    ctx.beginPath();
    ctx.moveTo(drawCall.prevX, drawCall.prevY);
    ctx.lineTo(drawCall.destX, drawCall.destY);
    ctx.closePath();
    ctx.stroke();
  }
};

var handleResponse = function handleResponse(data) {
  if (!draws[data.user]) {
    draws[data.user] = data.coordinates;
  } else if (data.coordinates.lastUpdate > draws[data.user].lastUpdate) {
    draws[data.user] = data.coordinates;
  }
  draw();
};

var onJoin = function onJoin(data) {
  var image = new Image();

  image.src = data.imgData;
  image.onload = function () {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  };
};

var connectSocket = function connectSocket(e) {
  var socket = io.connect();

  var setup = function setup() {
    var time = new Date().getTime();

    user = document.querySelector("#username").value;
    clientCoordinates.lastUpdate = time;

    draws[user] = clientCoordinates;
    socket.emit('join', { user: user, coordinates: clientCoordinates });
    document.querySelector("#usernameInput").style.display = "none";
  };

  var update = function update() {
    var time = new Date().getTime();

    clientCoordinates.lastUpdate = time;

    clientCoordinates.lineWidth = lineWidth;
    clientCoordinates.strokeStyle = strokeStyle;

    socket.emit('updateServer', { user: user, coordinates: clientCoordinates });
  };

  var sendClear = function sendClear(e) {
    socket.emit('clear', { user: user, coordinates: clientCoordinates });
  };

  var sendMessage = function sendMessage(e) {
    var messageSend = document.querySelector('#message').value;

    if (messageSend){
        socket.emit('msgToServer', { user: user, msg: messageSend, coordinates: clientCoordinates });
    }
    
    document.querySelector('#message').value = '';
  };

  var message = document.querySelector('#message');
  message.onfocus = function () {
    message.value = '';
  };

  socket.on('connect', function () {
    setup();
    setInterval(update, 1);

    message.addEventListener('keyup', function (e) {
      e.preventDefault();
      if (e.keyCode === 13) {
        sendMessage();
        message.value = '';
      }
    });
    document.querySelector('#send').onclick = sendMessage;
    document.querySelector('#clearButton').onclick = sendClear;
  });

  socket.on('getCanvasImage', function (data) {
    if (user === data.user) {
      socket.emit('sendCanvasData', { imgData: canvas.toDataURL() });
    }
  });

  socket.on('updateRoom', function (data) {
    clientCoordinates.room = data.room;
    clientCoordinates.roomMember = data.roomMember;
  });

  socket.on('joined', onJoin);
  socket.on('clearCanvas', clearCanvas);

  //Score
  var scoreSection = document.querySelector('#scoreSection');
  socket.on('displayPoints', function (data) {
    var p = document.createElement('p');
    p.setAttribute('name', data.user);
    p.innerHTML = data.user + "'s points: " + data.points;
    scoreSection.appendChild(p);
  });

  socket.on('updatePoints', function (data) {
    var userPoints = document.getElementsByName(data.user);
    userPoints[0].innerHTML = data.user + "'s points: " + data.points;
  });
  socket.on('updateClient', handleResponse);

  var chatarea = document.getElementById('chat');

  socket.on('msgToClient', function (data) {
    chatarea.scrollTop = chatarea.scrollHeight;

    if(data.clear){
        chat.innerHTML = '';
    }

    if (data.msg) {
      var text = data.user + ": " + data.msg + '\n';
      chat.innerHTML += text;
    }
  });
};

var init = function init() {
  canvas = document.querySelector('#canvas');
  ctx = canvas.getContext('2d');

  lineWidth = 5;
  strokeStyle = 'black';

  ctx.lineCape = 'round';
  ctx.lineJoin = 'round';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  canvas.onmousedown = doMouseDown;
  canvas.onmousemove = doMouseMove;
  canvas.onmouseup = doMouseUp;
  canvas.onmouseout = doMouseOut;

  document.querySelector('#widthChoice').onchange = changeLine;
  document.querySelector('#styleChoice').onchange = changeStroke;

  var connect = document.querySelector('#connect');
  connect.addEventListener('click', connectSocket);
};

window.onload = init;
