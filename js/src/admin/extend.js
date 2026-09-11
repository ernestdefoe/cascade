import Admin from 'flarum/common/extenders/Admin';

/**
 * Cascade's admin settings.
 *
 * These live in an Admin extender rather than inside `app.initializers.add`
 * because `app.extensionData` is registered by a core admin initializer that
 * may not have run when ours fires — the extender pipeline runs at a point in
 * the boot sequence where the ordering hazard does not exist.
 */
export default [
  new Admin()
    .setting(() => ({
      setting: 'ernestdefoe-cascade.preset',
      label: 'Preset',
      help: 'Wall puts each discussion on its own card over a grey ground, with a wide labelled engagement bar. Timeline runs them as hairline-separated rows in a single 600px column. Both share the same layout and settings; switching takes effect on the next page load.',
      type: 'select',
      options: { wall: 'Wall — cards', timeline: 'Timeline — rows' },
      default: 'wall',
    }))
    .setting(() => ({
      setting: 'ernestdefoe-cascade.feed_density',
      label: 'What each row shows',
      help: 'Excerpt and image is what makes the list read as a feed. Title only turns Cascade back into a conventional discussion list and skips the excerpt query entirely.',
      type: 'select',
      options: {
        excerpt_media: 'Excerpt and image',
        excerpt: 'Excerpt only',
        title: 'Title only',
      },
      default: 'excerpt_media',
    }))
    .setting(() => ({
      setting: 'ernestdefoe-cascade.excerpt_length',
      label: 'Excerpt length (characters)',
      help: 'Between 40 and 600. Longer excerpts mean fewer discussions visible without scrolling, and a slightly larger payload on every page of the list.',
      type: 'number',
      min: 40,
      max: 600,
      step: 20,
      placeholder: '280',
    }))
    .setting(() => ({
      setting: 'ernestdefoe-cascade.widget_trending',
      label: 'Show the Trending widget',
      help: 'Ranks tags by how many discussions they actually received in the last seven days, recomputed hourly. Needs flarum/tags; the widget hides itself without it.',
      type: 'boolean',
    }))
    .setting(() => ({
      setting: 'ernestdefoe-cascade.engagement_bar',
      label: 'Engagement bar',
      help: 'Auto shows Reply and Share on every row, and adds a reaction control on the discussion page when flarum/likes or fof/reactions is enabled. Cascade never ships reactions of its own, so with neither installed there is no reaction control to show.',
      type: 'select',
      options: { auto: 'Auto', on: 'Always show', off: 'Hide' },
      default: 'auto',
    })),
];
