# Encrypted Chat

![Screenshot](https://raw.githubusercontent.com/plan8studios/encrypted-chat/master/screenshot.png)

This is an encrypted chat web app. You can set your name and the room where you want to chat. No account to create, no privileges to worry about, no passwords to remember, no data stored on the server or in the browser, no file uploads, nothing fancy. Just plain text chat.

## You wanna try it out? Try it out!
[Check out the demo!](https://cup.plan8home.com:3000/)

## Features
* Messages are encrypted and decrypted in the browser with [OpenPGP.js](https://github.com/openpgpjs/openpgpjs). The chat server _only sees encrypted messages_, and it doesn't store anything* on the server.
  * > ###### *So, there _is_ a log file - `server.log` - but it's not storing anything useful. Just check out the [server startup script](start-server.sh) to see how the server is started and the check out [chat server code](src/server/index.js) and you can see what's getting logged by searching for instances of `console.log`.

* Chat happens over [Socket.IO](https://socket.io/) so it should be pretty snappy and widely compatible.

* Messages disappear as soon as you close or refresh the browser/tab.

* Mobile friendly. It might be a little slow on older devices (PGP stuff is **expensive**) but it should work.

* Desktop notifications. If you've got the chat tab in the background, and your browser and OS support it, you'll get a desktop notification whenever a new message arrives.

## Built With

* [Angular 7](https://angular.io)
* [Socket.IO](https://socket.io)
* [OpenPGP.js](https://github.com/openpgpjs/openpgpjs)
* [NoSleep.js](https://github.com/richtr/NoSleep.js?files=1) (I still don't have this working)

# Installation

Obviously, you'll need to clone this repo before you do anything below. Once you've done that...

## Install Packages

Install the npm packages described in the `package.json` and verify that it works:

```shell
npm install
```

## Install SSL Certs

Add SSL cert and key (name them `server.crt` and `server.key`) files into the `src/server` directory. How you obtain these is up to you, but I recommend [Let's Encrypt](https://letsencrypt.org/).

## Configure Enviornment

Update `src/environment/environment*.ts` files and set the `socketUrl` property to the URL where the SocketIO server will live. This will most likely be on the same server as the frontend on port 4000.

## Build

Generate a prod build with the following command:

```shell
npm run build
```

If you want a prod build with the`--aot` flags, you can run:

```shell
npm run build-aot
```

If you just wanna play around with the code, fire up the old angular server:

```shell
npm run start
```

## Finally, start the SocketIO server.
Start the server with...
```shell
start-server.sh
```

## That's it!!
Now you can start using your own self-hosted PGP encrypted chat. Just go to the address where you set it up (https://server-address-here:3000) and you should be chatting in no time!

# To Do

- [x] Router
- [x] Lock rooms
- [x] Copy link for room invite
- [x] Desktop Notifications
- [ ] PWA/Save to home screen/whatever. Obviously this can't work without internet.


# Why

I made this because I wanted to play with OpenPGP, and I thought this could be a fun and useful project. I was inspired to create this after signing up for [Proton Mail](https://protonmail.com/) and seeing how they encrypt/decrypt your email messages.
