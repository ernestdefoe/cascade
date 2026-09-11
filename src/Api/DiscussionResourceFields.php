<?php

/*
 * Cascade — a social-feed theme for Flarum 2.
 */

namespace ErnestDefoe\Cascade\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Post\CommentPost;
use Flarum\Settings\SettingsRepositoryInterface;
use s9e\TextFormatter\Utils;

/**
 * Two computed fields that turn a discussion list row into a feed card.
 *
 * Both read the first post's *stored* formatter XML — the intermediate
 * representation s9e/text-formatter writes at post time. `parsed_content`
 * hands that back verbatim, unlike `content` (which runs an unparse back to
 * markdown) or `formatContent()` (which runs a full render). Neither field
 * touches the formatter at all.
 *
 * Both are listing-only. On a single discussion the frontend already has the
 * real first post, so computing an excerpt there would be waste.
 */
class DiscussionResourceFields
{
    /**
     * Hard ceiling on the excerpt, whatever the operator configures. Long
     * enough for four or five lines in either preset; short enough that a
     * page of 20 rows adds single-digit kilobytes to the payload.
     */
    public const MAX_EXCERPT = 600;

    public function __invoke(): array
    {
        // Resolved here rather than injected into the constructor: the
        // container invokes this class with no arguments, so a typed
        // constructor parameter would throw ArgumentCountError at boot.
        $settings = resolve(SettingsRepositoryInterface::class);

        $length = (int) $settings->get('ernestdefoe-cascade.excerpt_length', 280);
        $length = max(40, min(self::MAX_EXCERPT, $length));

        $density = (string) $settings->get('ernestdefoe-cascade.feed_density', 'excerpt_media');

        return [
            Schema\Str::make('cascadeExcerpt')
                ->visible(fn (Discussion $discussion, Context $context) => $context->listing() && $density !== 'title')
                ->get(function (Discussion $discussion) use ($length): ?string {
                    $xml = $this->firstPostXml($discussion);

                    if ($xml === null) {
                        return null;
                    }

                    $text = Utils::removeFormatting($this->stripAttachments($xml));

                    // Collapse the whitespace a multi-paragraph post carries so
                    // the row shows prose rather than a column of blank lines.
                    $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');

                    if ($text === '') {
                        return null;
                    }

                    return $this->truncate($text, $length);
                }),

            Schema\Str::make('cascadeImage')
                ->visible(fn (Discussion $discussion, Context $context) => $context->listing() && $density === 'excerpt_media')
                ->get(function (Discussion $discussion): ?string {
                    $xml = $this->firstPostXml($discussion);

                    if ($xml === null) {
                        return null;
                    }

                    foreach ($this->imageUrls($xml) as $src) {
                        return $src;
                    }

                    return null;
                }),

            // The most recent reply, previewed under the row the way a social
            // feed shows its latest comment. Author, avatar and timestamp all
            // come from `lastPostedUser`, which core ALREADY default-includes
            // on this endpoint - so the only thing missing was the text, and
            // that is what this adds.
            Schema\Str::make('cascadeLastReply')
                ->visible(fn (Discussion $discussion, Context $context) => $context->listing())
                ->get(function (Discussion $discussion): ?string {
                    $xml = $this->lastReplyXml($discussion);

                    if ($xml === null) {
                        return null;
                    }

                    $text = trim(preg_replace(
                        '/\s+/u',
                        ' ',
                        Utils::removeFormatting($this->stripAttachments($xml))
                    ) ?? '');

                    return $text === '' ? null : $this->truncate($text, 180);
                }),

            Schema\Integer::make('cascadeImageCount')
                ->visible(fn (Discussion $discussion, Context $context) => $context->listing() && $density === 'excerpt_media')
                ->get(function (Discussion $discussion): int {
                    $xml = $this->firstPostXml($discussion);

                    if ($xml === null) {
                        return 0;
                    }

                    return count($this->imageUrls($xml));
                }),
        ];
    }

    /**
     * The stored formatter XML of the discussion's first post, or null when
     * there isn't one to read.
     *
     * `relationLoaded` is checked rather than just reading the relation: if the
     * eager load in extend.php ever stops matching (a renamed endpoint, another
     * extension replacing the index query), touching `$discussion->firstPost`
     * would lazily fire one query *per row*. Returning null instead degrades
     * the feed to a title-only list — visibly wrong, but not an N+1 in
     * production.
     */
    protected function firstPostXml(Discussion $discussion): ?string
    {
        if (! $discussion->relationLoaded('firstPost')) {
            return null;
        }

        $post = $discussion->getRelation('firstPost');

        if (! $post instanceof CommentPost) {
            return null;
        }

        $xml = $post->parsed_content;

        return is_string($xml) && $xml !== '' ? $xml : null;
    }

    /**
     * The stored XML of the discussion's most recent reply, or null when there
     * isn't one to show.
     *
     * "Reply" means a comment that is not the opening post: a discussion nobody
     * has answered has lastPost === firstPost, and previewing the opening post
     * underneath its own excerpt would just print it twice.
     */
    protected function lastReplyXml(Discussion $discussion): ?string
    {
        if (! $discussion->relationLoaded('lastPost')) {
            return null;
        }

        $post = $discussion->getRelation('lastPost');

        if (! $post instanceof CommentPost) {
            return null;
        }

        if ((int) $post->id === (int) $discussion->first_post_id) {
            return null;
        }

        $xml = $post->parsed_content;

        return is_string($xml) && $xml !== '' ? $xml : null;
    }

    /**
     * Every image URL in a post, in the order a reader would meet them.
     *
     * Two sources, because there are two ways an image gets into a Flarum post:
     * fof/upload attachments (an UPL-IMAGE-PREVIEW tag) and plain markdown or
     * BBCode images (an IMG tag). Attachments come first because a post that
     * has both almost always leads with the uploaded file.
     *
     * The thumbnail is preferred over the full-size file: this is a 576px card
     * in a list of twenty, not a lightbox.
     *
     * @return list<string>
     */
    protected function imageUrls(string $xml): array
    {
        $candidates = array_merge(
            Utils::getAttributeValues($xml, 'UPL-IMAGE-PREVIEW', 'thumbnail_url'),
            Utils::getAttributeValues($xml, 'UPL-IMAGE-PREVIEW', 'url'),
            Utils::getAttributeValues($xml, 'IMG', 'src')
        );

        $urls = [];

        foreach ($candidates as $url) {
            if (is_string($url) && $url !== '' && $this->isSafeImageUrl($url) && ! in_array($url, $urls, true)) {
                $urls[] = $url;
            }
        }

        return $urls;
    }

    /**
     * Remove attachment tags before the XML is flattened to text.
     *
     * `Utils::removeFormatting()` returns what the author *typed*, and for an
     * fof/upload attachment that is the literal placeholder
     * `[upl-image-preview uuid=... url=... thumbnail_url=...]`. Left in, every
     * excerpt of a post with a screenshot opens with a wall of UUIDs and URLs
     * instead of a sentence. The image is rendered separately by cascadeImage,
     * so nothing is lost by dropping the marker here.
     */
    protected function stripAttachments(string $xml): string
    {
        foreach (['UPL-IMAGE-PREVIEW', 'UPL-FILE'] as $tag) {
            $xml = Utils::removeTag($xml, $tag);
        }

        return $xml;
    }

    /**
     * Truncate on a word boundary, then add an ellipsis only if anything was
     * actually removed.
     */
    protected function truncate(string $text, int $length): string
    {
        if (mb_strlen($text) <= $length) {
            return $text;
        }

        $cut = mb_substr($text, 0, $length);
        $lastSpace = mb_strrpos($cut, ' ');

        // Guard against a single very long token (a URL, a CJK run with no
        // spaces) collapsing the excerpt to almost nothing.
        if ($lastSpace !== false && $lastSpace > $length * 0.6) {
            $cut = mb_substr($cut, 0, $lastSpace);
        }

        return rtrim($cut).'…';
    }

    /**
     * Only http(s) and root-relative URLs reach the frontend. The XML is
     * author-supplied, and this value goes straight into an `<img src>`, so a
     * `javascript:` or `data:` payload must not survive the trip.
     */
    protected function isSafeImageUrl(string $url): bool
    {
        if (str_starts_with($url, '/') && ! str_starts_with($url, '//')) {
            return true;
        }

        $scheme = parse_url($url, PHP_URL_SCHEME);

        return in_array($scheme, ['http', 'https'], true);
    }
}
