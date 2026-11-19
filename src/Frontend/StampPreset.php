<?php

/*
 * Cascade — a social-feed theme for Flarum 2.
 */

namespace ErnestDefoe\Cascade\Frontend;

use ErnestDefoe\Cascade\Presets;
use Flarum\Frontend\Document;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Stamp the active preset onto <html>, the same way core stamps `data-theme`
 * and `data-colored-header`.
 *
 * Doing it server-side matters for two reasons: the attribute is present in
 * the very first byte of HTML, so there is no flash of the other preset before
 * JS runs; and a frontend initializer CANNOT read this setting anyway, because
 * Application::boot() runs every initializer BEFORE it assigns `app.forum`.
 *
 * Core passes the request too, so the stamp can be the READER'S choice rather
 * than one value for the whole forum.
 */
class StampPreset
{
    public function __construct(
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function __invoke(Document $document, Request $request): void
    {
        $document->extraAttributes['data-cascade-preset'] = Presets::valid($this->preset($request));
    }

    protected function preset(Request $request): mixed
    {
        $preset = $this->settings->get('ernestdefoe-cascade.preset');

        if (! $this->settings->get('ernestdefoe-cascade.allow_user_preset')) {
            return $preset;
        }

        $actor = RequestUtil::getActor($request);

        // Guests have no preferences to read; they get the forum's. An empty
        // preference means "follow the forum", which is the picker's first
        // option - not a value to fall back from.
        $chosen = $actor->exists ? $actor->getPreference('cascadePreset') : null;

        return is_string($chosen) && $chosen !== '' ? $chosen : $preset;
    }
}
