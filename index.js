/**
 * TikTok Comment Seeder — Playwright
 * -------------------------------------------------
 * Mỗi nick = 1 browser context riêng (cookie + proxy riêng).
 * Mỗi nick comment 1 lần / video, nội dung xáo trộn, delay ngẫu nhiên.
 *
 * Chạy thử an toàn (không đăng thật):
 *   node index.js --dry-run --max-accounts=1 --max-videos=1
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import {
  ROOT, readJson, readLines, rand, delay, shuffle,
  ts, log, loadCookies, normalizeCookies, parseArgs,
} from './utils.js'

chromium.use(StealthPlugin())

const args = parseArgs(process.argv)
const DRY_RUN = !!args['dry-run']

/**
 * Selector ô comment & nút Đăng của TikTok web.
 * TikTok hay đổi giao diện -> thử lần lượt từng selector, cái nào ăn thì dùng.
 * Gãy ở đâu thì sửa đúng chỗ này (hoặc báo mình sửa).
 */
const SELECTORS = {
  commentBox: [
    'div[data-e2e="comment-input"]',
    '[data-e2e="comment-container"] div[contenteditable="true"]',
    'div[contenteditable="true"]',
  ],
  postButton: [
    'button[data-e2e="comment-post"]',
    '[data-e2e="comment-post-btn"]',
    'button:has-text("Đăng")',
  ],
}

async function findVisible(page, selectors, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      const el = page.locator(sel).first()
      try {
        if ((await el.count()) > 0 && (await el.isVisible())) {
          await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {})
          return el
        }
      } catch { /* thử selector tiếp theo */ }
    }
    await delay(1000)
  }
  return null
}

async function commentOnVideo(context, videoUrl, comment, config, accName) {
  const page = await context.newPage()
  try {
    log(`Mở video: ${videoUrl}`, accName)
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await delay(rand(2000, 4000))

    // Bị đá về trang login = cookie chết
    if (/\/login\/?/.test(page.url())) throw new Error('COOKIE_HET_HAN')

    const box = await findVisible(page, SELECTORS.commentBox, config.commentTimeoutMs)
    if (!box) throw new Error('Không tìm thấy ô comment (TikTok đổi giao diện?)')

    await box.click({ timeout: config.commentTimeoutMs })
    await delay(rand(500, 1200))

    if (DRY_RUN) {
      log(`[DRY-RUN] sẽ comment: "${comment}"`, accName)
      return { ok: true }
    }

    // Gõ từng ký tự với delay ngẫu nhiên cho giống người
    const [tmin, tmax] = config.typingDelayMs
    await box.pressSequentially(comment, { delay: rand(tmin, tmax) })
    await delay(rand(800, 2000))

    // Bấm nút Đăng (thử nhiều selector)
    let posted = false
    for (const sel of SELECTORS.postButton) {
      const btn = page.locator(sel).first()
      try {
        if ((await btn.count()) > 0 && (await btn.isEnabled())) {
          await btn.click({ timeout: 8000 })
          posted = true
          break
        }
      } catch { /* thử selector tiếp theo */ }
    }
    if (!posted) {
      // Dự phòng: Enter (một số giao diện nhận)
      await box.press('Enter').catch(() => {})
    }
    await delay(rand(2000, 4000))
    log(`Đã comment: "${comment.slice(0, 45)}${comment.length > 45 ? '...' : ''}"`, accName)
    return { ok: true }
  } catch (err) {
    if (config.screenshotOnError) {
      const dir = path.join(ROOT, 'screenshots')
      fs.mkdirSync(dir, { recursive: true })
      const sp = path.join(dir, `${accName}-${Date.now()}.png`)
      await page.screenshot({ path: sp }).catch(() => {})
      log(`Lỗi: ${err.message} (đã chụp màn hình: ${sp})`, accName)
    } else {
      log(`Lỗi: ${err.message}`, accName)
    }
    return { ok: false, error: err.message }
  } finally {
    await page.close().catch(() => {})
  }
}

async function main() {
  const config = readJson(path.join(ROOT, 'config.json'))
  let accounts = readJson(path.join(ROOT, 'accounts.json'))
  const comments = readLines(path.join(ROOT, 'comments.txt'))
  let targets = readLines(path.join(ROOT, 'targets.txt'))

  if (args['max-accounts']) accounts = accounts.slice(0, Number(args['max-accounts']))
  if (args['max-videos']) targets = targets.slice(0, Number(args['max-videos']))

  if (!accounts.length) throw new Error('accounts.json trống — copy từ accounts.example.json rồi điền cookie.')
  if (!comments.length) throw new Error('comments.txt trống.')
  if (!targets.length) throw new Error('targets.txt trống.')

  log(`Bắt đầu: ${accounts.length} nick, ${targets.length} video, ${comments.length} mẫu comment${DRY_RUN ? ' [DRY-RUN]' : ''}`)

  const browser = await chromium.launch({ headless: config.headless })

  // Chia comment: xáo trộn, ưu tiên không trùng nội dung giữa các nick
  const used = new Set()
  const pickComment = () => {
    let pool = comments.filter((c) => !used.has(c))
    if (!pool.length) {
      used.clear()
      pool = [...comments]
    }
    const c = shuffle(pool)[0]
    used.add(c)
    return c
  }

  const stats = { ok: 0, fail: 0, deadAccounts: [] }

  for (const acc of accounts) {
    const accName = acc.name || 'nick'
    log(`--- Xử lý nick ${accName} ---`, accName)

    let cookies
    try {
      cookies = normalizeCookies(loadCookies(acc.cookies))
    } catch (e) {
      log(`Cookie lỗi: ${e.message} — bỏ qua nick này`, accName)
      continue
    }
    if (!cookies.length) {
      log('Không có cookie — bỏ qua nick này', accName)
      continue
    }

    const ctxOpts = { viewport: { width: 1366, height: 768 }, locale: 'vi-VN' }
    if (acc.proxy) ctxOpts.proxy = { server: acc.proxy } // vd: http://user:pass@host:port

    const context = await browser.newContext(ctxOpts)
    await context.addCookies(cookies)

    let dead = false
    for (const url of targets) {
      if (dead) break
      const res = await commentOnVideo(context, url, pickComment(), config, accName)
      if (res.ok) stats.ok++
      else {
        stats.fail++
        if (res.error === 'COOKIE_HET_HAN') {
          log('Cookie hết hạn — dừng nick này, dán lại cookie mới', accName)
          stats.deadAccounts.push(accName)
          dead = true
          break
        }
      }
      const [dmin, dmax] = config.delayBetweenCommentsSec
      const waitS = rand(dmin, dmax)
      log(`Nghỉ ${waitS}s trước lượt tiếp theo`, accName)
      await delay(waitS * 1000)
    }
    await context.close().catch(() => {})
    log(`Xong nick ${accName}`, accName)
  }

  await browser.close()
  log(`Hoàn tất: thành công ${stats.ok}, lỗi ${stats.fail}` +
    (stats.deadAccounts.length ? `, nick chết cookie: ${stats.deadAccounts.join(', ')}` : ''))
}

main().catch((e) => {
  console.error(`[${ts()}] LỖI NẶNG: ${e.message}`)
  process.exit(1)
})
