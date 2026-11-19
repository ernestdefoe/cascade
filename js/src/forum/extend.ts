import Extend from 'flarum/common/extenders';
import Discussion from 'flarum/common/models/Discussion';

declare module 'flarum/common/models/Discussion' {
  export default interface Discussion {
    cascadeExcerpt(): string | null;
    cascadeImages(): string[] | null;
    cascadeImageCount(): number | null;
    cascadeLastReply(): string | null;

    // Present only when fof/reactions is enabled, so `undefined` otherwise.
    cascadeFirstPostId(): number | null | undefined;
    cascadeReactionCounts(): Record<string, number> | null | undefined;
    cascadeUserReaction(): number | null | undefined;
  }
}

export default [
  /*
   * The fields DiscussionResourceFields contributes to the discussion list
   * payload. Declaring them on the model is what makes
   * `discussion.cascadeExcerpt()` work — without this they sit in the JSON and
   * stay invisible to the frontend.
   *
   * The last three are present only when fof/reactions is enabled - see the
   * Conditional block in extend.php. The engagement bar checks for a missing
   * first post id and omits the reaction control rather than rendering a
   * button with nothing behind it.
   */
  new Extend.Model(Discussion)
    .attribute<string | null>('cascadeExcerpt')
    .attribute<string[] | null>('cascadeImages')
    .attribute<number | null>('cascadeImageCount')
    .attribute<string | null>('cascadeLastReply')
    .attribute<number | null | undefined>('cascadeFirstPostId')
    .attribute<Record<string, number> | null | undefined>('cascadeReactionCounts')
    .attribute<number | null | undefined>('cascadeUserReaction'),
];
