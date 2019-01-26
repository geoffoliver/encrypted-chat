// this is helpful - http://stackoverflow.com/a/10099325/7428656

console.log('Starting server...');

const https = require('https');
const nodeStatic = require('node-static');
const socket = require('socket.io');
const fs = require('fs');
const md5 = require('md5');
const uuid = require('uuid/v4');

console.log('Initializing static server...');
const args = process.argv.slice(2);

let path = null;

if (args[0]) {
  path = `${process.env.PWD}/${args[0]}`;
}

if (!path) {
  console.log('You must provide a path to the files you wish to serve!');
  return;
}

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
let rooms = {};
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

    console.log('request', request.url);
    if (request.url.indexOf('/chat/') === 0) {
      file.serveFile('index.html', 200, {}, request, response);
    } else {
      file.serve(request, response);
    }

  });

  request.resume();
});

server.listen(3000);

function createRoom(hash, name) {
  console.log('Creating room');

  rooms[hash] = {
    id: uuid(),
    name: name,
    members: [],
    created: new Date(),
    locked: false,
    invites: [],
  };
}

function getRoomByName(name, create = true) {
  const hash = md5(name);

  if (create && !hasRoom(name)) {
    createRoom(hash, name);
  }

  return rooms[hash];
}

function getRoomById(id) {
  for (let hash in rooms) {
    if (rooms[hash].id === id) {
      return rooms[hash];
    }
  }

  return null;
}

function hasRoom(name) {
  return rooms.hasOwnProperty(md5(name));
}

function updateRoom(room) {
  rooms[md5(room.name)] = room;
}

function getRoomByInvite(invite) {
  for (let hash in rooms) {
    if (rooms[hash].invites.includes(invite)) {
      return rooms[hash];
    }
  }

  return false;
}

io.on('connection', (socket) => {
  console.log(socket.id + ' connected ' + new Date().toString());

  socket.on('login', (data) => {
    console.log('User login');

    let room = getRoomByName(data.room);

    if (!room) {
      console.log('Unable to retrieve/create room!');
      return;
    }

    let invited = false;

    if (data.invitedTo && room.invites.includes(data.invitedTo)) {
      invited = true;
      room.invites = room.invites.filter(i => i !== data.invitedTo);
      updateRoom(room);
    }

    if (!invited && room.locked) {
      console.log('Room is locked. User cannot join.');
      socket.emit('room.locked');
      return;
    }

    let username = data.user.name.replace(/\d/, '');
    const usernames = room.members.map(u => u.name.replace(/\d/, ''));

    if (usernames.indexOf(username) > -1) {
      const usernameNum = usernames.reduce((acc, value) => {
        if (value === username) {
          return acc+1;
        }
        return acc;
      }, 1);

      username = `${username}-${usernameNum}`;
    }

    for (let i = 0; i < room.members.length; i++) {
    }

    let loggedInUser = {
      name: username,
      system: data.user.system,
      id: uuid(),
      pubKey: data.user.pubKey
    };

    room.members.push(loggedInUser);

    socket.room = room;
    socket.user = loggedInUser;

    socket.join(data.room);

    socket.to(data.room).emit('joined', loggedInUser);

    socket.emit('loggedin', {
      user: loggedInUser,
      room: socket.room
    });

    updateRoom(socket.room);

    socket.to(data.room).emit('members.updated', socket.room.members);
  });

  socket.on('checkRoom', (data) => {
    if (!hasRoom(data.room)) {
      socket.emit('login');
      return;
    }

    if (data.invitedTo && data.room && getRoomByInvite(data.invitedTo) === false) {
      socket.emit('login');
      return;
    }

    const room = getRoomByName(data.room, false);

    if (!room || room.locked) {
      console.log('Room is locked. User cannot join.');
      socket.emit('room.locked');
      return;
    }

    socket.emit('login');
  });

  socket.on('getInvitedRoom', (data) => {
    if (!data.invitedTo) {
      socket.emit('setInvitedRoom', '');
      return;
    }


    const invited = getRoomByInvite(data.invitedTo);
    if (invited) {
      socket.emit('setInvitedRoom', invited.name);
      return;
    }

    socket.emit('setInvitedRoom', '');
  });

  socket.on('addInvite', (inviteId, callback) => {
    if (!socket.room) {
      return;
    }

    const room = getRoomByName(socket.room.name, false);
    room.invites.push(inviteId);

    updateRoom(room);

    callback();
  });

  socket.on('send.message', (data) => {
    if (!socket.room) {
      return;
    }

    console.log('Relaying message');
    io.to(socket.room.name).emit('chat.message', data);
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

    socket.to(socket.room.name).emit('members.updated', socket.room.members);

    typingTimeout[socket.room.name] = setTimeout(function () {
      socket.room.members.some((member) => {
        if (member.id == userId) {
          member.typing = false;
          return true;
        }
      });
      socket.to(socket.room.name).emit('members.updated', socket.room.members);
    }, 1000);
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

    io.to(socket.room.name).emit('members.updated', socket.room.members);
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

    io.to(socket.room.name).emit('members.updated', socket.room.members);
  });

  socket.on('lock', () => {
    if (!socket.room) {
      return;
    }

    socket.room.locked = true;

    updateRoom(socket.room);

    io.to(socket.room.name).emit('locked');
    console.log('Room locked.');
  });

  socket.on('unlock', () => {
    if (!socket.room) {
      return;
    }

    socket.room.locked = false;

    updateRoom(socket.room);

    io.to(socket.room.name).emit('unlocked');
    console.log('Room unlocked.');
  });

  socket.on('disconnect', () => {
    let members = socket.room ? socket.room.members : [];

    console.log(socket.id + ' disconnected ' + new Date().toString());

    if (members.length > 0) {
      for (let i = 0; i < members.length; i++) {
        if (members[i] == socket.user) {
          let departed = socket.room.members.splice(i, 1)[0];

          if (socket.room.members.length === 0) {
            for (let hash in rooms) {
              if (rooms[hash].name == socket.room.name) {
                delete(rooms[hash]);
              }
            }
            socket.room = null;
          } else {
            io.to(socket.room.name).emit('departed', departed);
            io.to(socket.room.name).emit('members.updated', socket.room.members);
          }
          break;
        }
      }
    }

  });

});
