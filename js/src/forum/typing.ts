import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';
import type TypingIndicator from 'ext:flarum/realtime/forum/components/TypingIndicator';
import type TypingState from 'ext:flarum/realtime/forum/states/TypingState';

/**
 * Typing indicators for the conversation modal.
 *
 * flarum/realtime builds its indicator out of two pieces on purpose: a
 * `TypingState` that holds who is typing, and a purely presentational
 * `TypingIndicator` that renders whatever state it is handed. Its own docs say
 * so - the component is meant to be placed anywhere a theme keeps a state. What
 * it does NOT do is create that state anywhere except `PostStream.oninit`, so a
 * modal on the index has neither the state nor the socket subscription behind
 * it. This module supplies both.
 *
 * Everything here is optional. flarum/realtime is a suggestion, not a
 * requirement, and `flarum.reg.checkModule` returns false (rather than
 * throwing) for a module nobody registered - so on a forum without it
 * every function below reports "unavailable" and the modal simply renders no
 * indicator.
 */

type Socket = NonNullable<typeof app.websocket>;
type Channel = ReturnType<Socket['subscribe']>;

/** One live typing subscription, shared by everything that acquired it. */
interface Subscription {
  state: TypingState;
  refs: number;
  channels: { name: string; channel: Channel; preexisting: boolean }[];
  handler: (data: unknown) => void;
  timer: ReturnType<typeof setInterval> | null;
  previous: unknown;
}

/** discussionId -> its subscription */
const subscriptions = new Map<string, Subscription>();

/**
 * A module exported by flarum/realtime, or null when it is not installed.
 *
 * `checkModule` is used rather than `get` because it answers without warning:
 * `get` logs "No module found" to the console for an enabled-but-missing
 * module, and an absent optional dependency is not a fault worth reporting.
 * It only looks in the registry's maps, so it cannot throw.
 */
function realtime<T>(id: string): T | null {
  return flarum.reg.checkModule('flarum-realtime', id) || null;
}

/** realtime's TypingState class, or null. */
function typingStateClass(): typeof TypingState | null {
  return realtime<typeof TypingState>('forum/states/TypingState');
}

/** The presentational component, or null. */
export function typingIndicator(): typeof TypingIndicator | null {
  return realtime<typeof TypingIndicator>('forum/components/TypingIndicator');
}

/**
 * Whether this viewer can be shown who is typing in this discussion.
 *
 * Mirrors the conditions flarum/realtime itself checks before subscribing, so
 * Cascade never asks for a channel it would be refused: the socket has to
 * exist, public connections must not be disallowed for a guest, and the
 * discussion's own `canViewWhoTypes` has to be set.
 */
export function canShowTyping(discussion: Discussion | null | undefined): boolean {
  if (!discussion || !app.websocket) return false;
  if (!typingIndicator() || !typingStateClass()) return false;
  if (app.forum.attribute('websocket.disallow_connection') && !app.session.user) return false;

  return Boolean(discussion.attribute('canViewWhoTypes'));
}

/**
 * Start (or join) a typing subscription for a discussion and get its state.
 *
 * Reference-counted: the modal and a composer hold can both want it alive at
 * once, and whichever releases last tears it down.
 *
 * @returns the TypingState, or null when typing is unavailable
 */
export function acquireTyping(discussion: Discussion): TypingState | null {
  const socket = app.websocket;
  const StateClass = typingStateClass();

  // canShowTyping() checks both of these too; naming them here is what lets
  // the rest of this function use them.
  if (!canShowTyping(discussion) || !socket || !StateClass) return null;

  const id = String(discussion.id());
  const existing = subscriptions.get(id);

  if (existing) {
    existing.refs++;
    return existing.state;
  }

  const state = new StateClass();

  const names = ['private-typing=' + id];

  // Users allowed to see through a hidden online status get the channel that
  // names those typists too. Authorisation is enforced server-side; this
  // attribute only avoids requesting a channel we would be refused.
  if (app.session.user?.attribute('canViewHiddenTypers')) {
    names.push('private-typingIdentified=' + id);
  }

  const handler = (data: unknown) => state.add(data);

  const channels = names.map((name) => {
    // Pusher returns the SAME channel object if something else already
    // subscribed to this name - the discussion page's PostStream, say. Noting
    // that means release() can unbind our handler without unsubscribing a
    // channel we did not open.
    const preexisting = Boolean(socket.channel(name));
    const channel = socket.subscribe(name);

    channel.bind('client-typing', handler);

    return { name, channel, preexisting };
  });

  const entry: Subscription = { state, refs: 1, channels, handler, timer: null, previous: null };

  subscriptions.set(id, entry);
  startSending(discussion, entry);

  return state;
}

/**
 * Drop one reference. The subscription is torn down when the last one goes.
 */
export function releaseTyping(discussion: Discussion): void {
  const id = String(discussion.id());
  const entry = subscriptions.get(id);

  if (!entry) return;

  entry.refs--;

  if (entry.refs > 0) return;

  if (entry.timer) clearInterval(entry.timer);

  entry.channels.forEach(({ name, channel, preexisting }) => {
    channel.unbind('client-typing', entry.handler);

    // Only close what we opened. Unsubscribing a channel the discussion page
    // is also using would silently stop ITS typing indicator.
    if (!preexisting) app.websocket?.unsubscribe(name);
  });

  entry.state.dispose();
  subscriptions.delete(id);
}

/**
 * Announce that the actor is typing, while they are replying to this
 * discussion and we hold a subscription.
 *
 * Without this the indicator would be one-way: a reader in the modal would see
 * people typing on the discussion page, but nobody would ever see someone
 * typing from the feed - and a feed-first theme is precisely where most
 * replies get written.
 *
 * Nothing identifying is sent. The server resolves who we are from the
 * connection's authenticated user channel and decides who may learn it.
 */
function startSending(discussion: Discussion, entry: Subscription): void {
  if (!app.session.user) return;

  const channel = entry.channels[0].channel;

  entry.timer = setInterval(() => {
    if (!app.composer?.composingReplyTo?.(discussion)) return;

    const content = app.composer.fields?.content?.();

    // Only on an actual change, so an open-but-idle composer stays quiet.
    if (content === entry.previous) return;

    entry.previous = content;
    channel.trigger('client-typing', { time: Date.now() });
  }, 2000);
}

/**
 * Hold the subscription open for as long as the composer is replying to this
 * discussion.
 *
 * The modal closes when its Reply button is pressed - the composer docks to the
 * bottom of the window, underneath the modal backdrop - so without this the
 * subscription would be released at the exact moment the user starts typing.
 */
export function holdForComposer(discussion: Discussion): void {
  if (!acquireTyping(discussion)) return;

  let sawComposer = false;

  const poll = setInterval(() => {
    const composing = Boolean(app.composer?.composingReplyTo?.(discussion));

    if (composing) {
      sawComposer = true;
      return;
    }

    // Give the composer a moment to open before deciding it never did.
    if (!sawComposer) return;

    clearInterval(poll);
    releaseTyping(discussion);
  }, 1000);

  // A composer that never opens (no permission, login modal) must not leak the
  // hold forever.
  setTimeout(() => {
    if (!sawComposer) {
      clearInterval(poll);
      releaseTyping(discussion);
    }
  }, 10000);
}
