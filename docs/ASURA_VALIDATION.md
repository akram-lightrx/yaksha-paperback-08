# Asura Scans validation

Target: Paperback types/toolchain 0.8.7; source AsuraScans 1.0.0.

- Preserved Yaksha source and its 13 regression tests.
- Added 10 Asura tests covering search/pagination, Astro details and two-page readers, premium filtering, decimal chapters, error responses, invalid identifiers and native canvas tile placement.
- All 10 Asura tests failed before implementation with the explicit missing-bundle assertion (Actions run 41252975839), while 13 Yaksha tests passed.
- TypeScript, bundle validation and all 23 tests passed after implementation (Actions run 41253094471).
- Initial live probe: HTTP 200 API, Overgeared details with 347 chapters, and chapter 0 with 19 image URLs.
- Broader compiled-source live validation and final review are pending; update before publication.

## iPhone checks

Refresh the existing source repository, install Asura Scans, search for Overgeared, and read the newest public chapter and chapter 0. Confirm covers, page order, full-page images and loading after reopening Paperback. Repeat for SSS-Class Suicide Hunter; test empty-search pagination.

The old Node polyfills do not implement native PBImage/PBCanvas. Unit tests verify the tile draw coordinates and output pixels through a minimal canvas double. Live tests validate image responses and metadata; they do not establish native iPhone decoding or image request fragment retention.
