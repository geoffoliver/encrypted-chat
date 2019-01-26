import { Component, ViewChild, ElementRef, Injectable } from '@angular/core';
import { ActivatedRoute, Router, ParamMap } from '@angular/router';
const uuid = require('uuid/v4');

import { Socket } from 'ngx-socket-io';

import { Message } from '../../models/message';
import { User } from '../../models/user';
//import { Room } from '../../models/room';

var openpgp = require('openpgp');

const unlockedIcon = 'lock-open';
const lockedIcon = 'lock';

declare var openpgp: any;

@Injectable({
  providedIn: 'root'
})
@Component({
  moduleId: module.id,
  selector: 'room',
  templateUrl: './room.html',
  styleUrls: ['./room.css']
})
export class RoomComponent {
  loggingIn: boolean = false;

  messages: Message[] = [];
  newMessage: string = '';

  roomName: string = '';
  roomId: string = '';
  nickname: string = '';
  password: string = '';
  members: User[] = [];
  //room: Room = null;

  me: User;
  _me: User;
  systemUser: User;

  connected: boolean = false;
  notify: boolean = false;
  privKey: any = {};
  socketConnected: boolean = false;
  connectFailed: boolean = false;
  locked: boolean = false;
  locking: boolean = false;
  lockIcon: string = unlockedIcon;
  lockTimeout: any = null;

  lookingUpRoom: boolean = false;
  invitedTo: string = null;

  copying: boolean = false;

  sendingNotification: boolean = false;

  @ViewChild('chatRoom') chatRoomEl: ElementRef;

  constructor(private socket: Socket, private route: ActivatedRoute, private router: Router) {
    this.route.paramMap.subscribe((params: ParamMap)=> {
      this.invitedTo = params.get('roomId');
    });

    this.systemUser = new User({
      name: 'System',
      system: true
    });

    this.socket.on('disconnect', () => {
      this.socketConnected = false;
    });

    this.socket.on('connect', () => {
      this.socketConnected = true;

      if (this.invitedTo) {
        this.lookingUpRoom = true;
        this.socket.emit('getInvitedRoom', {invitedTo: this.invitedTo});
      }
    });

    this.socket.on('setInvitedRoom', (room) => {
      console.log('ROOM', room);
      this.lookingUpRoom = false;
      this.roomName = room || '';

      if (this.roomName === '') {
        this.invitedTo = null;
      }
    });

    this.socket.on('connect_timeout', () => {
      this.socketConnected = false;
      this.connectFailed = true;
    });

    this.socket.on('reconnect', () => {
      this.socketConnected = true;
    });

    this.socket.on('reconnect_error', () => {
      this.socketConnected = false;
      this.connectFailed = true;
    });

    this.socket.on('reconnect_failed', () => {
      this.socketConnected = false;
      this.connectFailed = true;
    });

    this.socket.on('locked', () => {
      this.locked = true;
      this.locking = false;
      this.lockIcon = lockedIcon;
      clearTimeout(this.lockTimeout);
    });

    this.socket.on('unlocked', () => {
      this.locked = false;
      this.locking = false;
      this.lockIcon = unlockedIcon;
      clearTimeout(this.lockTimeout);
    });

    this.socket.on('login', () => {
      const pwd = this.makePassword();

      this.getPgpKey(pwd, async (key: any) => {
        if (!key) {
          alert('Security failed. Sorry!');
          this.loggingIn = false;
          return;
        }

        this.privKey = (await openpgp.key.readArmored(key.privateKeyArmored)).keys[0];

        this._me = new User({
          pubKey: key.publicKeyArmored,
          name: this.nickname
        });

        await this.privKey.decrypt(pwd);

        this.socket.emit('login', {
          user: this._me,
          room: this.roomName,
          invitedTo: this.invitedTo
        });

        this.nickname = '';
        this.roomName = '';
      });
    })

    this.socket.on('loggedin', ({room, user}) => {
      if (this.connected) {
        return;
      }

      this.loggingIn = false;
      this.connected = true;
      this.me = Object.assign({}, this._me);
      this._me = null;
      this.me.id = user.id;
      this.me.name = user.name;

      const msg = new Message();
      msg.from = this.systemUser;
      msg.message = `Welcome, ${user.name}`;
      this.messages.push(msg);


      this.scrollToBottom();

      this.setMembers(room.members);
      this.roomName = room.name;
      this.roomId = room.id;
      this.locked = room.locked;
      this.lockIcon = this.locked ? lockedIcon : unlockedIcon;
    });

    this.socket.on('room.locked', () => {
      this.loggingIn = false;
      this.roomName = '';
      setTimeout(() => {
        alert('This room is locked!\n\nYou may only join by invitation.');
      });
    });

    this.socket.on('chat.message', async (msg: any) => {
      if (!this.connected) {
        return;
      }

      let sameMessages = this.messages.filter((m) => {
        return m.date == msg.date;
      });

      if (sameMessages.length > 0) {
        for (let i = 0; i < sameMessages.length; i++) {
          sameMessages[i].delivered = true;
        }
        return;
      }

      msg.type = 'incoming';

      let pubKeys = await (openpgp.key.readArmored(msg.from.pubKey)).keys;

      let decryptOptions = {
        message: await openpgp.message.readArmored(msg.message),
        publicKeys: pubKeys,
        privateKeys: [this.privKey],
      };

      openpgp.decrypt(decryptOptions).then(async (decrypted: any) => {
        msg.message = decrypted.data;
        this.messages.push(msg);
        this.scrollToBottom();

        if (this.notify && document.hidden) {
          new Notification(`New message received from ${msg.from.name}`);
        }
      }, (error: any) => {
        console.log('decryption error', error);
      });
    });

    this.socket.on('members.updated', (members: Array<any>) => {
      if (!this.connected) {
        return;
      }

      this.setMembers(members);
    });

    this.socket.on('joined', (member: any) => {
      var m = new Message();
      m.date = new Date().getTime();
      m.message = `${member.name} joined`;
      m.type = 'incoming';
      m.from = this.systemUser;
      this.messages.push(m);
      this.scrollToBottom();
    });

    this.socket.on('departed', (member: any) => {
      var m = new Message();
      m.date = new Date().getTime();
      m.message = `${member.name} departed`;
      m.type = 'incoming';
      m.from = this.systemUser;
      this.messages.push(m);
      this.scrollToBottom();
    });

    document.addEventListener('visibilitychange', () => {
      if (!this.connected) {
        return;
      }

      if (document.hidden) {
        this.socket.emit('inactive', this.me.id);
      } else {
        this.socket.emit('active', this.me.id);
      }
    });

    openpgp.config.aead_protect = true;

    openpgp.initWorker({
      path: 'openpgp.worker.min.js'
    });

    this.initNotifications();
  }

  setMembers(members) {
    this.members = members.map((m) => {
      if (m.id == this.me.id) {
        m.me = true;
      }
      return new User(m);
    }).filter(m => m);
  }

  initNotifications() {
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      this.notify = true;
    } else {
      Notification.requestPermission().then((p) => {
        if(p === 'granted') {
          this.notify = true;
        }
      });
    }
  }

  makePassword() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 30; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
  }

  async getPgpKey(password, cb: any) {
    let genKeyOptions = {
      userIds: [{
        name: this.nickname,
        email: this.nickname.replace(/[^\w]/, '-') + '@encrypted-chat.dev',
      }],
      numBits: 4096,
      passphrase: password
    };

    openpgp.generateKey(genKeyOptions).then((key: any) => {
      cb(key);
    }, (error: any) => {
      cb(false);
    });
  }

  login(e: Event) {
    e.stopPropagation();

    if (this.nickname === '' || this.roomName === '') {
      return;
    }

    if (this.nickname.toLowerCase() === 'system') {
      alert('Invalid name');
      return;
    }

    this.loggingIn = true;

    this.socket.emit('checkRoom', {room: this.roomName, invitedTo: this.invitedTo});
  }

  scrollToBottom() {
    requestAnimationFrame(function () {
      document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
    });
  }

  sendMessage() {
    if (this.newMessage === '') {
      return;
    }

    let m = new Message();

    m.date = new Date().getTime();
    m.type = 'outgoing';
    m.from = this.me;
    m.message = this.newMessage.slice(0, 1024);

    let encryptedMsg = Object.assign({}, m);

    this.newMessage = '';

    requestAnimationFrame(() => {
      this.messages.push(m);

      this.scrollToBottom();

      let pubKeys = this.members.map(async (member) => {
        return (await openpgp.key.readArmored(member.pubKey)).keys[0];
      });

      Promise.all(pubKeys).then((keys: any) => {
        if (keys.length === 0) {
          return;
        }

        let encryptOptions = {
          message: openpgp.message.fromText(encryptedMsg.message),
          publicKeys: keys,
          privateKeys: [this.privKey],
        };

        openpgp.encrypt(encryptOptions).then((encrypted: any) => {
          encryptedMsg.message = encrypted.data;
          this.socket.emit('send.message', encryptedMsg);
        }, (error: any) => {
          console.log('encryption error', error);
        });
      });
    });

  }

  sendTypingNotification(e: any) {
    if (this.sendingNotification) {
      return;
    }

    let keycode = e.keyCode;

    let sendNotification =
      (keycode > 47 && keycode < 58) || // number keys
      keycode == 32 || // spacebar
      (keycode > 64 && keycode < 91) || // letter keys
      (keycode > 95 && keycode < 112) || // numpad keys
      (keycode > 185 && keycode < 193) || // ;=,-./` (in order)
      (keycode > 218 && keycode < 223);   // [\]' (in order)

    if (!sendNotification || keycode === 13) {
      return;
    }

    setTimeout(() => {
      this.socket.emit('typing', this.me.id);
      this.sendingNotification = false;
    }, 500);

    this.sendingNotification = true;
  }

  lock() {
    this.socket.emit('lock');
  }

  unlock() {
    this.socket.emit('unlock');
  }

  toggleLocked() {
    if(this.locking) {
      return;
    }

    this.locking = true;
    this.lockIcon = 'sync';

    clearTimeout(this.lockTimeout);
    this.lockTimeout = setTimeout(() => {
      this.locking = false;
      this.locked = false;
      this.lockIcon = unlockedIcon;
    }, 10000);

    if (this.locked) {
      this.unlock();
    } else {
      this.lock();
    }
  }

  copyLink() {
    this.copying = true;
    const inviteId = uuid();
    const el = document.createElement('textarea');
    el.value = document.location.toString() + 'chat/' + inviteId;

    console.log('val', el.value);

    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';

    document.body.appendChild(el);

    el.select();

    document.execCommand('copy');
    document.body.removeChild(el);

    this.socket.emit('addInvite', inviteId, () => {
      this.copying = false;

      setTimeout(() => {
        alert('Invitation link copied!');
      });
    });
  }
}
