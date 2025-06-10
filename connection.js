import Signaling from './signaling.js';

// Connection class: handles a single peer-to-peer connection
class Connection {
  constructor(peerId, signaling, options = {}) {
    this.peerId = peerId;
    this.signaling = signaling;
    this.options = options;
    this.rtc = new RTCPeerConnection(options.rtcConfig || {});
    this.channel = null;
    this._addedCandidates = new Set(); // Track ICE candidates
    this._setupSignaling();
    this._setupRTC();
  }

  _setupSignaling() {
    this.signaling.on('signal', async (data) => {
      if (data.from === this.peerId) {
        await this._handleSignal(data.signal);
      }
    });
  }

  _setupRTC() {
    // Handle ICE candidates
    this.rtc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ candidate: event.candidate });
      }
    };
    // Handle data channel (for receiving peer)
    this.rtc.ondatachannel = (event) => {
      this.channel = event.channel;
      this._setupChannel();
    };
  }

  _emitError(error, context = '') {
    const message = `[better-peer:Connection]${context ? ' [' + context + ']' : ''} ${error && error.message ? error.message : error}`;
    if (typeof this.onerror === 'function') {
      this.onerror(message, error);
    } else {
      console.error(message, error);
    }
  }

  async _handleSignal(signal) {
    if (signal.sdp) {
      try {
        await this.rtc.setRemoteDescription(new RTCSessionDescription(signal));
        if (signal.type === 'offer') {
          const answer = await this.rtc.createAnswer();
          await this.rtc.setLocalDescription(answer);
          this.sendSignal(this.rtc.localDescription);
        }
      } catch (e) {
        this._emitError(e, 'setRemoteDescription or answer');
      }
    } else if (signal.candidate) {
      // Ignore duplicate candidates
      const key = JSON.stringify(signal.candidate);
      if (this._addedCandidates.has(key)) return;
      this._addedCandidates.add(key);
      try {
        await this.rtc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch (e) {
        this._emitError(e, 'addIceCandidate');
      }
    }
  }

  async createOffer() {
    this.channel = this.rtc.createDataChannel('data');
    this._setupChannel();
    const offer = await this.rtc.createOffer();
    await this.rtc.setLocalDescription(offer);
    this.sendSignal(this.rtc.localDescription);
  }

  sendSignal(signal) {
    this.signaling.send({
      type: 'signal',
      target: this.peerId,
      signal
    });
  }

  _setupChannel() {
    if (!this.channel) return;
    this.channel.onopen = () => this.onopen && this.onopen();
    this.channel.onmessage = (event) => this.onmessage && this.onmessage(event.data);
    this.channel.onclose = () => {
      this.onclose && this.onclose();
      if (typeof this.peerOnConnectionClosed === 'function') {
        this.peerOnConnectionClosed(this.peerId);
      }
    };
    this.channel.onerror = (err) => this.onerror && this.onerror(err);
  }

  send(data) {
    if (this.channel && this.channel.readyState === 'open') {
      this.channel.send(data);
    }
  }

  close() {
    if (this.channel) this.channel.close();
    if (this.rtc) this.rtc.close();
  }
}

export default Connection;
