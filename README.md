# Octovix / BlueLog landing page

Marketing site for BlueLog, the Octovix nutrition tracker for iPhone.

Plain static HTML, CSS and one small JavaScript file. No build step, no
framework, no dependencies. Open `index.html` or run the preview server and it
works.

```bash
python3 serve.py    # http://127.0.0.1:4321
```

## What is here

```
index.html            the landing page
privacy.html          placeholder legal pages, see "Before launch" below
terms.html
cookies.html
assets/css/styles.css single stylesheet, design tokens at the top
assets/js/main.js     nav, scroll reveal, email signup
assets/fonts/         Plus Jakarta Sans, self hosted (49 KB total)
assets/img/           logo, mascot, favicon, social card
assets/img/screens/   app screenshots, WebP
serve.py              local preview only, not needed in production
```

Total page weight is roughly 240 KB on first load, including fonts and both
screenshots.

## Connect the email signup

The two signup forms currently do nothing except validate the address. Until an
endpoint is set they tell the visitor "Email signup is not connected yet" and
log a warning to the console.

To turn them on, set `data-endpoint` on both forms in `index.html` (one in the
hero, one in the `#notify` section):

```html
<form class="signup" data-signup data-endpoint="https://your-endpoint" novalidate>
```

The form POSTs `{"email": "..."}` as JSON and treats any 2xx as success, which
works directly with Formspree, Buttondown, ConvertKit and most form backends.
Loading, success and error states are already implemented in
`assets/js/main.js`.

## Before launch

Search the project for `[` to find every placeholder. The important ones:

- **Legal pages.** `privacy.html`, `terms.html` and `cookies.html` are written
  to describe what the site actually does, but company name, registered
  address, contact address, hosting provider and jurisdiction are all bracketed
  placeholders. Have someone qualified review them. They are not legal advice.
- **Contact address.** The footer links to the signup section because no support
  address was supplied. There is a `TODO` comment in `index.html` marking where
  a real `mailto:` goes.
- **Domain.** No domain is invented anywhere. Once one exists, add
  `<link rel="canonical">`, `og:url` and `twitter:url` to `index.html`. There is
  a comment in the `<head>` marking the spot.
- **Legal pages are `noindex`** while they hold placeholder text. Remove that
  meta tag once the real wording lands.

## Cookies

The site sets no cookies, runs no analytics and loads nothing from a third
party, so there is no consent banner. If you add analytics, an embedded player
or a hosted form widget, update `cookies.html` and add a consent prompt at the
same time.

## Design notes

Everything is driven by tokens at the top of `styles.css`.

- **Palette.** `#1E4F8C` navy, `#3A8DFF` brand blue, `#BFD7FF` light blue,
  `#F5F6F7` page, `#121212` text. Blue is the only accent and is used on every
  section.
- **Contrast.** White on `#3A8DFF` only reaches 3.3:1, so the bright blue is
  used for large display type and surfaces, never as a background for small
  white text. Primary buttons use navy. On the blue band, body copy is
  near black. Every text and background pair on the site was checked against
  WCAG AA in both light and dark mode.
- **Dark mode** follows `prefers-color-scheme`. The primary button inverts to a
  light blue face with dark text, echoing the Save and Log food buttons in the
  app.
- **Radius.** Interactive controls are pills, containers are 20px, small
  details are 12px.
- **Motion** is limited to fades, small rises and hover states, all driven by
  IntersectionObserver rather than scroll listeners, and all disabled under
  `prefers-reduced-motion`.

The iPhone frames are pure CSS (`.phone` in `styles.css`). Proportions and
corner radii are traced from an iPhone 17 Pro screenshot, and since the
screenshots already contain the status bar and Dynamic Island, the frame only
supplies the enclosure. To swap a screenshot, drop a new image in
`assets/img/screens/` and keep the 1206:2622 aspect ratio.

## Deploying

Upload the folder. Any static host works: Netlify, Vercel, Cloudflare Pages,
GitHub Pages, S3. There is nothing to build.

`serve.py` and this README do not need to be uploaded.
