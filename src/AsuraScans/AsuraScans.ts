// API, Astro serialization and tile mapping adapted from Nicartjay/PaperbackExt (MIT).
// The request, model and native canvas integration targets Paperback 0.8.7.
import {
  Source, SourceInfo, ContentRating, SourceIntents, SourceManga, Chapter,
  ChapterDetails, SearchRequest, PagedResults, PartialSourceManga, Request, Response
} from '@paperback/types'

const BASE = 'https://asurascans.com'
const API = 'https://api.asurascans.com/api'
const LIMIT = 20
type RecordValue = Record<string, unknown>
type TileMap = { tiles: number[]; tileCols: number; tileRows: number }
const object = (x: unknown): x is RecordValue => !!x && typeof x === 'object' && !Array.isArray(x)
const string = (x: unknown): string => typeof x === 'string' ? x.trim() : ''

function imageURL(value: unknown): string {
  const url = string(value)
  if (url.startsWith('//')) return 'https:' + url
  if (/^https?:\/\/[^/\s]+(?:\/|$)/i.test(url)) return url
  if (url.startsWith('/') && !url.startsWith('//')) return BASE + url
  return ''
}
function checkedID(value: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value)) throw new Error('Invalid Asura Scans ID')
  return value
}
function chapterNumber(value: string): string {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error('Invalid Asura Scans chapter ID')
  return value
}
function unwrapAstro(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 1 && Number.isInteger(value[0])) return null
    if (value.length === 2 && Number.isInteger(value[0])) return unwrapAstro(value[1])
    return value.map(unwrapAstro)
  }
  if (object(value)) {
    const result: RecordValue = {}
    for (const key of Object.keys(value)) result[key] = unwrapAstro(value[key])
    return result
  }
  return value
}
function tileMap(value: unknown): TileMap {
  if (!object(value)) throw new Error('Asura Scans image tile metadata is invalid.')
  const { tiles, tileCols, tileRows } = value
  if (!Array.isArray(tiles) || typeof tileCols !== 'number' || typeof tileRows !== 'number'
    || !Number.isInteger(tileCols) || !Number.isInteger(tileRows)
    || tileCols < 1 || tileRows < 1 || tileCols * tileRows > 1024
    || tiles.length !== tileCols * tileRows
    || tiles.some(x => !Number.isInteger(x) || x < 0 || x >= tiles.length)
    || new Set(tiles).size !== tiles.length) {
    throw new Error('Asura Scans image tile map is invalid.')
  }
  return { tiles: tiles as number[], tileCols, tileRows }
}
function restoreImage(response: Response): Response {
  const fragment = response.request.url.split('#')[1] ?? ''
  if (!/^(?:%7B|\{)/i.test(fragment)) return response
  if (response.status < 200 || response.status >= 300) throw new Error('Asura Scans image returned HTTP ' + response.status)
  const map = tileMap(JSON.parse(decodeURIComponent(fragment)))
  if (!response.rawData) throw new Error('Asura Scans image data is missing.')
  if (typeof App.createPBImage !== 'function' || typeof App.createPBCanvas !== 'function') {
    throw new Error('Asura Scans tiled images require Paperback 0.8 native canvas support.')
  }
  const image = App.createPBImage({ data: response.rawData })
  const width = Math.floor(image.width / map.tileCols)
  const height = Math.floor(image.height / map.tileRows)
  if (width < 1 || height < 1) throw new Error('Asura Scans image dimensions are invalid.')
  const canvas = App.createPBCanvas()
  // The site's tile algorithm uses equal-sized cells, dropping trailing partial pixels.
  canvas.setSize(width * map.tileCols, height * map.tileRows)
  map.tiles.forEach((destination, source) => {
    canvas.drawImage(image, (source % map.tileCols) * width, Math.floor(source / map.tileCols) * height,
      width, height, (destination % map.tileCols) * width, Math.floor(destination / map.tileCols) * height)
  })
  const data = canvas.encode('image/jpeg')
  if (!data) throw new Error('Asura Scans could not reconstruct the chapter image.')
  response.rawData = data
  return response
}

export const AsuraScansInfo: SourceInfo = {
  version: '1.0.0', name: 'Asura Scans', icon: 'icon.png', author: 'akram-lightrx',
  description: 'Asura Scans public manga chapters, search and browse for Paperback 0.8.',
  contentRating: ContentRating.EVERYONE, websiteBaseURL: BASE, language: 'en',
  sourceTags: [], intents: SourceIntents.MANGA_CHAPTERS
}
export class AsuraScans extends Source {
  requestManager = App.createRequestManager({
    requestsPerSecond: 2, requestTimeout: 30000,
    interceptor: {
      interceptRequest: async (request: Request): Promise<Request> => {
        request.headers = { ...request.headers, Referer: BASE + '/', Origin: BASE,
          Accept: 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.5' }
        const ua = await this.requestManager.getDefaultUserAgent()
        if (ua) request.headers['User-Agent'] = ua
        return request
      },
      interceptResponse: async (response: Response): Promise<Response> => restoreImage(response)
    }
  })
  private async fetch(url: string): Promise<string> {
    const response = await this.requestManager.schedule(App.createRequest({ url, method: 'GET' }), 1)
    if (response.status < 200 || response.status >= 300) throw new Error('Asura Scans returned HTTP ' + response.status + '. Open the website to check access.')
    if (typeof response.data !== 'string') throw new Error('Asura Scans returned an empty response.')
    return response.data
  }
  private astro(html: string, matches: (value: RecordValue) => boolean): RecordValue | undefined {
    const $ = this.cheerio.load(html)
    for (const element of $('astro-island[props]').toArray()) {
      try {
        const data = unwrapAstro(JSON.parse($(element).attr('props') ?? ''))
        if (object(data) && matches(data)) return data
      } catch { /* unrelated or malformed island */ }
    }
    return undefined
  }
  getMangaShareUrl(id: string): string { return BASE + '/comics/' + checkedID(id) }
  async getSearchResults(query: SearchRequest, metadata: unknown): Promise<PagedResults> {
    const rawPage = object(metadata) ? metadata.page : undefined
    const page = typeof rawPage === 'number' && Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
    const title = query.title?.trim() ?? ''
    const url = API + '/series?offset=' + (page - 1) * LIMIT + '&limit=' + LIMIT
      + (title ? '&search=' + encodeURIComponent(title) : '&sort=latest&order=desc')
    let data: unknown
    try { data = JSON.parse(await this.fetch(url)) } catch (error) {
      if (error instanceof Error && /HTTP /.test(error.message)) throw error
      throw new Error('Asura Scans search response is unavailable or invalid JSON.')
    }
    if (!object(data) || !Array.isArray(data.data) || !object(data.meta) || typeof data.meta.has_more !== 'boolean') {
      throw new Error('Asura Scans search response is invalid.')
    }
    const results: PartialSourceManga[] = []
    const seen = new Set<string>()
    for (const item of data.data) {
      if (!object(item)) continue
      const publicURL = string(item.public_url).split(/[?#]/)[0] ?? ''
      const id = publicURL.split('/').filter(Boolean).pop() || string(item.slug)
      if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) continue
      const name = string(item.title), image = imageURL(item.cover)
      if (!name || !image || seen.has(id)) continue
      seen.add(id)
      results.push(App.createPartialSourceManga({ mangaId: id, title: name, image }))
    }
    if (data.data.length && !results.length) throw new Error('Asura Scans search response has no valid series.')
    return App.createPagedResults({ results, metadata: results.length && data.meta.has_more ? { page: page + 1 } : undefined })
  }
  async getMangaDetails(id: string): Promise<SourceManga> {
    const series = this.astro(await this.fetch(this.getMangaShareUrl(id)), x => !!string(x.title) && !!imageURL(x.coverUrl))
    if (!series) throw new Error('Asura Scans manga details are unavailable. Check the website.')
    const status = string(series.status).toLowerCase()
    const desc = this.cheerio.load(string(series.description)).root().text().trim()
    return App.createSourceManga({ id, mangaInfo: App.createMangaInfo({
      titles: [string(series.title)], image: imageURL(series.coverUrl), desc,
      author: string(series.author), artist: string(series.artist),
      status: status === 'ongoing' ? 'ONGOING' : status === 'completed' ? 'COMPLETED' : 'UNKNOWN'
    }) })
  }
  async getChapters(id: string): Promise<Chapter[]> {
    const data = this.astro(await this.fetch(this.getMangaShareUrl(id)), x => Array.isArray(x.chapters))
    if (!data) throw new Error('Asura Scans chapter list is unavailable. Check the website.')
    const chapters: Chapter[] = [], seen = new Set<string>()
    for (const item of data.chapters as unknown[]) {
      if (!object(item) || typeof item.number !== 'number' || !Number.isFinite(item.number) || item.number < 0) continue
      if (item.is_premium === true || item.is_locked === true || Date.parse(string(item.early_access_until)) > Date.now()) continue
      const chapterId = String(item.number)
      if (seen.has(chapterId)) continue
      seen.add(chapterId)
      const date = new Date(string(item.published_at) || string(item.created_at))
      chapters.push(App.createChapter({
        id: chapterId, chapNum: item.number, langCode: 'en',
        name: 'Chapter ' + chapterId + (string(item.title) ? ' - ' + string(item.title) : ''),
        time: Number.isNaN(date.getTime()) ? new Date(0) : date, sortingIndex: item.number
      }))
    }
    return chapters.sort((a, b) => b.chapNum - a.chapNum)
  }
  async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
    const url = this.getMangaShareUrl(mangaId) + '/chapter/' + chapterNumber(chapterId)
    const data = this.astro(await this.fetch(url), x => Array.isArray(x.pages) && x.pages.length > 0)
    if (!data) throw new Error('Asura Scans chapter images are unavailable. The chapter may require membership or early access.')
    const pages: string[] = []
    for (const item of data.pages as unknown[]) {
      if (!object(item) || !imageURL(item.url)) throw new Error('Asura Scans chapter contains an invalid image.')
      let page = imageURL(item.url)
      if (Array.isArray(item.tiles) && item.tiles.length) {
        const map = tileMap({ tiles: item.tiles, tileCols: item.tile_cols ?? 4, tileRows: item.tile_rows ?? 5 })
        page = page.split('#')[0] + '#' + encodeURIComponent(JSON.stringify(map))
      }
      pages.push(page)
    }
    return App.createChapterDetails({ id: chapterId, mangaId, pages })
  }
}
