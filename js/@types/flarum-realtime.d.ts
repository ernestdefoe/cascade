/**
 * The two flarum/realtime modules Cascade looks up at runtime with
 * `flarum.reg.checkModule` (see src/forum/typing.ts).
 *
 * Type-only. flarum/realtime is optional, so these are never imported for
 * real; they describe what the registry hands back when it is enabled.
 */
declare module 'ext:flarum/realtime/forum/states/TypingState' {
  export default class TypingState {
    add(data: unknown): void;
    dispose(): void;
  }
}

declare module 'ext:flarum/realtime/forum/components/TypingIndicator' {
  import type Mithril from 'mithril';
  import Component, { type ComponentAttrs } from 'flarum/common/Component';
  import type TypingState from 'ext:flarum/realtime/forum/states/TypingState';

  export interface ITypingIndicatorAttrs extends ComponentAttrs {
    state: TypingState;
  }

  export default class TypingIndicator extends Component<ITypingIndicatorAttrs> {
    view(vnode: Mithril.Vnode<ITypingIndicatorAttrs, this>): Mithril.Children;
  }
}
