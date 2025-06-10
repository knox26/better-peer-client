// Signaling logic: handles communication with the signaling server
class Signaling {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.eventHandlers = {};
  }

  connect() {
    try {
      this.ws = new WebSocket(this.serverUrl);
      this.ws.onopen = () => this._emit('open');
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._emit(data.type, data);
        } catch (e) {
          this._emit('error', `[better-peer:Signaling] Failed to parse message: ${e.message}`);
        }
      };
      this.ws.onerror = (err) => this._emit('error', `[better-peer:Signaling] WebSocket error: ${err.message || err}`);
      this.ws.onclose = () => this._emit('close');
    } catch (e) {
      this._emit('error', `[better-peer:Signaling] Failed to connect: ${e.message}`);
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (e) {
        this._emit('error', `[better-peer:Signaling] Failed to send message: ${e.message}`);
      }
    } else {
      this._emit('error', '[better-peer:Signaling] WebSocket is not open');
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
}

export default Signaling;
