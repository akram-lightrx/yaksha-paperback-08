// Madara adaptations based on Nicartjay/PaperbackExt (MIT). See THIRD_PARTY_NOTICES.md.
import {
  Source, SourceInfo, ContentRating, SourceIntents, SourceManga, Chapter,
  ChapterDetails, SearchRequest, PagedResults, PartialSourceManga, Request, Response
} from '@paperback/types'
import type { AnyNode, Cheerio, CheerioAPI } from 'cheerio'

const BASE = 'https://yakshacomics.com'
const text = (value: string): string => value.replace(/\s+/g, ' ').trim()

// Avoid browser globals such as URL in Paperback's JavaScript runtime.
function absolute(value: string | undefined): string {
  const url = value?.trim() ?? ''
  if (!url || /^(?:data|javascript|blob):/i.test(url)) return ''
  if (url.startsWith('//')) return 'https:' + url
  if (/^https?:\/\//i.test(url)) return url
  return BASE + (url.startsWith('/') ? '' : '/') + url
}
function imageURL(image: Cheerio<AnyNode>): string {
  // Preserve upstream lazy-image priority; fix protocol-relative URLs via absolute().
  for (const attr of ['data-src', 'data-lazy-src']) {
    const url = absolute(image.attr(attr))
    if (url) return url
  }
  const candidates = (image.attr('srcset') ?? '').split(',').map(part => {
    const [url, descriptor] = part.trim().split(/\s+/)
    return { url: absolute(url), size: parseFloat(descriptor ?? '0') || 0 }
  }).filter(item => item.url).sort((a, b) => b.size - a.size)
  if (candidates[0]) return candidates[0].url
  for (const attr of ['data-cfsrc', 'data-manga-src', 'src']) {
    const url = absolute(image.attr(attr))
    if (url) return url
  }
  return ''
}
function mangaID(href: string | undefined): string | undefined {
  return /^https:\/\/yakshacomics\.com\/manga\/([^/?#]+)\/?(?:[?#].*)?$/.exec(absolute(href))?.[1]
}
function checkedID(id: string): string {
  if (!/^[a-z0-9_%.-]+$/i.test(id) || id === '.' || id === '..') throw new Error('Invalid Yaksha Comics ID')
  return id
}

export const YakshaComicsInfo: SourceInfo = {
  version: '1.0.1', name: 'Yaksha Comics', icon: 'icon.png', author: 'akram-lightrx',
  description: 'Yaksha Comics: search, browse, manga details and chapters for Paperback 0.8.',
  contentRating: ContentRating.MATURE, websiteBaseURL: BASE, language: 'en',
  sourceTags: [], intents: SourceIntents.MANGA_CHAPTERS
}

export class YakshaComics extends Source {
  requestManager = App.createRequestManager({
    requestsPerSecond: 2, requestTimeout: 20000,
    interceptor: {
      interceptRequest: async (request: Request): Promise<Request> => {
        request.headers = { Referer: BASE + '/', ...request.headers }
        return request
      },
      interceptResponse: async (response: Response): Promise<Response> => response
    }
  })
  private async fetch(url: string, method = 'GET', headers?: Record<string, string>): Promise<string> {
    const response = await this.requestManager.schedule(App.createRequest({ url, method, headers }), 1)
    if (response.status < 200 || response.status >= 300) {
      throw new Error('Yaksha Comics returned HTTP ' + response.status + '. Try opening the website in your browser.')
    }
    if (typeof response.data !== 'string') throw new Error('Yaksha Comics returned an empty response.')
    return response.data
  }
  getMangaShareUrl(id: string): string { return BASE + '/manga/' + checkedID(id) + '/' }
  async getMangaDetails(id: string): Promise<SourceManga> {
    const $ = this.cheerio.load(await this.fetch(this.getMangaShareUrl(id)))
    const title = text($('.post-title h1').first().text())
    const image = imageURL($('.summary_image img').first()) || absolute($('meta[property="og:image"]').attr('content'))
    if (!title || !image) throw new Error('Yaksha Comics manga details are unavailable. Check the title on the website.')
    let status = 'UNKNOWN'
    $('.post-status .post-content_item').each((_, element) => {
      if (/^status$/i.test(text($('.summary-heading', element).text()))) {
        const value = text($('.summary-content', element).text())
        status = /ongoing/i.test(value) ? 'ONGOING' : /complet/i.test(value) ? 'COMPLETED' : 'UNKNOWN'
      }
    })
    return App.createSourceManga({ id, mangaInfo: App.createMangaInfo({
      titles: [title], image, desc: text($('.summary__content').first().text()), status,
      author: text($('.author-content').text()), artist: text($('.artist-content').text())
    }) })
  }
  async getChapters(id: string): Promise<Chapter[]> {
    const mangaURL = this.getMangaShareUrl(id)
    let $ = this.cheerio.load(await this.fetch(mangaURL))
    // YakshaComics explicitly enables this modern endpoint in the 0.9 source.
    if (!$('.wp-manga-chapter > a').toArray().some(element => absolute($(element).attr('href')).startsWith(mangaURL))) {
      $ = this.cheerio.load(await this.fetch(mangaURL + 'ajax/chapters', 'POST', {
        'X-Requested-With': 'XMLHttpRequest', Referer: mangaURL
      }))
    }
    const chapters: Chapter[] = []
    const seen = new Set<string>()
    $('.wp-manga-chapter > a').each((_, element) => {
      const url = absolute($(element).attr('href')).split(/[?#]/)[0] ?? ''
      if (!url.startsWith(mangaURL)) return
      const chapterId = url.slice(mangaURL.length).replace(/\/$/, '')
      if (!chapterId || chapterId.includes('/') || seen.has(chapterId)) return
      const name = text($(element).text())
      const number = /(?:chapter|ch\.?)\s*(\d+(?:\.\d+)?)/i.exec(name)?.[1]
        ?? /chapter-(\d+(?:[.-]\d+)?)/i.exec(chapterId)?.[1]?.replace('-', '.')
      seen.add(chapterId)
      chapters.push(App.createChapter({ id: chapterId, name, chapNum: Number(number ?? 0), langCode: 'en', sortingIndex: -chapters.length }))
    })
    if (!chapters.length) throw new Error('Yaksha Comics chapter list is unavailable. Check the title on the website.')
    return chapters.sort((a, b) => b.chapNum - a.chapNum)
  }
  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    const url = this.getMangaShareUrl(mangaId) + checkedID(chapterId) + '/'
    let $ = this.cheerio.load(await this.fetch(url))
    if ($('#single-pager').length) $ = this.cheerio.load(await this.fetch(url + '?style=list'))
    const pages: string[] = []
    $('.reading-content img.wp-manga-chapter-img, .reading-content .page-break img, .reading-content .blocks-gallery-item img, .reading-content .text-left:not(:has(.blocks-gallery-item)) img').each((_, element) => {
      const url = imageURL($(element))
      if (url && !pages.includes(url)) pages.push(url)
    })
    if (!pages.length) throw new Error('Yaksha Comics chapter images are unavailable. Open the chapter on the website to check access.')
    return App.createChapterDetails({ id: chapterId, mangaId, pages })
  }
  private tiles($: CheerioAPI): PartialSourceManga[] {
    const results: PartialSourceManga[] = []
    const seen = new Set<string>()
    $('.page-item-detail, .c-tabs-item__content').each((_, element) => {
      const link = $('.post-title a', element).first()
      const id = mangaID(link.attr('href'))
      const title = text(link.text())
      const image = imageURL($('.item-thumb img, .tab-thumb img', element).first())
      if (!id || !title || !image || seen.has(id)) return
      seen.add(id)
      results.push(App.createPartialSourceManga({ mangaId: id, title, image }))
    })
    return results
  }
  async getSearchResults(query: SearchRequest, metadata: unknown): Promise<PagedResults> {
    const rawPage = (metadata as { page?: unknown } | undefined)?.page
    const page = typeof rawPage === 'number' && Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
    const title = query.title?.trim() ?? ''
    const url = title
      ? BASE + '/?s=' + encodeURIComponent(title) + '&post_type=wp-manga&paged=' + page
      : page === 1 ? BASE + '/' : BASE + '/page/' + page + '/'
    const $ = this.cheerio.load(await this.fetch(url))
    const results = this.tiles($)
    const emptyResult = $('p').toArray().some(element => /^No matches found\./i.test(text($(element).text())))
    if (!results.length && !emptyResult) throw new Error('Yaksha Comics search results are unavailable: unrecognised listing page. Check the website.')
    const hasNext = $('.nav-previous a, a.next.page-numbers, .wp-pagenavi a.nextpostslink').length > 0
    return App.createPagedResults({ results, metadata: results.length && hasNext ? { page: page + 1 } : undefined })
  }
}
