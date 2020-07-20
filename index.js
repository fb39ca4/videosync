const express = require('express');
const uuid = require('uuid');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

var expressWs = require('express-ws');

const app = express();

app.use(express.json({
	verify: (req, res, buf) => {
		req.rawBody = buf;
	}
}));
app.use(cors());

expressWs(app);

const port = 3000;

function secondsToHMS(time) {
	var hours = Math.floor(time / 3600);
	time -= hours * 3600;
	var minutes = Math.floor(time / 60);
	time -= minutes * 60;
	var seconds = Math.floor(time);
	time -= seconds;
	var hundredths = Math.floor(time * 100);
	return String(hours) + ':' + ('00' + String(minutes)).slice(-2) + ':' + ('00' + String(seconds)).slice(-2) + "." + ('00' + String(hundredths)).slice(-2);
}

class User {
	constructor(username, socket) {
		this.username = username;
		this.socket = socket;
	}
}

class Room {
	constructor(roomName) {
		this.users = new Map();
		this.roomName = roomName;
		this.playing = false;
		this.playStartVideoTime = 0;
		this.playStartRealTime = process.hrtime();
		this.commandCount = 0;

		// setInterval(() => {
		// 	console.log(JSON.stringify(this.getStatus()));
		// 	this.users.forEach((user, username) => {
		// 		user.socket.send(JSON.stringify(this.getStatus()));
		// 	});
		// }, 2000);

		// setInterval(() => {
		// 	if (this.playing) {
		// 		this.pause();
		// 	}
		// 	else {
		// 		this.play();
		// 	}
		// }, 10000)
	}

	getCurrentTime() {
		if (this.playing === true) {
			var time = process.hrtime(this.playStartRealTime);
			var timeDouble = time[0] + time[1] * 1e-9;
			return this.playStartVideoTime + timeDouble;
		}
		else {
			return this.playStartVideoTime;
		}
	}

	getStatus() {
		var time = process.hrtime(this.playStartRealTime);
		var timeDouble = time[0] + time[1] * 1e-9;
		return {
			type: "roomStatus",
			name: this.roomName,
			playing: this.playing,
			currentTime: this.playStartVideoTime + (this.playing ? timeDouble : 0),
			commandCount: this.commandCount,
			users: Array.from(this.users.keys()),
		}
	}

	play(videoTime, username = "server") {
		videoTime = videoTime || this.getCurrentTime();
		this.playStartVideoTime = videoTime;
		this.playStartRealTime = process.hrtime();
		this.playing = true;
		this.commandCount++;
		this.users.forEach((user) => {
			user.socket.send(JSON.stringify({
				type: "play",
				currentTime: videoTime,
				commandCount: this.commandCount,
				message: `${username}: play at ${secondsToHMS(videoTime)}`,
			}));
		});
	}

	pause(videoTime, username = "server") {
		videoTime = videoTime || this.getCurrentTime();
		this.playStartVideoTime = videoTime;
		this.playing = false;
		this.commandCount++;
		this.users.forEach((user) => {
			user.socket.send(JSON.stringify({
				type: "pause",
				currentTime: videoTime,
				commandCount: this.commandCount,
				message: `${username}: pause at ${secondsToHMS(videoTime)}`,
			}));
		});
	}
}

rooms = new Map();



app.get('/bookmarklet.js', (req, res) => {
	fs.readFile(path.join(__dirname, 'bookmarklet.js'), 'utf8', function(err, data) {
		if (err) {
			res.sendStatus(503);
		}
		res.send(data.replace('%%SERVER%%', `${req.connection.encrypted ? 'wss' : 'ws'}://${req.headers.host}`));
	});
});

app.post('/join', (req, res, buf) => {
	res.send("hello");
	console.log(req.body);
});

app.ws('/', (ws, req) => {
	ws.user = null;
	ws.room = null;

	ws.on("message", (data) => {
		if (ws.user !== null && ws.room !== null) {
			console.log(`${ws.room.roomName}/${ws.user.username}: ${data}`);
		}
		else {
			console.log("new user: " + data);
		}
		try {
			message = JSON.parse(data);
			if (message.type === "login") {
				var roomName = message.room;
				var username = message.username;
				if (typeof roomName === "string" && roomName !== "" &&
					typeof username === "string" && username !== "") {
					var room = null;
					if (!rooms.has(roomName)) {
						room = new Room(roomName);
						rooms.set(roomName, room);
					}
					else {
						room = rooms.get(roomName);
					}

					if (room.users.has(username)) {
						ws.send(JSON.stringify({
							type: "loginReply",
							success: false,
							message: `Login failed: Username "${username}" already in use in room "${roomName}"`
						}));
						ws.close();
					}
					else {
						var user = new User(username, ws);
						room.users.set(username, user);
						ws.user = user;
						ws.room = room;
						ws.send(JSON.stringify({
							type: "loginReply",
							success: true,
							message: `Logged into ${roomName} as ${username}`
						}));
					}
				}
				else {
					ws.send(JSON.stringify({
						type: "loginReply",
						success: false,
						message: `Login failed: Username and room must be nonempty strings.`
					}));
					ws.close();
				}
			}
			else {
				if (ws.room === null) {
					ws.send(JSON.stringify({
						type: "info",
						message: `Not logged in, ignoring.`
					}));
				}
				else if (message.type === "play") {
					ws.room.play(message.currentTime, ws.user.username);
				}
				else if (message.type === "pause") {
					ws.room.pause(message.currentTime, ws.user.username);
				}
			}
		}
		catch (e) {
			console.log(e);
			ws.send(JSON.stringify({
				type: "info",
				message: `Ignoring unexpected input from client.`
			}));
			ws.close();
			return;
		}
	});

	ws.on('close', () => {
		if (ws.user !== null && ws.room !== null) {
			console.log(`${ws.room.roomName}: ${ws.user.username} disconnected`)
			ws.room.users.delete(ws.user.username);
			ws.room.users.forEach((user) => {
				user.socket.send(JSON.stringify({
					type: "info",
					message: `server: ${ws.user.username} disconnected`,
				}));
			});
		}
	})

	console.log("New websocket connection");
});

app.listen(port, () => console.log(`Server address: http://localhost:${port}`))