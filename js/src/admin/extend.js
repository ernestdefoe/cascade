import app from 'flarum/admin/app';
import Admin from 'flarum/common/extenders/Admin';

/**
 * Cascade's admin settings.
 *
 * These live in an Admin extender rather than inside `app.initializers.add`
 * because `app.extensionData` is registered by a core admin initializer that
 * may not have run when ours fires — the extender pipeline runs at a point in
 * the boot sequence where the ordering hazard does not exist.
 *
 * 🚨 Every string here is a translator key. They used to be English literals,
 * which made locale/en.yml's promise that "nothing in Cascade is hardcoded
 * English in a component" true of the forum only — an admin running Cascade in
 * any other language got a settings page in English and no way to fix it.
 */
const t = (key) => app.translator.trans(`ernestdefoe-cascade.admin.settings.${key}`);

/**
 * The three preset names live under `lib.` because BOTH frontends show them:
 * the admin picks the forum default, and a member picks their own. One
 * definition, so the two can never drift apart in a translation.
 *
 * 🚨 `lib.`, not `ref.`. Only `lib.` is delivered to both frontends — a `ref.`
 * key reaches the admin page as its own raw name, and the preset dropdown
 * quite happily rendered `ernestdefoe-cascade.ref.preset.wall` as its label.
 */
const presetOption = (key) => app.translator.trans(`ernestdefoe-cascade.lib.preset.${key}`);

export default [
  new Admin()
    /*
     * The stored values stay 'wall' / 'timeline' / 'stream'. Only the labels
     * name the platforms, because a stored key is a migration and a label is a
     * string — see src/Presets.php.
     */
    .setting(() => ({
      setting: 'ernestdefoe-cascade.preset',
      label: t('preset_label'),
      help: t('preset_help'),
      type: 'select',
      options: {
        wall: presetOption('wall'),
        timeline: presetOption('timeline'),
        stream: presetOption('stream'),
      },
      default: 'wall',
    }))
    .setting(() => ({
      setting: 'ernestdefoe-cascade.allow_user_preset',
      label: t('allow_user_preset_label'),
      help: t('allow_user_preset_help'),
      type: 'boolean',
      default: true,
    }))
    .setting(() => ({
      setting: 'ernestdefoe-cascade.widget_hashtags',
      label: t('widget_hashtags_label'),
      help: t('widget_hashtags_help'),
      type: 'boolean',
      default: true,
    }))
    .setting(() => ({
      setting: 'ernestdefoe-cascade.hashtag_count',
      label: t('hashtag_count_label'),
      help: t('hashtag_count_help'),
      type: 'number',
      min: 6,
      max: 60,
      step: 2,
      default: 24,
    }))
    .setting(() => ({
      setting: 'ernestdefoe-cascade.feed_density',
      label: t('feed_density_label'),
      help: t('feed_density_help'),
      type: 'select',
      options: {
        excerpt_media: t('feed_density_excerpt_media'),
        excerpt: t('feed_density_excerpt'),
        title: t('feed_density_title'),
      },
      default: 'excerpt_media',
    }))
    .setting(() => ({
      setting: 'ernestdefoe-cascade.excerpt_length',
      label: t('excerpt_length_label'),
      help: t('excerpt_length_help'),
      type: 'number',
      min: 40,
      max: 600,
      step: 20,
      placeholder: '280',
    }))
    .setting(() => ({
      setting: 'ernestdefoe-cascade.widget_trending',
      label: t('widget_trending_label'),
      help: t('widget_trending_help'),
      type: 'boolean',
    }))
    .setting(() => ({
      setting: 'ernestdefoe-cascade.engagement_bar',
      label: t('engagement_bar_label'),
      help: t('engagement_bar_help'),
      type: 'select',
      options: {
        auto: t('engagement_bar_auto'),
        on: t('engagement_bar_on'),
        off: t('engagement_bar_off'),
      },
      default: 'auto',
    })),
];
