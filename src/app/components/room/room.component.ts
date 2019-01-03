import { Component, ViewChild, ElementRef, Injectable } from '@angular/core';
//import { Component, NgZone, ViewChild, ElementRef } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { Message } from '../../models/message';
import { User } from '../../models/user';

var openpgp = require('openpgp');

declare var io: any;
declare var openpgp: any;
declare function escape(s: string): string;
declare function unescape(s: string): string;

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
      m.text = `Welcome, ${this.me.name}`;

      this.messages.push(m);
      this.scrollToBottom();
    });

    this.socket.on('chat.message', (msg: any) => {
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

      let decryptOptions = {
        message: openpgp.message.readArmored(msg.text),
        privateKey: this.privKey,
        publicKeys: openpgp.key.readArmored(msg.from.pubKey).keys,
        format: 'binary'
      };

      openpgp.decrypt(decryptOptions).then((decrypted: any) => {
        msg.text = this.uintToString(decrypted.data);
        //this._ngZone.run(() => {
          this.messages.push(msg);
          this.scrollToBottom();
        //});

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
      m.text = `${member.name} joined`;
      m.type = 'incoming';
      m.from = this.systemUser;
      this.messages.push(m);
      this.scrollToBottom();
    });

    this.socket.on('departed', (member: any) => {
      var m = new Message();
      m.date = new Date().getTime();
      m.text = `${member.name} departed`;
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

    openpgp.initWorker({
      path: 'openpgp.worker.min.js'
    });
    openpgp.config.aead_protect = true;
    /*
    var pgp = document.createElement('script');
    pgp.src = "node_modules/openpgp/dist/openpgp.min.js";
    document.getElementsByTagName('head')[0].appendChild(pgp);
    pgp.onload = () => {
      openpgp.initWorker({
        path: '/node_modules/openpgp/dist/openpgp.worker.min.js'
      });
      openpgp.config.aead_protect = true;
    };
    */
  }

  stringToUint(string: string) {
    var string = btoa(unescape(encodeURIComponent(string))),
      charList = string.split(''),
      uintArray = [];
    for (var i = 0; i < charList.length; i++) {
      uintArray.push(charList[i].charCodeAt(0));
    }
    return new Uint8Array(uintArray);
  }

  uintToString(uintArray: any) {
    var encodedString = String.fromCharCode.apply(null, uintArray),
      decodedString = decodeURIComponent(escape(atob(encodedString)));
    return decodedString;
  }

  makePassword() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 30; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
  }

  async getPgpKey(cb: any) {
    let key = {};
    let storeKey = 'pgp' + this.roomName + this.nickname;
    let cookieKey = sessionStorage.getItem(storeKey);
    console.log('getting key');
    if (cookieKey) {
      let decryptOptions = {
        message: await openpgp.message.readArmored(cookieKey),
        password: this.password
      };

      openpgp.decrypt(decryptOptions).then((decrypted: any) => {
        cb(JSON.parse(decrypted.data));
      });
      return;
    }

    let genKeyOptions = {
      userIds: [{ name: this.nickname, email: this.nickname.replace(/[^\w]/, '-') + '@encrypted-chat.dev' }],
      numBits: 4096
    };

    let component = this;

    this.generatingKey = true;

    //console.log('generating key');

    openpgp.generateKey(genKeyOptions).then((key: any) => {
      component.generatingKey = false;
      let encryptOptions = {
        message: openpgp.message.fromText(JSON.stringify(key)),
        passwords: [component.password]
      };

      //console.log('encrypting key');
      openpgp.encrypt(encryptOptions).then((encrypted: any) => {
        sessionStorage.setItem(storeKey, encrypted.data);
        cb(key);
      }, (error: any) => {
        cb(false);
      });
    }, (error: any) => {
    });
  }

  login(e: Event) {
    e.stopPropagation();
    this.password = this.makePassword();

    if (this.nickname === '' || this.roomName === '' || this.password === '') {
      return;
    }

    if (this.nickname.toLowerCase() === 'system') {
      alert('Invalid name');
      return;
    }

    this.getPgpKey(async (key: any) => {
      if (!key) {
        alert('Security failed. Sorry!');
        return;
      }

      this.me = new User({
        pubKey: key.publicKeyArmored,
        name: this.nickname
      });

      //console.log('k', openpgp.key.readArmored(key.privateKeyArmored));

      this.privKey = (await openpgp.key.readArmored(key.privateKeyArmored)).keys[0];

      console.log('pk', this.privKey);

      this.socket.emit('login', {
        user: this.me,
        room: this.roomName
      });

      this.nickname = '';
    });
  }

  scrollToBottom() {
    setTimeout(function () {
      document.body.scrollTop = document.body.scrollHeight;
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
    m.text = this.newMessage;

    let encryptedMsg = Object.assign({}, m);

    this.messages.push(m);

    this.scrollToBottom();

    this.newMessage = '';

    let pubKeys: any = [];
    this.members.map((m) => {
      if (m.id != this.me.id) {
        pubKeys = pubKeys.concat(openpgp.key.readArmored(m.pubKey).keys)
      }
    });

    if (pubKeys.length === 0) {
      return;
    }

    let encryptOptions = {
      data: this.stringToUint(encryptedMsg.text),
      publicKeys: pubKeys,
      privateKey: this.privKey,
    };

    openpgp.encrypt(encryptOptions).then((encrypted: any) => {
      encryptedMsg.text = encrypted.data;
      this.socket.emit('chat.message', encryptedMsg);
    }, (error: any) => {
      console.log('encryption error', error);
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
