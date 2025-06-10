import Connection from './connection.js';

class Call {
  constructor(peer, peerId, mediaOptions) {
    this.peer = peer;
    this.peerId = peerId;
    this.mediaOptions = mediaOptions;
    this.eventHandlers = {};
    this.localStream = null;
    this.conn = null;
    this._remoteStream = null;
    this._start();
  }

  async _start() {
    try {
      // 1. Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia(this.mediaOptions);

      // 2. Create or get connection
      let conn = this.peer.getConnection(this.peerId);
      if (!conn) {
        conn = this.peer.connect(this.peerId);
      }
      this.conn = conn;

      // 3. Add tracks to the connection
      this.localStream.getTracks().forEach(track => conn.rtc.addTrack(track, this.localStream));

      // 4. Aggregate remote tracks into a single MediaStream
      this._remoteStream = new MediaStream();
      conn.rtc.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
          if (!this._remoteStream.getTrackById(track.id)) {
            this._remoteStream.addTrack(track);
          }
        });
        this._emit('stream', this._remoteStream);
      };

      // 5. Listen for connection close
      conn.peerOnConnectionClosed = () => {
        this._emit('close');
      };
    } catch (e) {
      this._emit('error', '[better-peer:Call] getUserMedia failed: ' + (e && e.message ? e.message : e));
    }
  }

  on(event, handler) {
    if (!this.eventHandlers[event]) this.eventHandlers[event] = [];
    this.eventHandlers[event].push(handler);
  }

  _emit(event, ...args) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(fn => fn(...args));
    }
  }

  close() {
    if (this.conn) this.conn.close();
    if (this.localStream) this.localStream.getTracks().forEach(track => track.stop());
    this._emit('close');
  }
}

export default Call;
