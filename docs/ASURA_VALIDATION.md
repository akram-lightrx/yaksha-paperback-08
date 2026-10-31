# Asura Scans validation

Target: Paperback types/toolchain **0.8.7**; source **AsuraScans 1.0.0**.

## Automated verification

- Yaksha code and its 13 tests are unchanged.
- 11 Asura tests cover API pagination and null empty responses, Astro details and ordered pages, premium/early-access filtering, decimal chapters, HTTP/schema errors, invalid identifiers, tile mapping and reconstructed image MIME.
- Initial Asura tests failed before implementation (Actions run 41252975839), while Yaksha tests passed.
- Two additional failures reproduced the live null-list response and reconstructed image MIME mismatch (run 41253364500). Both passed after the fixes.
- TypeScript, bundle verification and **all 24 tests passed** in [run 41253436535](https://github.com/akram-lightrx/yaksha-paperback-08/actions/runs/41253436535).
- Independent review found no implementation blockers. Its tile-direction test recommendation was addressed with a non-self-inverse permutation.
- No production dependency was added.

## Live validation

The compiled extension was tested through its request/response interceptors with Node fetch. See [recorded results](asura-live-test-results.json).

- Browse: two distinct pages of 20 titles.
- Keyword search: two distinct pages of 20 results.
- Nonsense search: no results, pagination stopped.
- Overgeared: details, cover and 347 chapters; chapters 346 and 0 returned 21 and 19 images.
- SSS-Class Suicide Hunter: details, cover and 157 chapters; chapters 157 and 1 returned 16 and 18 images.
- Ten actual cover/page image responses returned HTTP 200, image content types and valid WebP signatures.
- The four sampled readers had no tile maps. Tiled image reconstruction is covered by the pixel-grid unit test, not by those live reader samples.

## Publication

Refresh https://akram-lightrx.github.io/yaksha-paperback-08/ in Paperback's repository list, then install **Asura Scans**. GitHub Actions builds and tests before deployment and verifies both public bundles, both PNG icons, the manifest and the installation page after deployment. The latest main-branch workflow run records publication status.

## Required iPhone checks

1. Refresh the existing source repository and install Asura Scans.
2. Search for Overgeared, open the latest public chapter and chapter 0, and scroll to the last page.
3. Confirm covers and full-page images, then reopen Paperback and confirm loading still works.
4. Repeat with SSS-Class Suicide Hunter; submit an empty search and load another page.

The old Node polyfills do not implement native PBImage/PBCanvas. Tests verify tile draw coordinates and output pixels through a minimal canvas double. Native iPhone decoding, image-interceptor behavior and fragment retention remain unverified. If a tiled chapter fails, record the title/chapter, app version, source version and displayed error.
