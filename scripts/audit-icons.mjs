import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import axios from 'axios'
import sharp from 'sharp'
import LZString from 'lz-string'

const root = process.cwd()
const dbPath = path.join(root, 'data', 'db.json')
const iconDir = path.join(root, 'public', 'icons', 'sites')
const reportPath = path.join(root, 'reports', 'icon-audit.json')
const apply = process.argv.includes('--apply')
const concurrency = 14
const timeout = 7000

const client = axios.create({
  timeout,
  maxRedirects: 3,
  maxContentLength: 1024 * 1024,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavIconAudit/1.0)' },
  validateStatus: () => true,
})

function isSafeUrl(value) {
  try {
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return false
    const host = url.hostname.toLowerCase()
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    )
      return false
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
    if (host === '[::1]' || host === '::1') return false
    return true
  } catch {
    return false
  }
}

function siteUrl(value) {
  if (typeof value !== 'string') return null
  const candidate = value.replace(/^\^/, '').trim()
  return isSafeUrl(candidate) ? candidate : null
}

function decodeAttribute(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#38;', '&')
    .replaceAll('&quot;', '"')
}

function attribute(tag, name) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  )
  return decodeAttribute(match?.[1] || match?.[2] || match?.[3] || '')
}

function iconLinks(html, base) {
  const links = []
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = attribute(tag, 'rel').toLowerCase()
    if (!rel.includes('icon')) continue
    const href = attribute(tag, 'href')
    if (!href) continue
    try {
      const url = new URL(href, base).href
      if (isSafeUrl(url)) links.push(url)
    } catch {}
  }
  return [...new Set(links)]
}

async function request(url, options = {}) {
  if (!isSafeUrl(url)) return null
  try {
    return await client.get(url, { responseType: 'arraybuffer', ...options })
  } catch {
    return null
  }
}

async function imageData(url) {
  const response = await request(url)
  if (!response || response.status < 200 || response.status >= 300) return null
  const bytes = Buffer.from(response.data)
  if (bytes.length < 22 || bytes.length > 1024 * 1024) return null
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) {
    const firstSize = bytes.readUInt32LE(14)
    const firstOffset = bytes.readUInt32LE(18)
    if (
      bytes.readUInt16LE(4) > 0 &&
      firstOffset >= 22 &&
      firstOffset + firstSize <= bytes.length
    ) {
      return { bytes, ext: 'ico' }
    }
    return null
  }
  try {
    const metadata = await sharp(bytes).metadata()
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width < 8 ||
      metadata.height < 8
    )
      return null
    const png = await sharp(bytes, { density: 144 })
      .resize(64, 64, { fit: 'contain' })
      .png()
      .toBuffer()
    return { bytes: png, ext: 'png' }
  } catch {
    return null
  }
}

async function inspectSite(url) {
  if (!url) return { status: 'invalid-url', icons: [] }
  const response = await request(url, { maxContentLength: 512 * 1024 })
  if (!response) return { status: 'unavailable-or-blocked', icons: [] }
  const status =
    response.status >= 200 && response.status < 400
      ? 'reachable'
      : [401, 403, 429].includes(response.status)
        ? 'blocked-or-rate-limited'
        : `http-${response.status}`
  const contentType = String(response.headers['content-type'] || '')
  const html = contentType.includes('html')
    ? Buffer.from(response.data).toString('utf8')
    : ''
  return {
    status,
    icons: iconLinks(html, response.request?.res?.responseUrl || url),
  }
}

function collectSites(nodes, result = []) {
  for (const node of nodes || []) {
    if (Array.isArray(node.nav)) collectSites(node.nav, result)
    else if (node.url) result.push(node)
  }
  return result
}

async function pooled(items, work) {
  let index = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (index < items.length) {
        const current = index++
        await work(items[current], current)
        if ((current + 1) % 100 === 0)
          console.log(`Checked ${current + 1}/${items.length}`)
      }
    }),
  )
}

const raw = (await fs.readFile(dbPath, 'utf8')).trim()
const navs = JSON.parse(
  raw.startsWith('[') ? raw : LZString.decompressFromBase64(raw),
)
const sites = collectSites(navs)
const result = Array(sites.length)
const checkedIcons = new Map()
const checkedSites = new Map()
const iconAssets = new Map()

function cached(map, key, work) {
  if (!map.has(key)) map.set(key, work())
  return map.get(key)
}

await pooled(sites, async (site, index) => {
  const page = siteUrl(site.url)
  const originalIcon = typeof site.icon === 'string' ? site.icon.trim() : ''
  const existingLocal =
    originalIcon.startsWith('icons/sites/') ||
    originalIcon.startsWith('/icons/sites/')
  const localPresent = existingLocal
    ? await fs
        .stat(path.join(root, 'public', originalIcon.replace(/^\//, '')))
        .then((file) => file.isFile())
        .catch(() => false)
    : false
  const original = existingLocal ? null : siteUrl(originalIcon)
  const existingImage = original
    ? await cached(checkedIcons, original, () => imageData(original))
    : null
  const pageInfo = page
    ? await cached(checkedSites, page, () => inspectSite(page))
    : { status: 'invalid-url', icons: [] }
  const originalStatus = !originalIcon
    ? 'missing'
    : localPresent
      ? 'local'
      : existingImage
        ? 'valid'
        : 'broken'
  let chosen = existingImage
  let source = original

  if (!chosen && page) {
    const origin = new URL(page).origin
    const candidates = [
      ...pageInfo.icons,
      `${origin}/favicon.ico`,
      `${origin}/apple-touch-icon.png`,
      ...(new URL(page).hostname === 'github.com'
        ? ['https://github.com/favicon.ico']
        : []),
    ]
    for (const candidate of new Set(candidates)) {
      chosen = await cached(checkedIcons, candidate, () => imageData(candidate))
      if (chosen) {
        source = candidate
        break
      }
    }
  }

  let localIcon = localPresent ? originalIcon : null
  if (chosen) {
    const hash = createHash('sha256')
      .update(chosen.bytes)
      .digest('hex')
      .slice(0, 20)
    localIcon = `icons/sites/${hash}.${chosen.ext}`
    iconAssets.set(localIcon, chosen.bytes)
  }

  result[index] = {
    id: site.id,
    name: site.name,
    url: site.url,
    originalIcon,
    originalStatus,
    websiteStatus: pageInfo.status,
    resolvedIcon: localIcon,
    source,
  }
  if (apply && localIcon) site.icon = localIcon
})

const summary = {
  total: sites.length,
  originallyMissing: result.filter((item) => item.originalStatus === 'missing')
    .length,
  originallyBroken: result.filter((item) => item.originalStatus === 'broken')
    .length,
  originallyValid: result.filter(
    (item) =>
      item.originalStatus === 'valid' || item.originalStatus === 'local',
  ).length,
  resolved: result.filter((item) => item.resolvedIcon).length,
  unresolved: result.filter((item) => !item.resolvedIcon).length,
  websiteIssues: result.filter((item) => item.websiteStatus !== 'reachable')
    .length,
  cachedAssets: iconAssets.size,
}

await fs.mkdir(path.dirname(reportPath), { recursive: true })
await fs.writeFile(
  reportPath,
  JSON.stringify({ summary, sites: result }, null, 2) + '\n',
)
const websiteStatusText = {
  reachable: '页面可访问，但未找到可验证图标',
  'unavailable-or-blocked': '本次网络检查无法访问或被拦截',
  'blocked-or-rate-limited': '访问被拒绝或限流',
  'http-404': '页面返回 404',
  'http-502': '页面返回 502',
  'http-503': '页面返回 503',
}
const tableValue = (value) =>
  String(value || '')
    .replaceAll('|', '\\|')
    .replace(/[\r\n]+/g, ' ')
const markdown = [
  '# 导航图标审计报告',
  '',
  `审计范围：${summary.total} 个导航网站。原本缺少图标地址 ${summary.originallyMissing} 个；原有图标本次检查不可用 ${summary.originallyBroken} 个。最终为 ${summary.resolved} 个网站配置了已验证、缓存于本站的真实图片（共 ${summary.cachedAssets} 份资源）；${summary.unresolved} 个网站仍使用文字回退。`,
  '',
  '“网站检查异常”只是本次检查结果，可能由反爬、地区网络或临时故障造成，不代表网站永久失效。全部逐条原始结果见 [icon-audit.json](icon-audit.json)。',
  '',
  '## 仍无可验证图标的站点',
  '',
  '| 网站 | 原图标 | 网站检查结果 |',
  '| --- | --- | --- |',
  ...result
    .filter((site) => !site.resolvedIcon)
    .map(
      (site) =>
        `| ${tableValue(site.name)}（${tableValue(site.url)}） | ${site.originalStatus === 'missing' ? '未填写' : '原地址本次不可用'} | ${websiteStatusText[site.websiteStatus] || site.websiteStatus} |`,
    ),
]
await fs.writeFile(
  path.join(root, 'reports', 'icon-audit.md'),
  markdown.join('\n') + '\n',
)
if (apply) {
  await fs.mkdir(iconDir, { recursive: true })
  for (const [relative, bytes] of iconAssets) {
    await fs.writeFile(path.join(root, 'public', relative), bytes)
  }
  await fs.writeFile(dbPath, LZString.compressToBase64(JSON.stringify(navs)))
}
console.log(JSON.stringify(summary, null, 2))
console.log(`Report: ${reportPath}`)
