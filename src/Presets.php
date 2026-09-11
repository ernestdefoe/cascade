<?php

/*
 * This file is part of ernestdefoe/cascade.
 */

namespace ErnestDefoe\Cascade;

/**
 * The list of presets, in one place.
 *
 * It is referenced by the document stamp, the user preference transformer and
 * the admin setting. Three copies of the same array is how a fourth preset gets
 * added everywhere except the one spot that silently rejects it.
 *
 * 🚨 These keys are STORED, in settings rows and in user preferences. They are
 * deliberately not the platform names shown in the UI: renaming a key here
 * would reset every forum and every member to the default without warning, and
 * without anything in a log to explain it. Labels are translatable strings and
 * can change freely; these cannot.
 */
abstract class Presets
{
    public const WALL = 'wall';
    public const TIMELINE = 'timeline';
    public const STREAM = 'stream';

    public const DEFAULT = self::WALL;

    /** @return list<string> */
    public static function all(): array
    {
        return [self::WALL, self::TIMELINE, self::STREAM];
    }

    /**
     * Coerce anything to a preset that actually has a stylesheet.
     *
     * A stale value from an older version, or one typed into the database by
     * hand, must not reach the `data-cascade-preset` attribute: no token block
     * matches it, so every colour falls back to inheritance and the forum
     * renders unstyled text on an unstyled ground.
     */
    public static function valid(mixed $preset): string
    {
        return in_array($preset, self::all(), true) ? (string) $preset : self::DEFAULT;
    }
}
