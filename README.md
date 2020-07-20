# Videosync

This is a proof-of-concept for video playback synchronization within the browser. The concept is similar to [Syncplay](https://syncplay.pl/), where one connects to a room in a server and all users in a room experience synchronized video playback, but the client is Javascript code injected in a webpage, so it can work with most websites.

The client ought to eventually be a browser extension, but for now it is in bookmarklet form.

## Server setup

Install node packages

    npm install

Run the server (on port 3000)

    node index.js

## Client setup

As a bookmarklet, bookmark the following:

    javascript:(function(){r = new XMLHttpRequest; r.onload = () => eval(r.responseText); r.open("GET", "http://localhost:3000/bookmarklet.js"); r.send();})()

and open the bookmark to load the client into the current page.

Or just run

    r = new XMLHttpRequest; r.onload = () => eval(r.responseText); r.open("GET", "http://localhost:3000/bookmarklet.js"); r.send();

in your browser's Javascript console.

In either case, replace localhost:3000 with the appropriate hostname if you are using this with a remote client.

## Usage

On loading the client, a bar will appear at the top of the webpage. Confirm that the video element has been found. Some webpages do not actually load a video element until you click the play button for the first time, so get it playing first.

The server name will be prefilled, but you must choose a room name (same as the other clients you want to synchronize with) and username (unique to the room), and hit connect. You should see status messages overlaid on the video, and when you play, pause, and seek the video, other clients will do the same.