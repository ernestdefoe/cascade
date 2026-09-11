# Cascade — a social-feed theme for Flarum 2 (free, MIT, and it needs testers)

I've been building this for a while and it's finally in a state worth showing people. **Cascade** turns your discussion list into a feed.

Flarum shows you a title, an avatar, a tag and a reply count. Facebook and X show you the **post**. That one difference is the whole idea: the opening post's text and pictures go on the card, reactions go on the card, the latest reply goes on the card, and the full conversation opens in a modal over the top of the feed — so you never lose your place in the list.

![The feed in light mode](https://raw.githubusercontent.com/ernestdefoe/cascade/main/docs/screenshots/feed-light.png)

I was going to charge for this. I've decided not to. **It's MIT, it's free, and it's staying free.**

---

## What it does

**Two presets, picked in the admin.**

- **Wall** — cards on a grey ground, dense chrome, a wide labelled action bar. Aimed at forums where most visitors lurk and need the affordance spelled out.
- **Timeline** — no cards. One 600 px column between hairlines, a sticky tab strip, a quiet action bar. For busy forums where row count matters more.

![The Timeline preset](https://raw.githubusercontent.com/ernestdefoe/cascade/main/docs/screenshots/preset-timeline.png)

**Reactions on the card**, with the hover picker you already know — the emoji row unfurls, each one grows under the pointer and names itself, the one you pick lands with a pop. Long-press on touch. This is `fof/reactions` doing the work; Cascade just draws it.

![The reaction picker](https://raw.githubusercontent.com/ernestdefoe/cascade/main/docs/screenshots/reactions.png)

**The conversation in a modal.** Click the reply count and the whole discussion lifts over the feed — the full opening post, every reply, and a live typing indicator if you run `flarum/realtime`. The discussion page still exists and the modal links to it (it's the permalink every notification points at), you just rarely need it.

![The conversation modal](https://raw.githubusercontent.com/ernestdefoe/cascade/main/docs/screenshots/modal.png)

**Also in there:** an image mosaic that lays out 1, 2, 3, 4 or 5+ pictures the way a social feed does; inline *See more* / *See less* that grows the post's text without disturbing the images; a trending widget; and a proper dark mode.

![The feed in dark mode](https://raw.githubusercontent.com/ernestdefoe/cascade/main/docs/screenshots/feed-dark.png)

And it works on a phone.

---

## Install

```bash
composer require ernestdefoe/cascade
```

Then enable **Cascade** in your admin panel and pick a preset.

**Requirements:** Flarum `2.0.0-rc.8`+, PHP `8.3`+, and [`fof/reactions`](https://github.com/FriendsOfFlarum/reactions), which Composer pulls in for you.

---

## About performance, since somebody will ask

The expensive way to build a feed is to put a whole post in every list row — and the core team removed `firstPost` from the discussion-list endpoint for exactly that reason ([flarum/framework#4788](https://github.com/flarum/framework/pull/4788)). Cascade does **not** put it back.

It eager-loads the relation without serialising it, reads the stored formatter XML directly (`parsed_content` — never `content`, which unparses, or `formatContent()`, which renders), and ships a capped plain-text excerpt plus a few image URLs. Reaction counts come from the request-scoped memo `fof/reactions` already builds for every row's first post.

**Net cost: two eager loads per page of discussions. No migration, no new tables, no extra requests.**

---

## It also gets along with

Cascade implements none of these itself — it detects what you have and decorates it, and renders nothing where an extension is missing.

- `flarum/tags` — tag pills in the card's meta line. Tags normally *float* at tablet width with a 150 px cap, so a three-tag discussion shows one and a half of them; Cascade un-floats them so you see all of them.
- `flarum/realtime` — the typing indicator in the modal.
- `fof/upload` — attachments become the card's mosaic.
- `fof/forum-widgets-core` — your side widgets get adopted into Cascade's right rail instead of becoming a fourth column and blowing the layout out.
- `ernestdefoe/mobile-tab` — bottom tab bar on phones.

---

## This is version 0.1.0, and that number is honest

It works. It runs daily on my own forum. But it has not met *your* forum yet — your extensions, your tags, your content — and that's where the bugs are going to be. A few I already know about:

- The **discussion page** is only lightly restyled. The modal is the intended path; the full page still looks close to stock.
- **Mobile** works but has had less attention than desktop.
- **Timeline** has had less testing than Wall.
- The modal's reply button opens Flarum's real composer rather than an inline comment box.
- English only, though every string is translatable — there's no hardcoded text anywhere.

**Please install it and break it.** That's genuinely what this release is for. If something looks wrong, a screenshot plus your Flarum version, your enabled extensions and which preset you're on will get it fixed fast.

---

## Links

- **GitHub:** <https://github.com/ernestdefoe/cascade>
- **Packagist:** <https://packagist.org/packages/ernestdefoe/cascade>
- **Bug reports:** <https://github.com/ernestdefoe/cascade/issues>
- **Support forum:** <https://ernestdefoe.online>
- **Licence:** [MIT](https://github.com/ernestdefoe/cascade/blob/main/LICENSE)

Thanks for taking a look. 🌊
