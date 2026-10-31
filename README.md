# Yaksha Comics — Paperback 0.8

A repaired continuation of the original `yaksha-paperback-08.zip`, with selected Madara logic adapted from Nicartjay's 0.9 extension. The extension retains the `YakshaComics` source ID and existing manga/chapter slug IDs.

**Target:** Paperback 0.8. Built with the official `@paperback/types` and `@paperback/toolchain` **0.8.7**. This is not a 0.9 extension.

## Install

Open **https://akram-lightrx.github.io/yaksha-paperback-08/** in Safari and tap **Add to Paperback**. Alternatively add that URL in Paperback's external source repository settings, then install **Yaksha Comics**.

Build, live-site and iPhone validation are tracked in [VALIDATION.md](docs/VALIDATION.md).

Search by title, or submit an empty search to browse recent updates. Scroll for more results. This version provides search/browse rather than a dedicated Home carousel.

The source retains the original **Mature** content rating; if it is hidden, check Paperback's source content visibility settings.

## Features

- Search and paginated browsing, with covers.
- Manga details, authors/artists, synopsis and status.
- Inline chapter lists and the modern Madara AJAX fallback.
- Reader-only images in reading order, lazy-image support and highest-resolution srcset selection.
- Conditional list-style reader for single-page/paginated chapters.
- Clear errors for missing details, chapter lists and images.

## Build and test

Use Node.js 22 and npm:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run test:live
```

`npm run build` type-checks, bundles and verifies the manifest, exports, icon and installation page. This explicit check is necessary because the official 0.8 bundler can exit successfully despite an invalid source manifest.

In an environment where the official Node polyfill's Axios transport fails but curl works, use `npm run test:live -- --curl`. This still runs the same compiled extension and request interceptor against live HTML; only the development HTTP transport changes. It does not prove iOS networking compatibility.

`npm run serve` starts the official local development server. `bundles/` contains the installable static repository, including `versioning.json`, `YakshaComics/source.js`, its `includes/` assets, and the installation homepage.

## Publishing

The public repository is [akram-lightrx/yaksha-paperback-08](https://github.com/akram-lightrx/yaksha-paperback-08). GitHub Pages uses **GitHub Actions**. Pushes to `main` run the included workflow to build, test and deploy `bundles/`. Forks using other owners/repository names must also update `baseURL` in `package.json`.

Only extension code/assets are hosted. Reading requests go to Yaksha Comics; the repository does not host comic pages or credentials.

## Compatibility and limitations

Final installation, source visibility, covers and reading must be checked in Paperback 0.8 on an iPhone. Site markup can change. Login/paywalled chapters and novel-only or encrypted readers are not implemented; sampled live chapters use ordinary public images. No automatic challenge solving is included.

## References and attribution

- [Official extension quick start](https://github.com/Paperback-iOS/website/blob/master/src/contributing/extension-development/quick-start.md)
- [Official parsing guide](https://github.com/Paperback-iOS/website/blob/master/src/contributing/extension-development/reference/parsing-guide.md)
- [Official Paperback 0.8 example dependencies](https://github.com/Paperback-iOS/extensions/blob/main/package.json)
- [Nicartjay's Yaksha source](https://github.com/Nicartjay/PaperbackExt/blob/0.9/stable/src/YakshaComics/main.ts)
- [Nicartjay's shared Madara implementation](https://github.com/Nicartjay/PaperbackExt/blob/0.9/stable/src/utils/madara/template.ts)
- [Adaptation and licence notices](THIRD_PARTY_NOTICES.md)

The website's older narrative examples include pre-0.8 names; implementation signatures were checked against the installed official 0.8.7 type definitions.
