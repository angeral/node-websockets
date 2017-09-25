'use strict';

const express = require('express');
const SocketServer = require('ws').Server;
const path = require('path');

const PORT = process.env.PORT || 3000;
//const INDEX = path.join(__dirname, 'index.html');

const server = express()
	.listen(PORT, () => console.log(`Listening on ${ PORT }`));
//const server = express()
//  .use((req, res) => res.sendFile(INDEX) )
//  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const wss = new SocketServer({ server });

var connectList = {};
var clientList = [];
var targetList = [];
var todclientList = [];
var todtargetList = [];
var pktadapterList = [];
var pktmobileList = [];
var uuidList = [];
var uuidMax = 100;

var CKTWebService = {
    key: "66b78883f3fb4f2db31dc42fb7031e2b",
    host: "service1.insyde.com",
    setTargetStatus: "http://service1.insyde.com/CastKT/Service/CastKT.asmx/setTargetStatus",
    setTargetStatusWithMeetingInfo: "http://service1.insyde.com/CastKT/Service/CastKT.asmx/setTargetStatusWithMeetingInfo",
}
var ToDWebService = {
    key: "d8878a53616f4550b5c131185f398721",
    host: "service1.insyde.com",
    setTargetStatus: "http://service1.insyde.com/TodKanTan/Service/Tod.asmx/setTargetStatus",
}

function PostCode(obj, host, path) {
    // Build the post string from an object
    function jsonToQueryString(json) {
        return Object.keys(json).map(function (key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(json[key]);
        }).join('&');
    }
    var post_data = jsonToQueryString(obj)
    //console.log("post:", post_data);

    var post_options = {
        host: host,
        path: path,
        port: '',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(post_data)
        }
    };

    // Set up the request
    var post_req = require("http").request(post_options, function (res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            //console.log('Response: ' + chunk);
        });
    });

    // post the data
    post_req.write(post_data);
    post_req.end();
}

function GetPostdataForToD(id, TargetStatus) {
    return {
        Key: ToDWebService.key,
        TargetUUID: connectList[id].deviceuuid,
        TargetRoomId: connectList[id].roomid,
        TargetStatus: TargetStatus,
    };
}

function GetPostdata(id, TargetStatus) {
    return {
        Key: CKTWebService.key,
        TargetUUID: connectList[id].deviceuuid,
        TargetRoomId: connectList[id].roomid,
        TargetName: connectList[id].nickname,
        TargetStatus: TargetStatus,
        PingCode: connectList[id].pinCode,
        VersionNO: connectList[id].version,
        MeetingTitle: connectList[id].meetingtitle,
        MeetingPeriod: connectList[id].meetingperiod,
        MeetingAttendCount: connectList[id].attendcount,
    };
    console.log('GetPostdata:', id, connectList[id]);
}

function guid() {
    function n6() {
        return Math.floor((Math.random()) * 1000000).toString(10);
    }
    function padLeft(str, lenght) {
        if (str.length >= lenght)
            return str;
        else
            return padLeft("0" + str, lenght);
    }
    return padLeft(n6(), 6);
}

function originIsAllowed(origin) {
    // put logic here to detect whether the specified origin is allowed.
    return true;
}

function getTime() {
    var time = new Date();
    time.setHours(time.getHours());
    return time.getFullYear().toString() + '-'
        + (((time.getMonth() + 1).toString().length < 2) ? "0" + (time.getMonth() + 1).toString() : (time.getMonth() + 1).toString()) + "-"
        + (((time.getDate()).toString().length < 2) ? "0" + (time.getDate()).toString() : (time.getDate()).toString()) + " "
        + (((time.getHours()).toString().length < 2) ? "0" + (time.getHours()).toString() : (time.getHours()).toString()) + ":"
        + (((time.getMinutes()).toString().length < 2) ? "0" + (time.getMinutes()).toString() : (time.getMinutes()).toString()) + ":"
        + (((time.getSeconds()).toString().length < 2) ? "0" + (time.getSeconds()).toString() : (time.getSeconds()).toString());
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('close', () => console.log('Client disconnected'));

  var uuid = null
  while (!uuid) {
      var tmp = guid();
      if (uuidList.indexOf(tmp) < 0) {
          uuid = tmp;
      }
  }
  uuidList.push(uuid);

  ws.on('message', function incoming(message) {
      this.uuid = uuid;
      //connection = this;
      //connection.uuid = uuid;
      connectList[uuid] = {
          "connection": this,
          "deviceuuid": "",
          "nickname": "",
          "pinCode": "",
          "version": "",
          "meetingtitle": "",
          "meetingperiod": "",
          "attendcount": "",
      };
      //console.log('connectList[962281]:', connectList[962281]);
      try {
          var msg = JSON.parse(message);
          if (msg.command) {
              console.log('msg:', msg);
              switch (msg.command) {
                  case 'registerdevice':
                      //console.log('Receive registerdevice');
                      if (msg.message.devicetype === 'target' || msg.message.devicetype === 'tod-target') {
                          if (!msg.message.uuid) {
                              console.log("1wss user " + msg.message.devicetype + ":", this.uuid, "registerdevice type 1: no uuid info, use default uuid:", msg.message.uuid);
                          } else if (msg.message.uuid === this.uuid) {
                              console.log("2wss user " + msg.message.devicetype + ":", this.uuid, "registerdevice type 2: uuid info is equal to default uuid:", msg.message.uuid);
                          } else if (uuidList.indexOf(msg.message.uuid) >= 0 && connectList[msg.message.uuid].deviceuuid.length == 0) {
                              console.log("3wss user " + msg.message.devicetype + ":", this.uuid, "registerdevice type 3: uuid info is duplicateed, skip create new uuie:", msg.message.uuid);
                          } else if (uuidList.indexOf(msg.message.uuid) >= 0 && connectList[msg.message.uuid].deviceuuid.length >= 0) {
                              console.log("4wss user " + msg.message.devicetype + ":", this.uuid, "registerdevice type 4: device is reconnect and deviceuuid is the same, use old setting:", msg.message.uuid, msg.message.deviceuuid);
                              console.log("5wss uuid:", this.uuid, "change to", msg.message.uuid);
                              connectList[msg.message.uuid].connection.overwrite = true;
                              connectList[msg.message.uuid].connection = connectList[this.uuid].connection;
                              var index = uuidList.indexOf(this.uuid);
                              uuidList.splice(index, 1);
                              delete connectList[this.uuid];

                              //connectList[msg.message.uuid].connection.uuid = msg.message.uuid;
                              this.uuid = msg.message.uuid; //-> this.uuid is equal to connectList[msg.message.uuid].connection.uuid

                          } else {
                              console.log('6wss ' + "user " + msg.message.devicetype + ":", uuid, "registerdevice type 5: uuid info is not duplicateed, use self's own uuid:", msg.message.uuid);
                              console.log('7wss ' + "uuid:", this.uuid, "change to", msg.message.uuid);
                              connectList[msg.message.uuid] = connectList[this.uuid];
                              var index = uuidList.indexOf(uuid);
                              uuidList.splice(index, 1);
                              delete connectList[uuid];
                              this.uuid = msg.message.uuid;
                              uuidList.push(this.uuid);
                          }

                          connectList[this.uuid].deviceuuid = msg.message.deviceuuid;
                          connectList[this.uuid].roomid = this.uuid;
                          if (msg.message.devicetype === 'target' && targetList.indexOf(this.uuid) < 0) targetList.push(this.uuid);
                          if (msg.message.devicetype === 'tod-target') {
                              if (todtargetList.indexOf(this.uuid) < 0) todtargetList.push(this.uuid);
                              PostCode(GetPostdataForToD(this.uuid, 1), ToDWebService.host, ToDWebService.setTargetStatus);
                          }

                          //PostCode(GetPostdata(this.uuid, 1), CKTWebService.host, CKTWebService.setTargetStatusWithMeetingInfo);
                          connectList[this.uuid].connection.send(JSON.stringify({
                              sender: 'Server',
                              date: getTime(),
                              command: 'assignuuid',
                              message: {
                                  uuid: this.uuid,
                              }
                          }));
                      } else if (msg.message.devicetype === 'client') {
                          if (clientList.indexOf(this.uuid) < 0) clientList.push(this.uuid);
                      } else if (msg.message.devicetype === 'tod-client') {
                          //console.log('wss tod-client:', todclientList.indexOf(this.uuid), todclientList, this.uuid);
                          if (todclientList.indexOf(this.uuid) < 0) todclientList.push(this.uuid);
                      } else if (msg.message.devicetype === 'pkt-mobile' || msg.message.devicetype === 'pkt-adapter') {
                          if (pktmobileList.indexOf(this.uuid) < 0 && msg.message.devicetype === 'pkt-mobile')
                              pktmobileList.push(this.uuid);
                          if (pktadapterList.indexOf(this.uuid) < 0 && msg.message.devicetype === 'pkt-adapter')
                              pktadapterList.push(this.uuid);
                          connectList[this.uuid].connection.send(JSON.stringify({
                              sender: 'Server',
                              date: getTime(),
                              command: 'registerdeviceresult',
                              message: {
                                  id: this.uuid,
                              }
                          }));
                      } else {
                          console.log('8wss ' + 'registerdevice error: ' + msg.message);
                          break;
                      }

                      console.log('9wss ' + 'user', msg.message.devicetype, ': ' + this.uuid + ', ' + getTime() + ' is registered.');
                      console.log("user's deviceuuid:", connectList[this.uuid].deviceuuid);
                      console.log("  ## total uuid number:", uuidList.length);
                      console.log("    -> current uuid list: ", uuidList);
                      console.log("  ## total target number:", targetList.length);
                      console.log("    -> current target list: ", targetList);
                      console.log("  ## total client number:", clientList.length);
                      console.log("    -> current client list: ", clientList);
                      console.log("  ## total ToD-target number:", todtargetList.length);
                      console.log("    -> current ToD-target list: ", todtargetList);
                      console.log("  ## total ToD-client number:", todclientList.length);
                      console.log("    -> current ToD-client list: ", todclientList);
                      console.log("  ## total PassKanTan mobile number:", pktmobileList.length);
                      console.log("    -> current PassKanTan mobile list: ", pktmobileList);
                      console.log("  ## total PassKanTan adapter number:", pktadapterList.length);
                      console.log("    -> current PassKanTan adapter list: ", pktadapterList);
                      console.log('\n');
                      break;

                  case 'updateinfo':
                      // only for Target side, provide a way for Target to update Target's nickname/pinCode/version
                      connectList[this.uuid].nickname = (msg.message.nickname) ? msg.message.nickname : "";
                      connectList[this.uuid].pinCode = (msg.message.pinCode) ? msg.message.pinCode : "";
                      connectList[this.uuid].version = (msg.message.version) ? msg.message.version : "";
                      connectList[this.uuid].meetingperiod = (msg.message.meetingperiod) ? msg.message.meetingperiod : "";
                      connectList[this.uuid].attendcount = (msg.message.attendcount) ? msg.message.attendcount : "";
                      connectList[this.uuid].meetingtitle = (msg.message.meetingtitle) ? msg.message.meetingtitle : "";
                      console.log('connectList[this.uuid] updateinfo:', connectList[this.uuid].version, msg.message);
                      PostCode(GetPostdata(this.uuid, 1), CKTWebService.host, CKTWebService.setTargetStatusWithMeetingInfo);
                      console.log('connectList[this.uuid]:', this.uuid, connectList[this.uuid]);
                      console.log('wss ' + 'user:', this.uuid, 'update info:', connectList[this.uuid].nickname, connectList[this.uuid].pinCode);
                      console.log('\n');
                      // don't send target info throught websocket, Client will request target info by WebService
                      break;
                      var roominfo = [];
                      roominfo.push({
                          "nickname": connectList[this.uuid].nickname,
                          "pinCode": connectList[this.uuid].pinCode,
                          "version": connectList[this.uuid].version,
                          "roomid": this.uuid,
                      });
                      for (var i = 0; i < clientList.length; i++) {
                          connectList[clientList[i]].connection.send(JSON.stringify({
                              sender: 'Server',
                              date: getTime(),
                              command: 'targetroominfo',
                              message: {
                                  roominfo: roominfo,
                                  roomremove: [],
                              }
                          }));
                      }
                      break;

                  case 'requestroominfo':
                      // only for Client side, query Target info.
                      var roominfo = [];
                      for (var i = 0; i < targetList.length; i++) {
                          roominfo.push({
                              "nickname": connectList[targetList[i]].nickname,
                              "pinCode": connectList[targetList[i]].pinCode,
                              "version": connectList[targetList[i]].version,
                              "roomid": connectList[targetList[i]].roomid,
                          });
                      }
                      connectList[this.uuid].connection.send(JSON.stringify({
                          sender: 'Server',
                          date: getTime(),
                          command: 'targetroominfo',
                          message: {
                              roominfo: roominfo,
                              roomremove: [],
                          }
                      }));
                      break;

                  case 'requestuuid':
                      // Client request uuid from Target through this command
                      if (targetList.indexOf(msg.message.toId) >= 0 || todtargetList.indexOf(msg.message.toId) >= 0) {
                          msg.message.fromServerId = this.uuid;
                          connectList[msg.message.toId].connection.send(JSON.stringify({
                              sender: 'Server',
                              date: getTime(),
                              command: 'requestuuid',
                              message: msg.message,
                          }));

                          //ws.send(JSON.stringify({
                          //    sender: 'Server',
                          //    date: getTime(),
                          //    command: 'requestuuid',
                          //    message: msg.message,
                          //}));
                      }
                      break;

                  case 'assignuuid':
                      // Target assign uuid to Client through this command
                      if (msg.message.toServerId && uuidList.indexOf(msg.message.toServerId) >= 0) {
                          connectList[msg.message.toServerId].connection.send(JSON.stringify({
                              sender: 'Server',
                              date: getTime(),
                              command: 'assignuuid',
                              message: {
                                  "uuid": msg.message.uuid,
                                  "roomId": msg.message.roomId,
                                  "fromDevicetype": msg.message.fromDevicetype,
                              }
                          }));
                      }
                      break;

                  case 'signal':
                      //# Any device CANNOT send signal without uuid
                      //# It means devices must registerdevice before send signal message
                      if (!this.uuid) break;
                      if (msg.message && uuidList.indexOf(msg.message.toServerId) >= 0) {
                          msg.message.info = {
                              serverId: this.uuid,
                              fromDevicetype: msg.message.deviceType,
                          };
                          connectList[msg.message.toServerId].connection.send(JSON.stringify({
                              sender: 'Server',
                              date: getTime(),
                              command: msg.command,
                              message: msg.message
                          }));
                      }
                      break;

                  case 'checktodtarget':
                      connectList[this.uuid].connection.send(JSON.stringify({
                          sender: 'Server',
                          date: getTime(),
                          command: "checktodtargetresult",
                          message: {
                              todid: msg.message.toId,
                              result: (todtargetList.indexOf(msg.message.toId) >= 0) ? true : false,
                          }
                      }));

                      break;

                  case 'stayawake':
                      //console.log('Receive stayawake from', uuid,'on', getTime());
                      break;

                  default:
                      console.log('wss ' + this.uuid, 'send command: ', msg.command, ' is not match!');
                      console.log("msg", msg);
              }
          }
      } catch (e) {
          console.log(e);
      }

  });
});

//setInterval(() => {
//  wss.clients.forEach((client) => {
//    client.send(new Date().toTimeString());
//  });
//}, 1000);

var interval = setInterval(function () {
    for (var i = 0; i < targetList.length; i++) {
        PostCode(GetPostdata(targetList[i], 1), CKTWebService.host, CKTWebService.setTargetStatusWithMeetingInfo);
        //console.log('targetList[i]:', targetList[i]);
    }
    //for (var i = 0; i < todtargetList.length; i++) {
    //    PostCode(GetPostdataForToD(todtargetList[i], 1), ToDWebService.host, ToDWebService.setTargetStatus);
    //}
}, 60000);