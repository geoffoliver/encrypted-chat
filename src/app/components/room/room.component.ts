import { Component, ViewChild, ElementRef, Injectable } from '@angular/core';

import { Socket } from 'ngx-socket-io';
import NoSleep from 'nosleep.js';

import { Message } from '../../models/message';
import { User } from '../../models/user';

var openpgp = require('openpgp');

declare var openpgp: any;

const noSleep = new NoSleep();

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
  generatingKey: boolean = false;

  messages: Message[] = [];
  newMessage: string = '';

  roomName: string = '';
  nickname: string = '';
  password: string = '';
  members: User[] = [];

  me: User;
  systemUser: User;

  connected: boolean = false;
  notify: boolean = false;
  privKey: any = {};
  socketConnected: boolean = false;
  connectFailed: boolean = false;

  @ViewChild('chatRoom') chatRoomEl: ElementRef;

  constructor(private socket: Socket) {
    this.systemUser = new User({
      name: 'System',
      system: true
    });

    this.socket.on('connect', () => {
      this.socketConnected = true;
    });

    this.socket.on('disconnect', () => {
      this.socketConnected = false;
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

    this.socket.on('loggedin', (loggedInUser: any) => {
      if (this.connected) {
        return;
      }
      this.connected = true;
      this.me.id = loggedInUser.id;

      let m = new Message();
      m.date = new Date().getTime();
      m.type = 'incoming';
      m.from = this.systemUser;
      m.message = `Welcome, ${this.me.name}`;

      this.messages.push(m);
      this.scrollToBottom();
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
      //this._ngZone.run(() => {
        this.members = members.map((m) => {
          if (m.id == this.me.id) {
            m.me = true;
          }
          return new User(m);
        }).filter((m) => {
          return m;
        });
      //});
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

    this.socket.on('room.locked', () => {
      if (!this.connected) {
        return;
      }
      alert('Room is locked!');
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

    let component = this;

    this.generatingKey = true;

    openpgp.generateKey(genKeyOptions).then((key: any) => {
      component.generatingKey = false;
      cb(key);
    }, (error: any) => {
      cb(false);
    });
  }

  login(e: Event) {
    noSleep.enable();

    e.stopPropagation();

    if (this.nickname === '' || this.roomName === '') {
      return;
    }

    if (this.nickname.toLowerCase() === 'system') {
      alert('Invalid name');
      return;
    }

    this.password = this.makePassword();

    this.getPgpKey(this.password, async (key: any) => {
      if (!key) {
        alert('Security failed. Sorry!');
        return;
      }

      this.me = new User({
        pubKey: key.publicKeyArmored,
        name: this.nickname
      });

      this.privKey = (await openpgp.key.readArmored(key.privateKeyArmored)).keys[0];

      await this.privKey.decrypt(this.password);

      this.socket.emit('login', {
        user: this.me,
        room: this.roomName
      });

      this.nickname = '';
    });
  }

  scrollToBottom() {
    setTimeout(function () {
      document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
    }, 0);
  }

  sendMessage() {
    if (this.newMessage === '') {
      return;
    }

    let m = new Message();

    m.date = new Date().getTime();
    m.type = 'outgoing';
    m.from = this.me;
    m.message = this.newMessage;

    let encryptedMsg = Object.assign({}, m);

    this.newMessage = '';

    this.messages.push(m);

    this.scrollToBottom();

    setTimeout(() => {
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
    let keycode = e.keyCode;
    let sendNotification =
      (keycode > 47 && keycode < 58) || // number keys
      keycode == 32 || keycode == 13 || // spacebar & return key(s) (if you want to allow carriage returns)
      (keycode > 64 && keycode < 91) || // letter keys
      (keycode > 95 && keycode < 112) || // numpad keys
      (keycode > 185 && keycode < 193) || // ;=,-./` (in order)
      (keycode > 218 && keycode < 223);   // [\]' (in order)

    if (!sendNotification) {
      return;
    }

    this.socket.emit('typing', this.me.id);
  }

  lock() {
    this.socket.emit('lock');
  }

  unlock() {
    this.socket.emit('unlock');
  }
}
