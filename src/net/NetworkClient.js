const EDGES = ['jump', 'reload', 'tactical', 'lethal', 'ability', 'impulse'];

/** WebSocket transport only. All combat and movement are simulated by the server. */
export class NetworkClient {
  constructor({ onState = () => {}, onLobby = () => {}, onError = () => {}, onClose = () => {}, WebSocketImpl = globalThis.WebSocket } = {}) {
    this.callbacks = { onState, onLobby, onError, onClose };
    this.WebSocket = WebSocketImpl;
    this.socket = null; this.connected = false; this.playerId = null; this.lobby = null;
    this.seq = 0; this.lastSendAt = -Infinity; this.pendingInput = {};
  }
  async connect({ url, action = 'create', code, name, config, loadout } = {}) {
    this.disconnect();
    let target;
    try { target = new URL(url); } catch { throw new Error('Enter the WebSocket server URL, such as wss://your-server.example.'); }
    if (!['ws:', 'wss:'].includes(target.protocol) || target.username || target.password) throw new Error('Use a ws:// or wss:// server URL without embedded credentials.');
    if (globalThis.location?.protocol === 'https:' && target.protocol !== 'wss:') throw new Error('This HTTPS page needs a secure wss:// game server.');
    if (!['create', 'join'].includes(action)) throw new Error('Choose Create or Join.');
    if (!this.WebSocket) throw new Error('This browser does not support WebSockets.');
    this.seq = 0; this.lastSendAt = -Infinity; this.pendingInput = {};
    const socket = new this.WebSocket(target.href);
    this.socket = socket;
    return new Promise((resolve, reject) => {
      let settled = false, intentional = false;
      const fail = message => {
        if (this.socket !== socket || intentional) return;
        if (!this.connected) intentional = true;
        if (!settled) { settled = true; clearTimeout(timeout); reject(new Error(message)); }
        this.callbacks.onError(message);
      };
      const timeout = setTimeout(() => {
        if (this.socket !== socket || settled || intentional) return;
        fail('The game server did not respond. Check the URL and that the server is running.');
        socket.close();
      }, 10000);
      this.cancelConnect = () => {
        intentional = true; clearTimeout(timeout);
        if (!settled) {
          settled = true;
          const cancellation = new Error('Connection cancelled.');
          cancellation.name = 'AbortError';
          reject(cancellation);
        }
      };
      socket.addEventListener('open', () => {
        if (this.socket !== socket) { intentional = true; socket.close(); return; }
        socket.send(JSON.stringify({ type: action, code, name, config, loadout }));
      });
      socket.addEventListener('message', event => {
        if (this.socket !== socket) return;
        let message;
        try { message = JSON.parse(event.data); } catch { fail('The server sent an invalid response.'); socket.close(); return; }
        if (message.type === 'error') {
          fail(String(message.message || 'The server rejected this action.'));
          if (!this.connected) socket.close();
        } else if (message.type === 'lobby') {
          this.connected = true; this.playerId = message.playerId; this.lobby = message;
          if (!settled) { settled = true; clearTimeout(timeout); resolve(message); }
          this.callbacks.onLobby(message);
        } else if (message.type === 'snapshot') {
          this.callbacks.onState(message);
        } else if (message.type === 'left') {
          intentional = true; this.disconnect();
        }
      });
      socket.addEventListener('error', () => {
        if (this.socket === socket) fail('Cannot reach the game server. Check its URL, TLS certificate and availability.');
      });
      socket.addEventListener('close', event => {
        clearTimeout(timeout);
        if (this.socket !== socket) return;
        const established = this.connected;
        this.socket = null; this.connected = false; this.playerId = null; this.lobby = null;
        const reason = event.reason || (event.code === 1000 ? 'Disconnected.' : 'Connection to the game server was lost.');
        if (!settled) { settled = true; reject(new Error(reason)); this.callbacks.onError(reason); }
        if (established && !intentional) this.callbacks.onClose(reason);
      });
    });
  }
  startMatch() { return this.send({ type: 'start' }); }
  send(message) {
    if (!this.connected || this.socket?.readyState !== 1) return false;
    this.socket.send(JSON.stringify(message)); return true;
  }
  sendInput(input = {}) {
    if (!this.connected) return false;
    const next = { ...input };
    for (const key of EDGES) next[key] = Boolean(next[key] || this.pendingInput[key]);
    if (next.switchSlot === undefined || next.switchSlot === null) next.switchSlot = this.pendingInput.switchSlot ?? null;
    this.pendingInput = next;
    const now = performance.now();
    if (now - this.lastSendAt < 1000 / 60 - .5) return false;
    if (this.socket?.bufferedAmount > 65536) return false;
    this.lastSendAt = now;
    const sent = this.send({ type: 'input', seq: this.seq++, input: this.pendingInput });
    if (sent) this.pendingInput = {};
    return sent;
  }
  disconnect() {
    this.cancelConnect?.(); this.cancelConnect = null;
    const socket = this.socket;
    this.socket = null; this.connected = false; this.playerId = null; this.lobby = null; this.pendingInput = {};
    if (socket && socket.readyState < 2) socket.close(1000, 'Left room.');
  }
}
