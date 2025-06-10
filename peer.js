import Signaling from './signaling.js';
import Connection from './connection.js';
import Call from './call.js';

// Peer class: manages peer identity, connections, and signaling
class Peer {
  constructor(id, options = {}) {
    this.id = id;
    this.options = options;
    this.connections = new Map();
    this.eventHandlers = {};
    this._signalQueues = new Map(); // Queue for early signals
    this.signaling = new Signaling(options.serverUrl || 'ws://localhost:3000');
    this.signaling.connect();
    this.signaling.on('open', () => {
      this.signaling.send({ type: 'register', peerId: this.id });
    });
    this.signaling.on('registered', () => {
      this._emit('open');
    });
    this.signaling.on('signal', (data) => {
      if (data.from) {
        let conn = this.connections.get(data.from);
        if (!conn) {
          // Incoming connection from another peer
          conn = new Connection(data.from, this.signaling, this.options);
          this.connections.set(data.from, conn);
          this._emit('connection', conn);
          // If there were queued signals, process them
          if (this._signalQueues.has(data.from)) {
            const queue = this._signalQueues.get(data.from);
            queue.forEach(signal => conn._handleSignal(signal));
            this._signalQueues.delete(data.from);
          }
        }
        // If connection is not ready, queue the signal
        if (typeof conn._handleSignal !== 'function' || !conn.rtc) {
          if (!this._signalQueues.has(data.from)) this._signalQueues.set(data.from, []);
          this._signalQueues.get(data.from).push(data.signal);
        } else {
          conn._handleSignal(data.signal);
        }
      }
    });
    this.signaling.on('error', (err) => this._emit('error', err));
    this._wsRetryCount = 0;
    this._maxRetries = options.maxRetries || 5;
    this._retryDelay = options.retryDelay || 1000;
    this._setupSignalingReconnect();

    // Listen for connection close/disconnect events from each Connection
    this._setupConnectionCloseEvents();
  }

  _setupSignalingReconnect() {
    this.signaling.on('close', () => {
      this._emit('close');
      // Mark all connections as disconnected
      this.connections.forEach((conn, peerId) => {
        if (typeof conn.peerOnConnectionClosed === 'function') {
          conn.peerOnConnectionClosed(peerId);
        }
      });
      if (this._wsRetryCount < this._maxRetries) {
        setTimeout(() => {
          this._wsRetryCount++;
          this.signaling.connect();
        }, this._retryDelay * this._wsRetryCount);
      } else {
        this._emit('error', '[better-peer:Peer] Max signaling reconnect attempts reached');
      }
    });
    this.signaling.on('open', () => {
      this._wsRetryCount = 0;
    });
  }

  _setupConnectionCloseEvents() {
    // Patch each new connection to notify Peer on close
    const originalEmit = this._emit.bind(this);
    this.on('connection', (conn) => {
      // Attach a callback to the connection's onclose
      conn.peerOnConnectionClosed = (peerId) => {
        originalEmit('disconnected', peerId);
      };
    });
    // Also patch existing connections (if any)
    this.connections.forEach((conn, peerId) => {
      conn.peerOnConnectionClosed = () => {
        originalEmit('disconnected', peerId);
      };
    });
  }

  connect(peerId) {
    const conn = new Connection(peerId, this.signaling, this.options);
    this.connections.set(peerId, conn);
    conn.createOffer();
    return conn;
  }

  getConnection(peerId) {
    return this.connections.get(peerId);
  }

  disconnect(peerId) {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.close();
      this.connections.delete(peerId);
    }
  }

  closeAll() {
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    if (this.signaling && this.signaling.ws) {
      this.signaling.ws.close();
    }
    this._emit('close');
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

  call(peerId, mediaOptions = { video: true, audio: true }) {
    return new Call(this, peerId, mediaOptions);
  }
}

export default Peer;
