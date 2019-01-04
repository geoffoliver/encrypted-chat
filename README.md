# Encrypted Chat
This is a web based encrypted chat created with the [Angular CLI](https://cli.angular.io/).

[View a demo](https://cup.plan8home.com:3000/)

## First, install the packages
Install the npm packages described in the `package.json` and verify that it works:

```shell
npm install
```

## Next, this...
Add SSL cert and key (.crt and .key) files into the `src/server` directory. After
that, you'll need build everything...

```shell
npm run build
```

## Finally, start the server
Start the server with...
```shell
start-server.sh
```

## That's it!!
Then go to http://server-address-here:3000

![Screenshot](https://raw.githubusercontent.com/plan8studios/encrypted-chat/master/screenshot.png)
