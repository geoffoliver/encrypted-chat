// this is helpful - http://stackoverflow.com/a/10099325/7428656

console.log('Starting server...');

const https = require('https');
const nodeStatic = require('node-static');
const socket = require('socket.io');
const fs = require('fs');

console.log('Initializing static server...');
const args = process.argv.slice(2);

let path = `${__dirname}/public`

if (args[0]) {
  path = `${process.env.PWD}/${args[0]}`;
}

console.log('path', path);

const file = new nodeStatic.Server(path, {
  cache: 0,
  gzip: true
});

console.log('Initializing systemg user...');
const systemUser = {
  name: 'System',
  system: true
};

console.log('Initializing rooms...');
let rooms = [];
let typingTimeout = {};

console.log('Initializing connection options...');
const options = {
  key: fs.readFileSync(`${__dirname}/server.key`),
  cert: fs.readFileSync(`${__dirname}/server.crt`)
};

console.log('Initializing socket connection...');
const io = socket(https.createServer(options).listen(4000));

console.log('Initializing HTTPS server...');
const server = https.createServer(options, (request, response) => {
  request.addListener('end', () => {
    console.log('Serving file...', request.url);
    file.serve(request, response);
  });

  request.resume();
});

server.listen(3000);

function createRoom(name) {
  console.log('Creating room');
  rooms[name] = {
    name: name,
    members: [],
    created: new Date(),
    locked: false
  };
}

function getRoom(name) {
  if (!rooms.hasOwnProperty(name)) {
    createRoom(name);
  }

  return rooms[name];
}

io.on('connection', (socket) => {
  console.log(socket.id + ' connected ' + new Date().toString());

  socket.on('login', (data) => {
    console.log('User login');
    let room = getRoom(data.room);

    if (!room) {
      return;
    }

    if (room.locked) {
      socket.emit('room.locked');
      return;
    }

    let loggedInUser = {
      name: data.user.name,
      system: data.user.system,
      id: socket.id,
      pubKey: data.user.pubKey
    };

    room.members.push(loggedInUser);

    socket.room = room;
    socket.user = loggedInUser;

    socket.join(data.room);

    socket.broadcast.to(data.room).emit('joined', loggedInUser);

    socket.emit('loggedin', loggedInUser);

    io.to(data.room).emit('members.updated', room.members);
  });

  socket.on('chat.message', (data) => {
    console.log('Chat message');
    if (!socket.room) {
      return;
    }
    socket.broadcast.to(socket.room.name).emit('chat.message', data);
  });

  socket.on('typing', (userId) => {
    if (!socket.room) {
      return;
    }

    if (typingTimeout[socket.room.name]) {
      clearTimeout(typingTimeout[socket.room.name]);
    }

    socket.room.members.some((member) => {
      if (member.id == userId) {
        member.typing = true;
        return true;
      }
    });

    socket.broadcast.to(socket.room.name).emit('members.updated', socket.room.members);

    typingTimeout[socket.room.name] = setTimeout(function () {
      socket.room.members.some((member) => {
        if (member.id == userId) {
          member.typing = false;
          return true;
        }
      });
      socket.broadcast.to(socket.room.name).emit('members.updated', socket.room.members);
    }, 250);
  });

  socket.on('active', (userId) => {
    if (!socket.room) {
      return;
    }
    socket.room.members.some((member) => {
      if (member.id == userId) {
        member.active = true;
        return true;
      }
    });

    socket.broadcast.to(socket.room.name).emit('members.updated', socket.room.members);
  });

  socket.on('inactive', (userId) => {
    if (!socket.room) {
      return;
    }
    socket.room.members.some((member) => {
      if (member.id == userId) {
        member.active = false
        return true;
      }
    });

    socket.broadcast.to(socket.room.name).emit('members.updated', socket.room.members);
  });

  socket.on('lock', () => {
    socket.room.locked = true;
  });

  socket.on('unlock', () => {
    socket.room.locked = false;
  });

  socket.on('disconnect', () => {
    let members = socket.room ? socket.room.members : [];

    console.log(socket.id + ' disconnected ' + new Date().toString());

    if (members.length > 0) {
      for (let i = 0; i < members.length; i++) {
        if (members[i] == socket.user) {
          let departed = socket.room.members.splice(i, 1)[0];
          io.to(socket.room.name).emit('departed', departed);
          io.to(socket.room.name).emit('members.updated', socket.room.members);
          break;
        }
      }
    }

  });

});
