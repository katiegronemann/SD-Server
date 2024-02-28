//"Stick D00dz" API server code. This project has been sunset. 
//This program handles a myriad of API calls to a Bitcoin wallet called "Handcash" that works with a framework called "AssetLayer" as well as a MongoDB server.
//Written by Katie Gronemann (Honda) with love

//Requirements
require('dotenv').config();
var fs = require('fs');
const request = require('request');
var ObjectId = require('mongodb').ObjectId; 
//I made this module to test my abilities & also have random and sometimes interesting data sent to the frontend to test connection.
const myBible = require('./mymodules/bible');
const bible = new myBible();

//this is just a little trick with NodeJS, if the process encounters an uncaught error you just catch it and keep it running. 
//PM2 would log errors for me in the console so this was legit enough for my liking.
process.on('uncaughtException', function (err) {
  console.error(err);
  console.log("Node NOT Exiting...");
});

//base64 helper method for encoding local file to base64 for minting
function base64_encode(file) {
  return "data:image/png;base64,"+fs.readFileSync(file, 'base64');
}
/* 
This is a long story. 
In my time, I minted an NFT series on a website called "RelayX" which ran on Bitcoin SV. 
They were the "Stick D00dz" for which this project is centered around.
This method takes a "locationid" which is a Transaction ID that relates to a specific NFT,
then, it leverages a Python script to read data I encoded into the original PNG files.
In these images I store a some json data that defines the character's attributes. 

This was a nifty trick I had when I first created the Stick D00dz but I never really got to leverage it.
At the time this project was active, I was in the process of converting the originals from RelayX to this new HandCash Wallet based framework "AssetLayer"
This functionality never truly was achieved due to lack of public interest.
*/
async function getDoodInfo(locationid){
console.log(`Running Python to get information for DOOD at location: ${locationid}`);
const spawn = require("child_process").spawn;
const python = spawn('python', ['./mymodules/doodreader.py', locationid]);
python.stdout.on('data', function (data) {
  //console.log('Pipe data from python script ...');
  console.log(data.toString());
 });
 python.stderr.on('data', (data) => {
  console.error('stderr: ', data.toString('utf8'));
})
 python.on('close', (code) => {
  console.log(`child process close all stdio with code ${code}`);
  // send data to browser
  //res.send(dataToSend)
  });
}


//None of this is particularly sensitive, this is all hard coded because I didn't expect it to change. 
//This is mostly for debug purposes but it does initialize Socket, HTTPS, and MongoDB
const debugflag = process.env.debug;
const HOST = '0.0.0.0'; 
const PORT = 3006;
const appID = "6379398069849d5fb005bbce";
var options = {
  key: fs.readFileSync('cred/key2.pem'),
  cert: fs.readFileSync('cred/rejekt_biz.crt'),
  ca: fs.readFileSync('cred/rejekt_biz.ca-bundle'),
  //passphrase: process.env.passphrase
};
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.mongouri;
const express = require("express"),
    app = express(),
    https = require("https").Server(options, app),
    http = require("http").Server(app);
    //http, 

//Setting cors policy specifically for testing local vs prod environment. Debugflag is inherited from process.env
if(debugflag==="true"){io = require("socket.io")(http, { cors: { origin: '*' }, pingInterval: 2000, pingTimeout: 5000})}
else{io = require("socket.io")(https, { cors: { origin: 'https://stickdoodz.net' }, pingInterval: 2000, pingTimeout: 5000});}



//This leverages the HandCash node plugin to connect to HandCash based wallets.
const {HandCashConnect} = require('@handcash/handcash-connect');
//const { debug } = require('console');
const handCashConnect = new HandCashConnect({ 
    appId: process.env.hcappid, 
    appSecret: process.env.hcsecret,
});

//this is our login function, the user logs in on the front end and is returned to our webapp with a key they have passed here.
async function getHandCashProfile(socket,arg){
  const account = handCashConnect.getAccountFromAuthToken(arg);
  
  //handle is a username, this resolves to an address via handcash
  var handle;
  const program = await account.profile.getCurrentProfile().then(value => {
    const {publicProfile, privateProfile} = value;
    //console.log(publicProfile.handle);
    handle = publicProfile.handle;
    socket.emit("rHCP",[JSON.stringify(publicProfile)]);
    
  });
  //run scripts to see if this is a new user, then get any information we may have on them
  await checkUserInDB(handle,arg).catch(console.error);
  await getUserInfoDB(handle,socket).catch(console.error);
}



//This function exists to distribute NFTs within a certain range to an address provided in "arg"
async function newUserMint(arg){
  var nftToSend = "";
  var admin = "stickdoodz";
  var options = {
    'method': 'GET',
    'url': 'https://api.assetlayer.com/api/v1/nft/collection',
    'headers': {
      'appsecret': process.env.appsecret,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      "collectionId": "63794a9b69849dac1605bef4", //63793fda69849de94a05bd34 = testcollection4 63794a9b69849dac1605bef4 == End of Stickvangelion
      "idOnly": false,
      "serials": "80-99",
      "handle": admin
    })
  
  };
  //This API call to AssetLayer moves the NFT from one wallet to another
  request(options, function (error, response) {
    if (error) throw new Error(error);
    try{
		console.log((response.body).body);
    nftToSend = JSON.parse(response.body).body.nfts[0].nftId;
	console.log(`I am going to send ${JSON.stringify(nftToSend)} to ${arg}`);
    sendNFTtoUser(nftToSend, admin, arg);
    }catch(error){console.log("bin empty")}
    
  });
}

//This method checks our MongoDB to see if a logged in user is new, and enters them if so.
async function checkUserInDB(arg, authkey){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  try {
    
    const database = client.db('StickDoodzDB');
    const users = database.collection('StickCollection');
    const query = { user: arg } ;//, authkey: authkey };

    const res = await users.findOne(query).catch(console.error);
    
    if(res === null){
      console.log("New User!");
      await users.insertOne(query).catch(console.error);
      await newUserMint(arg);
    }else{

    }
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

//This function is called specifically when a user views their profile after linking RelayX and updates their DB entry to reflect their total holdings of "Stick D00dz"
async function updateUserDoodz(arg){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  try {
    
    const database = client.db('StickDoodzDB');
    const users = database.collection('StickCollection');
    const query = { user: arg[0] } ;//, authkey: authkey };

    const res = await users.findOne(query).catch(console.error);
    //console.log(res);
    
    if(res === null){
      console.log("not found");

    }else{
      await users.updateOne({user: arg[0]}, {$set:{doodz: arg[1]}}).catch(console.error)
    }

  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

//This is similar to above but it is called only the when the user links their RelayX account to update the userID
async function updateUserRelay(arg){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  try {
    
    const database = client.db('StickDoodzDB');
    const users = database.collection('StickCollection');
    const query = { user: arg[0] } ;//, authkey: authkey };

    const res = await users.findOne(query).catch(console.error);
    //console.log(res);
    
    if(res === null){
      console.log("not found");

    }else{
      await users.updateOne({user: arg[0]}, {$set:{relay: arg[1]}}).catch(console.error)
    }

  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

//This function is called when the user updates their profile picture. 
//We allow a few sources: which may be from RelayX or HandCash NFTs.
async function updateUserPFP(arg){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  try {
    //0 handle, 1 source, 2 url, 3 tier
    //tier is used to determine border on the frontend
    const database = client.db('StickDoodzDB');
    const users = database.collection('StickCollection');
    const query = { user: arg[0] } ;//, authkey: authkey };

    const res = await users.findOne(query).catch(console.error);
    //console.log(res);
    
    if(res === null){
      console.log("not found");

    }else{
      await users.updateOne({user: arg[0]}, {$set:{pfpsrc: arg[1]}}).catch(console.error)
      await users.updateOne({user: arg[0]}, {$set:{pfpurl: arg[2]}}).catch(console.error)
      await users.updateOne({user: arg[0]}, {$set:{pfpter: arg[3]}}).catch(console.error)
    }

  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

//This function returns the recent chatlog, which is called when the users are chatting.
async function sendChatlog(arg,socket){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  try {
    //0 handle, 1 source, 2 url, 3 tier
    const database = client.db('StickDoodzDB');
    const chat = database.collection('StickChat');
    const users = database.collection('StickCollection');
    const time = Date.now();
    const date = new Date(time);
    var hours = 240;
    //console.log(time);
    const query = {posted:{"$gt": time-(hours*3600000) }} ;//, authkey: authkey };


    await chat.find(query).toArray(function(err, result) {
      if (err) {socket.emit("chatlog",["Loading Chat..."])};
      //console.log(result);
      socket.emit("chatlog",result);
      client.close();
    });
    
  } finally {
    // Ensures that the client will close when you finish/error
    //client.close();
    //await client.close();
  }
}

//This function keeps track of users tipping one another with "Dood Token" which is an altcoin I minted on Bitcoin SV as part of this project.
//This is built into the chat window, this simply tracks tips given and is not a transaction given. That part is performed on front end VIA RelayX integration.
async function tipChat(arg){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  try {
    //0 handle, 1 source, 2 url, 3 tier
    const database = client.db('StickDoodzDB');
    const chat = database.collection('StickChat');
    const query = {_id: ObjectId(arg[0])} ;
    console.log(arg)
    const res = await chat.findOne(query).catch(console.error);
    //console.log(res);
    var tmp=arg[1]
    if(res === null){
      console.log("not found");

    }else{
      if((typeof res.tips !== 'undefined' && res.tips !== null)){
      tmp = res.tips + arg[1]
      }

      await chat.updateOne(query, {$set:{tips: tmp}}).catch(console.error)
      
    }

  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

//This simply puts incoming chat messages into the log
async function addChat(arg, socket){
  //console.log("Handle: "+arg[0] +" Doodsum: "+ arg[1]+ " Message: "+arg[4]);
  const time = Date.now();
  const date = new Date(time);
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  if((arg[4]!==null) && arg[4]!==""){
    try {
      //0 handle, 1 source, 2 url, 3 tier
      const database = client.db('StickDoodzDB');
      const chats = database.collection('StickChat');
      //const query = { user: arg[0] } ;//, authkey: authkey };
      //const res = await users.findOne(query).catch(console.error);
      //console.log(res);
    
        await chats.insertOne({
          posted: Date.now(),
          date: date.toUTCString(),
          handle: arg[0],
          doodz: arg[1],
          pfp: arg[2],
          tier: arg[3],
          message: arg[4],
          rx: arg[5]

        })
        socket.broadcast.emit("newchat",(Date.now()));
      

    } finally {
      // Ensures that the client will close when you finish/error
      await client.close();
    }
}else{
  console.log("Blank Message Discarded")
  await client.close();
}
}


//this method pulls user information from the DB
async function getUserInfoDB(arg,socket){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  var rrelay;
  var rdoodz;
  var rpfpsrc;
  var rpfpurl;
  var rpfpter;

  try {
    
    const database = client.db('StickDoodzDB');
    const users = database.collection('StickCollection');
    const query = { user: arg } ;//, authkey: authkey };

    const res = await users.findOne(query).catch(console.error);
    //console.log(res);
    
    if(res === null){
      console.log("not found");

    }else{
      if(res.relay){rrelay = res.relay}else{rrelay=""}
      if((typeof res.doodz !== 'undefined')){rdoodz = res.doodz}else{rdoodz=""}
      if((typeof res.pfpsrc !== 'undefined')){rpfpsrc = res.pfpsrc}else{rpfpsrc=""}
      if((typeof res.pfpurl !== 'undefined')){rpfpurl = res.pfpurl}else{rpfpurl=""}
      if((typeof res.pfpter !== 'undefined')){rpfpter = res.pfpter}else{rpfpter=""}
      socket.emit("dbinfo",[rrelay, rdoodz, rpfpsrc, rpfpurl, rpfpter]);
    }

  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

//This function simply sends an NFT from one user to another by ID
async function sendNFTtoUser(nftId, sender, recepient){
  console.log(`Sending ${nftId} from ${sender} to ${recepient}`);
  var options = {
    'method': 'POST',
    'url': 'https://api.assetlayer.com/api/v1/nft/send',
    'headers': {
      'appsecret': process.env.appsecret,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      "nftId": nftId,
      "handle": sender,
      "recipientHandle": recepient
    })
  
  };
  request(options, function (error, response) {
    if (error) throw new Error(error);
    console.log(response.body);
  });
  
}



//This main function does the regular loop
async function main(){

//getDoodInfo('91f72c8c874615cf2d0543fd967c6035f3f6bdf5d0aca0d2f28af6909d3c1686_o1');

//This handles Socket connections with users
io.on("connection", socket => {
  //console.log(`New connection ${socket.id}`);//\n${bible.greet()}`);
  //console.log(JSON.stringify(bible.greet()));
  
  //Our sample data that announces the connection is live
  socket.on("gmotd", () => {
    socket.emit("motd", bible.greet());
  })
  

  //test function
  socket.on("test", (arg) => {
    console.log(arg);
    socket.emit("test","Received Test Message: "+arg);
  })

  //user requested users total Dood holdings be updated
  socket.on("doodsum", (arg) => {
    //console.log(arg[0] +"  "+ arg[1]);
    updateUserDoodz(arg).catch(console.error);
  })
  
  //user requested users relayx be updated
  socket.on("userrelay", (arg) => {
    //console.log(arg[0] +"  "+ arg[1]);
    updateUserRelay(arg).catch(console.error);
  })

  //user requested users PFP be updated
  socket.on("setPFP", (arg) => {
    //console.log(arg[0] +"  "+ arg[1]);
    updateUserPFP(arg).catch(console.error);
    //getUserInfoDB(arg[0],socket)
  })

  //new message for the chat
  socket.on("chatmessage", (arg) => {
    
    addChat(arg, socket);
  })
  //requesting a fresh chatlog
  socket.on("getchats", (arg) => {
    sendChatlog(arg,socket);
  })

  //check profile information for a user
  socket.on("getuserinfo", (arg) => {
    getUserInfoDB(arg,socket);
  })

  //handles recording tips in the chat
  socket.on("tipchat", (arg) => {
    tipChat(arg);
  })


  //The user requested information for a particular AssetLayer collection
  socket.on("gCI", (arg) => {
    console.log("Getting Info For COLLECTION: " + arg);
    var options = {
      'method': 'GET',
      'url': 'https://api.assetlayer.com/api/v1/collection/info',
      'headers': {
        'appsecret': process.env.appsecret,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "collectionId": arg
      })
    };
    request(options, function (error, response) {
      if (error) throw new Error(error);
      
      var message = {'body':response.body};
      //console.log(message);
      socket.emit("rCI",JSON.stringify(message));
    });
  })

  //This function requests all the user's NFT information
  socket.on("gNFTs", (arg) => {
    console.log("Getting NFTs for HANDLE: " + arg);
    var options = {
      'method': 'GET',
      'url': 'https://api.assetlayer.com/api/v1/nft/user',
      'timeout': 1200000,
      'headers': {
        'appsecret': process.env.appsecret,
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      body: JSON.stringify({
        //"slotId": "63793d0569849dcee305bc2f",
        "handle": arg,
        "idOnly": false
        //"countsOnly": false
        
      })
    
    };
   

    //attempt to send it to frontend
    try{
    request(options, function (error, response){//error, response) {
      if (error) {(console.error(error))}else{
      //console.log(response.body);
      var message = {'body':response.body};
      socket.emit("rNFTs",JSON.stringify(message));
      }
      
      //console.log(message);
      
    });
  } finally {

  }
  })

  //AssetLayer separates NFT collections into "slots" for handling different use cases, this just returns NFTs by slot ID
  socket.on("gNFTsInSlot", (arg) => {
    console.log("Getting NFTs for HANDLE: " + arg[0] + " in slot " + arg[1]);
    var options = {
      'method': 'GET',
      'url': 'https://api.assetlayer.com/api/v1/nft/slot',
      'timeout': 1200000,
      'headers': {
        'appsecret': process.env.appsecret,
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      body: JSON.stringify({
        "slotId": arg[1],
        "handle": arg[0],
        "idOnly": false,
        "countsOnly": false
        
      })
    
    };
   

    try{
    request(options, function (error, response){//error, response) {
      if (error) {(console.error(error))}else{
      //console.log(response.body);
      var message = {'body':response.body};
      socket.emit("rNFTs",JSON.stringify(message));
      }
      
      //console.log(message);
      
    });
  } finally {

  }
  })


  //This gets the public handcash profile for a particular authtoken received when the user logs into our application
  socket.on("gHCP", (arg) => {
    console.log("Getting Info For HC User With AuthToken: " + arg);
    
    getHandCashProfile(socket,arg).catch(console.error);
      //;

  })


  //handle user leaving
  socket.on('close', (data) => {
    console.log('CLOSED: ' +`\n${data}`);
});

})


//this starts the Socket listener, if we are on debug- socket is configured to use insecure HTTP
if(debugflag==="true"){
  http.listen(PORT+1, () => {
    console.log("Started on HTTP!")
  })
}else{
  https.listen(PORT, () => {
    console.log("Started!")
  })
}



}
main().catch(console.error);

