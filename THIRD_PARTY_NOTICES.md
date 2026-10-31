# Third-party attribution

This existing Paperback 0.8 source incorporates adapted Madara parsing methods from [Nicartjay/PaperbackExt](https://github.com/Nicartjay/PaperbackExt), branch `0.9/stable` (tree `a6ef7b8f4f96b37327ab27429fdea7f9e5d8a658`, inspected 31 October 2026):

- `src/YakshaComics/main.ts`: modern chapter endpoint selection.
- `src/utils/madara/template.ts`: image attribute precedence and srcset selection; AJAX chapter fetching; conditional list-style reader; additional image containers.

The upstream source credits Nicartjay and Keiyoushi. Its MIT notice is reproduced below and distributed with the extension in `includes/Nicartjay-MIT-LICENSE.txt`.

Adaptation changes: Paperback 0.8 factories and request manager; preserved original manga/chapter slug identifiers; protocol-relative URL correction; reader-container scoping; local regression tests. We did not import the 0.9 runtime, generic multi-site settings, MadaraDex-specific authentication, novel rendering, or encrypted-reader code. The tested Yaksha pages expose ordinary chapter images.

Copyright 2024 Paperback Community

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


## Asura Scans

The Asura source adapts the public API routes, Astro serialized props, premium/early-access flags and tile mapping from [Nicartjay's AsuraScans source](https://github.com/Nicartjay/PaperbackExt/blob/0.9/stable/src/AsuraScans/main.ts), inspected at blob `07eec84d275d093260ab1b524293e73f88ba66b3`. The native 0.8 request/model/canvas integration is new. The MIT notice is also distributed in `src/AsuraScans/includes/Nicartjay-MIT-LICENSE.txt`. The Asura icon is an original simple monogram, not the site's logo.
