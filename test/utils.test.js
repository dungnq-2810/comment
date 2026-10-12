import test from 'node:test'
import assert from 'node:assert/strict'
import { readLines, rand, shuffle, loadCookies, normalizeCookies, parseArgs } from '../utils.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

test('shuffle: giữ nguyên phần tử, đổi thứ tự (xác suất)', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8]
  const out = shuffle(src)
  assert.deepEqual([...out].sort(), [...src].sort())
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6, 7, 8], 'không được mutate mảng gốc')
})

test('rand: nằm trong khoảng [min, max]', () => {
  for (let i = 0; i < 200; i++) {
    const v = rand(45, 120)
    assert.ok(v >= 45 && v <= 120, `rand ra ngoài khoảng: ${v}`)
  }
})

test('readLines: bỏ dòng trống và dòng #', () => {
  const f = path.join(os.tmpdir(), `lines-${Date.now()}.txt`)
  fs.writeFileSync(f, '# ghi chú\n\ndòng 1\n   \ndòng 2\n# chú thích 2\n')
  assert.deepEqual(readLines(f), ['dòng 1', 'dòng 2'])
  fs.unlinkSync(f)
})

test('loadCookies: nhận mảng trực tiếp', () => {
  const arr = [{ name: 'a', value: 'b', domain: '.tiktok.com' }]
  assert.deepEqual(loadCookies(arr), arr)
})

test('loadCookies: parse chuỗi JSON', () => {
  const arr = [{ name: 'a', value: 'b' }]
  assert.deepEqual(loadCookies(JSON.stringify(arr)), arr)
})

test('loadCookies: đọc từ đường dẫn file', () => {
  const f = path.join(os.tmpdir(), `ck-${Date.now()}.json`)
  const arr = [{ name: 'x', value: 'y' }]
  fs.writeFileSync(f, JSON.stringify(arr))
  // loadCookies resolve theo ROOT (thư mục project) -> copy file vào đó
  const dest = path.join(path.dirname(new URL('../utils.js', import.meta.url).pathname), `ck-tmp-${Date.now()}.json`)
  fs.copyFileSync(f, dest)
  try {
    assert.deepEqual(loadCookies(path.basename(dest)), arr)
  } finally {
    fs.unlinkSync(f)
    fs.unlinkSync(dest)
  }
})

test('loadCookies: chuỗi rác -> throw', () => {
  assert.throws(() => loadCookies('không phải json cũng không phải file'), /Cookie không phải JSON/)
})

test('normalizeCookies: map sameSite lạ về Lax, no_restriction -> None', () => {
  const out = normalizeCookies([
    { name: 'a', value: '1', sameSite: 'no_restriction' },
    { name: 'b', value: '2', sameSite: 'unspecified' },
    { name: 'c', value: '3', sameSite: 'Strict' },
  ])
  assert.equal(out[0].sameSite, 'None')
  assert.equal(out[0].secure, true)
  assert.equal(out[1].sameSite, 'Lax')
  assert.equal(out[2].sameSite, 'Strict')
})

test('parseArgs: --dry-run --max-accounts=2', () => {
  const a = parseArgs(['node', 'index.js', '--dry-run', '--max-accounts=2'])
  assert.equal(a['dry-run'], true)
  assert.equal(a['max-accounts'], '2')
})
