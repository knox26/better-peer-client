# better-peer

A simple, modern WebRTC peer-to-peer library for JavaScript and Node.js.

## Features
- Simple API for data and media (audio/video) connections
- Works in browser and Node.js (data channel)
- Easily connect to your own signaling server
- Automatic reconnection and error handling
- One-on-one video/audio call support

## Installation

```sh
npm install better-peer
```

## Usage

### Data Connection
```js
import { Peer } from 'better-peer';
const peer = new Peer('alice', { serverUrl: 'ws://localhost:3000' });

peer.on('open', () => {
  // Ready to connect
  const conn = peer.connect('bob');
  conn.onopen = () => conn.send('Hello Bob!');
  conn.onmessage = (msg) => console.log('Received:', msg);
});

peer.on('connection', (conn) => {
  conn.onmessage = (msg) => console.log('Received:', msg);
  conn.send('Hello!');
});
```

### One-on-One Video/Audio Call
```js
const call = peer.call('bob', { video: true, audio: true });

call.on('stream', (remoteStream) => {
  document.querySelector('video').srcObject = remoteStream;
});

call.on('close', () => {
  // Handle call end
});

call.on('error', (err) => {
  // Handle getUserMedia or connection errors
  alert(err);
});
```

## Events

- `open`: Emitted when the peer is registered and ready.
- `connection`: Emitted when a new incoming connection is established. Handler receives the Connection instance.
- `error`: Emitted on any error (signaling, connection, etc.).
- `close`: Emitted when the signaling WebSocket is closed or all connections are closed.
- `disconnected`: Emitted when a specific connection is closed/disconnected.

## Edge Cases & Error Handling
- If getUserMedia is denied or fails, the call emits an 'error' event.
- All remote tracks are aggregated into a single MediaStream for one-on-one calls.
- Automatic reconnection/backoff on signaling disconnect.

## License
MIT

---

**Signaling Server**

This library is designed to work seamlessly with the [better-peer-server](https://github.com/knox26/better-peer-server) signaling server. See the [better-peer-server](https://github.com/knox26/better-peer-server) repo for deployment and integration details.
