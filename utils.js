import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.dirname(fileURLToPath(import.meta.url))

export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

/** Đọc file text: mỗi dòng 1 item, bỏ dòng trống và dòng bắt đầu bằng # */
export const readLines = (p) =>
  fs.readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'))

export const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

export const delay = (ms) => new Promise((r) => setTimeout(r, ms))

export const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const ts = () => new Date().toLocaleString('vi-VN', { hour12: false })

export const log = (msg, acc = '') =>
  console.log(`[${ts()}]${acc ? ` [${acc}]` : ''} ${msg}`)

/**
 * Cookie chấp nhận 3 dạng:
 *  - mảng object (chuẩn Puppeteer/Playwright)
 *  - chuỗi JSON của mảng trên
 *  - đường dẫn tới file .json chứa mảng trên
 */
export function loadCookies(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    const t = raw.trim()
    try {
      const j = JSON.parse(t)
      if (Array.isArray(j)) return j
    } catch { /* không phải JSON -> thử coi như đường dẫn file */ }
    const p = path.resolve(ROOT, t)
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (Array.isArray(j)) return j
    }
    throw new Error('Cookie không phải JSON hợp lệ, cũng không phải đường dẫn file tồn tại.')
  }
  return []
}

/**
 * Chuẩn hóa cookie Puppeteer -> định dạng Playwright chấp nhận.
 * Playwright chỉ nhận sameSite: 'Strict' | 'Lax' | 'None'.
 */
export function normalizeCookies(cookies) {
  return cookies.map((c) => {
    let ss = c.sameSite
    if (ss === 'no_restriction') ss = 'None'
    if (!['Strict', 'Lax', 'None'].includes(ss)) ss = 'Lax'
    const out = { ...c, sameSite: ss }
    if (ss === 'None') out.secure = true
    return out
  })
}

/** Parse CLI args dạng --key=value hoặc --flag */
export function parseArgs(argv) {
  return Object.fromEntries(
    argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=')
      return [k, v === undefined ? true : v]
    })
  )
}
