# Validation status

- Original ZIP inspected and retained as the project baseline.
- Official development guide, parsing guide and 0.8.7 type definitions inspected.
- Nicartjay's YakshaComics 1.4.57.1 / Madara source inspected; compatible parsing logic adapted with MIT notice.
- Strict TypeScript and bundle validation pass.
- Thirteen regression tests pass, including AJAX loading, lazy images, image scoping and reader pagination.
- Live validation: 22 checks passed using the compiled extension and curl transport: two browse pages, successful/empty search, details and chapter lists for two series, four readers, and ten cover/page image downloads with image content types. See `live-test-results.json`.
- Additional pagination validation: keyword search spans distinct pages, and browsing stops after four pages / 62 unique titles. See `live-pagination-results.json`.
- Direct modern chapter endpoint check: HTTP 200 and 139 chapter entries for Infinite Evolution Starting From Zero.
- Independent code review completed; both Important findings fixed with tests that failed before each fix and pass afterward.
- Public repository created: https://github.com/akram-lightrx/yaksha-paperback-08. GitHub Actions build, tests and Pages deployment succeeded. The public manifest reports 0.8.7 / source 1.0.1; downloaded source and icon match the tested build byte-for-byte. Install: https://akram-lightrx.github.io/yaksha-paperback-08/.
- iPhone installation and reading: pending.

## Transport limitation

The official Node runtime polyfill's Axios requests returned HTTP 502 (`upstream failure`) in this development environment. Curl retrieved the same homepage with the Paperback user-agent and Referer successfully (HTTP 200). Live validation therefore also provides an explicit curl transport adapter. The extension's production code does not depend on curl; Paperback uses its native request manager.

## Required iPhone checks after publication

1. Add the repository URL and install Yaksha Comics in Paperback 0.8.
2. Search for `bone`; open Rebirth Of The Strongest White Bone Demon.
3. Confirm the cover, description and chapter list; open Chapter 26 and scroll to the final image.
4. Open Infinite Evolution Starting From Zero and test both newest and oldest chapters.
5. Browse using empty search and load another page; confirm new results appear.

If a check fails, record the Paperback version, extension version, title/chapter and exact displayed error. This is the remaining device verification, not a claim that the iPhone app has already been tested.
