import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import FieldSet from 'flarum/common/components/FieldSet';
import Select from 'flarum/common/components/Select';
import { setting } from './settings';

/**
 * The keys stored in the `cascadePreset` preference.
 *
 * 🚨 Must match src/Presets.php. The PHP side runs every written value through
 * Presets::valid(), so a key that exists only here is silently rewritten to the
 * default on save — the picker appears to work and then snaps back, with
 * nothing logged. Adding a preset means touching both.
 */
const PRESETS = ['wall', 'timeline', 'stream'];

/**
 * Let a member pick which preset they read the forum in.
 *
 * Added to their own settings page, not the admin area: the admin setting
 * chooses the forum's default, this chooses the reader's. The empty option is a
 * real stored value meaning "follow the forum", so a member who has never
 * touched this — or who deliberately goes back to it — tracks the admin's
 * choice rather than being pinned to whatever it happened to be that day.
 */
export default function addPresetPicker() {
  /*
   * 🚨 The first argument is a module PATH, not an imported component.
   *
   * SettingsPage is code-split: it is not in the registry until someone
   * navigates to /settings. `import SettingsPage from '...'` compiles to a
   * registry lookup that runs at boot, which returns undefined, and
   * `extend(undefined.prototype, ...)` throws inside the initializer — taking
   * the whole forum down on every page, not just the settings page. Passing the
   * path defers the lookup until the chunk is actually loaded.
   */
  extend('flarum/forum/components/SettingsPage', 'settingsItems', function (items) {
    if (!setting('allow_user_preset')) return;

    const user = this.user;

    if (!user) return;

    const options = { '': app.translator.trans('ernestdefoe-cascade.forum.preset.follow_forum') };

    PRESETS.forEach((key) => {
      options[key] = app.translator.trans(`ernestdefoe-cascade.forum.preset.${key}`);
    });

    items.add(
      'cascadePreset',
      // Same shape core gives its own sections, so this reads as one of them
      // rather than as something bolted on underneath.
      <FieldSet
        className="Settings-cascadePreset FieldSet--min"
        label={app.translator.trans('ernestdefoe-cascade.forum.preset.heading')}
      >
        <Select value={user.preferences()?.cascadePreset ?? ''} options={options} onchange={(value) => apply(user, value)} />
        <span className="helpText">{app.translator.trans('ernestdefoe-cascade.forum.preset.help')}</span>
      </FieldSet>,
      // Core spaces its sections ten apart from 100 (account) down to 60
      // (colour scheme). 65 lands this with the other "how it looks to me"
      // settings, just above colour scheme.
      65
    );
  });
}

/**
 * Store the choice and show it immediately.
 *
 * The stamp on <html> is written server-side, so without the local write the
 * page the member is standing on keeps the old preset until they navigate —
 * which reads as the setting having failed. Applying it first also means the
 * preview stays honest if the save then fails: they see what they picked, and
 * the alert tells them it did not stick.
 */
function apply(user, value) {
  const previous = document.documentElement.getAttribute('data-cascade-preset');

  document.documentElement.setAttribute('data-cascade-preset', value === '' ? forumDefault() : value);

  user.savePreferences({ cascadePreset: value }).catch(() => {
    document.documentElement.setAttribute('data-cascade-preset', previous);

    app.alerts.show({ type: 'error' }, app.translator.trans('ernestdefoe-cascade.forum.preset.save_failed'));
  });
}

/** The forum-wide preset, for when a member chooses to follow it. */
function forumDefault() {
  const value = setting('preset');

  return PRESETS.includes(value) ? value : 'wall';
}
