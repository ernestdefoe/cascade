import { extend } from 'flarum/common/extend';

/**
 * Tell the browser to leave avatar initials alone.
 *
 * 🚨 This is not a hypothetical. A user called Ernest renders as a circle
 * containing "E". Read a Spanish forum with Chrome's translation on and "e" is
 * a Spanish conjunction meaning "and" — so every avatar on the page turned
 * into a circle containing the word "AND", overflowing its own border. It
 * looked exactly like a broken stylesheet, which is how it was reported.
 *
 * Any single letter is a word in some language: "a", "y", "o", "e", "i".
 * Initials are identity, not prose, and machine translation has no business in
 * them. `translate="no"` is the standard attribute for saying so and Chrome
 * honours it.
 *
 * 🚨 Extended by module PATH rather than by importing Avatar. The import form
 * resolves at boot and throws if the component has not been registered yet,
 * which takes down every page rather than one component — the same trap that
 * bit the settings-page picker.
 */
export default function dontTranslateAvatars() {
  extend('flarum/common/components/Avatar', 'view', function (vnode) {
    if (!vnode || typeof vnode !== 'object' || !vnode.attrs) return;

    /*
     * 🚨 The CLASS, not `translate="no"`.
     *
     * `HTMLElement.translate` is a BOOLEAN property, and Mithril sets known
     * properties directly rather than writing attributes. So
     * `attrs.translate = 'no'` assigns a non-empty string to a boolean, which
     * is truthy, and the element comes out as `translate="yes"` — the exact
     * opposite of what was asked for, silently. Measured: 70 avatars, every
     * one of them `translate=yes`.
     *
     * `notranslate` is a plain class with no property of that name to collide
     * with, it survives Mithril untouched, and it is the opt-out Chrome's
     * translator documents.
     */
    const existing = vnode.attrs.className;

    vnode.attrs.className = existing ? existing + ' notranslate' : 'notranslate';
  });
}
