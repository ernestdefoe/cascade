import 'flarum/forum/ForumApplication';

/**
 * The Pusher-style socket flarum/realtime puts on `app.websocket`, reduced to
 * the calls Cascade makes. Absent when flarum/realtime is not enabled.
 */
interface RealtimeChannel {
  bind(event: string, handler: (data: unknown) => void): void;
  unbind(event: string, handler: (data: unknown) => void): void;
  trigger(event: string, data: Record<string, unknown>): void;
}

interface RealtimeSocket {
  channel(name: string): RealtimeChannel | undefined;
  subscribe(name: string): RealtimeChannel;
  unsubscribe(name: string): void;
}

declare module 'flarum/forum/ForumApplication' {
  export default interface ForumApplication {
    websocket?: RealtimeSocket | null;
  }
}
