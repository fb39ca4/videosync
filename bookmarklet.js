function removeElement(element) {
	element.parentNode.removeChild(element);
}

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

try {
	window.criterionParty.cleanup();
}
catch (e) {}

class CriterionParty {
	constructor() {
		this.videoElement = null;
		this.socket = null;
		this.commandCount = 0;

		this.loginDiv = document.createElement("div");
		this.loginDiv.style.position = "fixed";
		this.loginDiv.style.top = "0";
		this.loginDiv.style.width = "100%";
		this.loginDiv.style.backgroundColor = "gray";
		// this.loginDiv.style.color = "white";
		this.loginDiv.style.zIndex = 99999999;
		this.loginDiv.innerHTML = `
			Server: <input class="criterionParty-server-input" value="%%SERVER%%"></input>&emsp;
			Room: <input class="criterionParty-room-input" value="default"></input>&emsp;
			Username: <input class="criterionParty-username-input" value=""></input>&emsp;
			<button class="criterionParty-connect-button">Connect</button>&emsp;
			Video element: <span class="criterionParty-video-status">not found. Try pressing play to load it.</span>
		`;
		this.loginDiv.querySelector(".criterionParty-connect-button").addEventListener("click", () => {
			var server = this.loginDiv.querySelector(".criterionParty-server-input").value;
			var room = this.loginDiv.querySelector(".criterionParty-room-input").value;
			var username = this.loginDiv.querySelector(".criterionParty-username-input").value;
			this.displayMessage("trying to connect")
			this.connect(server, room, username);
		})
		document.body.prepend(this.loginDiv);

		this.queuedMessages = [];
		this.messageDiv = null;

		this.findVideoElement();

		this.displayMessage("hello from criterionParty");
	}

	displayMessage(text) {
		if (this.messageDiv === null) {
			this.queuedMessages.push(text);
			return;
		}

		var message = document.createElement("div");
		message.textContent = text;
		console.log("criterionParty: " + text);
		console.log(message);
		this.messageDiv.appendChild(message);
		setTimeout(() => removeElement(message), 3000);
	}

	onUserPlay() {
		if (this.loggedIn === true) {
			this.socket.send(JSON.stringify({
				type: "play",
				currentTime: this.videoElement.currentTime,
			}));
			this.commandCount++;
		}
	}

	onUserPause() {
		if (this.loggedIn === true) {
			this.socket.send(JSON.stringify({
				type: "pause",
				currentTime: this.videoElement.currentTime,
			}));
			this.commandCount++;
		}
	}

	findVideoElement() {
		console.log("Searching for video element.");
		var videoElement = document.querySelector("video");
		if (videoElement === null) {
			for (var iframe of Array.from(document.querySelectorAll("iframe"))) {
				videoElement = iframe.contentWindow.document.querySelector("video");
				if (videoElement !== null) break;
			}
		}
		if (videoElement === null) {
			window.setTimeout(this.findVideoElement.bind(this), 1000);
		}
		else {
			console.log("found video element")
			this.loginDiv.querySelector(".criterionParty-video-status").textContent = "Found"
			this.videoElement = videoElement;
			this.messageDiv = document.createElement("div");
			this.messageDiv.style.cssText = "position: absolute; text-shadow: 0px 0px 3px #000,0px 0px 3px #000,0px 0px 3px #000,0px 0px 3px #000,0px 0px 3px #000,0px 0px 3px #000,0px 0px 3px #000; color: white; padding: 1ex;";
			insertAfter(this.messageDiv, this.videoElement);
			while (this.queuedMessages.length !== 0) {
				this.displayMessage(this.queuedMessages.shift());
			}

			this.playVideoOriginalMethod = this.videoElement.play;
			this.playVideo = this.videoElement.play.bind(this.videoElement);
			this.videoElement.play = (() => {
				this.onUserPlay();
				console.log("User play video");
				return this.playVideoOriginalMethod.apply(this.videoElement, arguments);
			}).bind(this);


			this.pauseVideoOriginalMethod = this.videoElement.pause;
			this.pauseVideo = this.videoElement.pause.bind(this.videoElement);
			this.videoElement.pause = (() => {
				this.onUserPause();
				console.log("User pause video");
				return this.pauseVideoOriginalMethod.apply(this.videoElement, arguments);
			}).bind(this);

		}
	}

	cleanup() {
		console.log("cleaning up");
		try {
			removeElement(this.loginDiv);
		} catch {}
		try {
			removeElement(this.messageDiv);
		} catch {}
		try {
			this.socket.close();
		} catch {}
		try {
			this.videoElement.play = this.playVideoOriginalMethod;
			this.videoElement.pause = this.pauseVideoOriginalMethod;
			// this.videoElement.removeEventListener("seek", this.seekListener);
		} catch {}
		try {
			delete window.criterionParty;
		} catch {}
	}

	connect(server, room, username) {
		this.loggedIn = false;
		var socket = new WebSocket(server);
		if (this.socket !== null) {
			try {
				this.socket.close();
			}
			catch {}
		}
		this.socket = socket;

		socket.onclose = () => {
			this.displayMessage("Connection closed. Please try to connect again.");
			this.socket = null;
			this.loggedIn = false;
		}

		socket.onerror = () => {
			this.displayMessage("Connection failed. Please try to connect again.");
			this.loggedIn = false;
			this.socket = null;
		}

		socket.onopen = () => {
			this.displayMessage("Connected to server at " + server);
			socket.send(JSON.stringify({
				type: "login",
				username: username,
				room: room,
			}));
		}

		socket.onmessage = (event) => {
			if (this.videoElement === null) return;
			var message = null;
			try {
				message = JSON.parse(event.data);
				console.log(message);
				if (typeof message.message !== "undefined") {
					this.displayMessage(message.message);
				}

				if (message.type === "play") {
					this.videoElement.currentTime = message.currentTime;
					this.playVideo();
				}

				if (message.type === "pause") {
					this.pauseVideo();
					this.videoElement.currentTime = message.currentTime;
				}

				if (message.type === "loginReply") {
					console.log("login reply message");
					if (message.success === true) {
						this.loggedIn = true;
						this.commandCount = 0;
					}
				}

				// if (message.type == "roomStatus") {
				// 	if (this.commandCount > message.commandCount) {
				// 		console.log("Ignoring old roomStatus message, commandCount = " + this.commandCount);
				// 	}
				// 	else {
				// 		this.commandCount = message.commandCount;

				// 		if (message.playing === true && this.videoElement.paused !== false) {
				// 			this.videoElement.currentTime = message.currentTime;
				// 			this.playVideo();
				// 		}

				// 		if (message.playing === false && this.videoElement.paused !== true) {
				// 			this.pauseVideo();
				// 			this.videoElement.currentTime = message.currentTime;
				// 		}
				// 	}
				// }
			}
			catch (e) {
				console.log(e);
				console.log("Failed to parse message from server:" + " " + event.data);
			}

		}
	}
};

var criterionParty = new CriterionParty();
window.criterionParty = criterionParty;
console.log(criterionParty);





