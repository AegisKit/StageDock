import { WebSocketServer, type WebSocket } from 'ws';

export type SyncMessage =
  | { type: 'join'; roomId: string }
  | { type: 'leave'; roomId: string }
  | { type: 'command'; roomId: string; action: 'play' | 'pause' | 'seek'; payload?: { position?: number } };

interface ClientContext {
  socket: WebSocket;
  roomId: string | null;
}

export class SyncService {
  private server: WebSocketServer | null = null;
  private readonly clients = new Set<ClientContext>();

  start(port = 0) {
    if (this.server) {
      return;
    }
    this.server = new WebSocketServer({ port });
    this.server.on('connection', (socket) => this.registerClient(socket));
  }

  stop() {
    this.server?.close();
    this.server = null;
    this.clients.clear();
  }

  private registerClient(socket: WebSocket) {
    const context: ClientContext = { socket, roomId: null };
    this.clients.add(context);

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(String(data)) as SyncMessage;
        this.handleMessage(context, message);
      } catch (error) {
        console.warn('Sync message parse failed', error);
      }
    });

    socket.on('close', () => {
      this.clients.delete(context);
    });
  }

  private handleMessage(context: ClientContext, message: SyncMessage) {
    if (message.type === 'join') {
      context.roomId = message.roomId;
      return;
    }

    if (message.type === 'leave') {
      context.roomId = null;
      return;
    }

    if (message.type === 'command' && context.roomId) {
      for (const client of this.clients) {
        if (client !== context && client.roomId === context.roomId) {
          client.socket.send(JSON.stringify(message));
        }
      }
    }
  }
}
