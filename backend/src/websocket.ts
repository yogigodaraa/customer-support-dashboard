import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import authService from "./services/authService.js";
import logger from "./utils/logger.js";

let io: Server | null = null;

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
    path: "/ws",
  });

  // JWT auth middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const payload = authService.verifyToken(token);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket as any).user;
    logger.info(`WebSocket connected: ${user.email} (${user.role})`);

    // Join user-specific room
    socket.join(`user:${user.userId}`);

    // Join channel rooms on request
    socket.on("subscribe", (channel: string) => {
      socket.join(`channel:${channel}`);
      logger.info(`${user.email} subscribed to ${channel}`);
    });

    socket.on("unsubscribe", (channel: string) => {
      socket.leave(`channel:${channel}`);
    });

    // ─── Collision detection: presence events ─────────────────────────────

    // Agent starts viewing a conversation
    socket.on(
      "presence:viewing",
      ({ channel, externalId }: { channel: string; externalId: string }) => {
        const room = `viewing:${channel}:${externalId}`;
        socket.join(room);
        socket.to(room).emit("presence:agent_joined", {
          userId: user.userId,
          name: user.name ?? user.email,
          channel,
          externalId,
        });
      }
    );

    // Agent stops viewing a conversation
    socket.on(
      "presence:left",
      ({ channel, externalId }: { channel: string; externalId: string }) => {
        const room = `viewing:${channel}:${externalId}`;
        socket.leave(room);
        socket.to(room).emit("presence:agent_left", {
          userId: user.userId,
          name: user.name ?? user.email,
          channel,
          externalId,
        });
      }
    );

    // Agent is typing in a conversation reply box
    socket.on(
      "presence:typing",
      ({ channel, externalId }: { channel: string; externalId: string }) => {
        const room = `viewing:${channel}:${externalId}`;
        socket.to(room).emit("presence:agent_typing", {
          userId: user.userId,
          name: user.name ?? user.email,
          channel,
          externalId,
        });
      }
    );

    socket.on("disconnect", () => {
      logger.info(`WebSocket disconnected: ${user.email}`);
      // Socket.io automatically leaves all rooms on disconnect
    });
  });

  logger.info("WebSocket server initialized");
  return io;
}

/** Broadcast to all subscribers of a channel */
export function emitToChannel(channel: string, event: string, data: unknown): void {
  io?.to(`channel:${channel}`).emit(event, data);
}

/** Send to a specific user */
export function emitToUser(userId: string, event: string, data: unknown): void {
  io?.to(`user:${userId}`).emit(event, data);
}

/** Get the Socket.io server instance */
export function getIO(): Server | null {
  return io;
}
