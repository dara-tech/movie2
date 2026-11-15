import { io, Socket } from 'socket.io-client';
import environment from '../config/environment';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    // If socket exists and is connected, return it
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Disconnect old socket if it exists
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(environment.API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event: string, ...args: any[]) {
    if (this.socket) {
      this.socket.emit(event, ...args);
    }
  }
}

const socketService = new SocketService();
export default socketService;

