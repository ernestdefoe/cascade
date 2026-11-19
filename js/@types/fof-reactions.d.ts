/**
 * The fof/reactions model Cascade reads out of the store.
 *
 * Type-only. fof/reactions is optional, so Cascade never imports it at
 * runtime: it reads `app.store.all('reactions')`, which is simply empty when
 * the extension is not enabled. This describes the records that come back.
 */
declare module 'ext:fof/reactions/common/models/Reaction' {
  import Model from 'flarum/common/Model';

  export default class Reaction extends Model {
    identifier(): string;
    display(): string | null;
    enabled(): boolean;
  }
}
