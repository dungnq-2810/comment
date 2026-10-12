# TikTok Comment Seeder (Playwright)

Tool tự động seeding comment TikTok: nhiều nick, mỗi nick comment 1 lần/video,
nội dung xáo trộn tránh trùng, delay ngẫu nhiên giống người.

## Cài đặt (làm 1 lần)

1. Cài Node.js 18+ (https://nodejs.org)
2. Trong thư mục này chạy:
   ```bash
   npm install
   npx playwright install chromium
   ```
3. Copy file mẫu thành file thật:
   ```bash
   cp accounts.example.json accounts.json
   cp comments.example.txt comments.txt
   cp targets.example.txt targets.txt
   ```

## Điền dữ liệu

**accounts.json** — mỗi nick 1 object:
- `name`: tên gợi nhớ (vd: "nick1")
- `cookies`: 1 trong 3 dạng — mảng JSON cookie, chuỗi JSON, hoặc đường dẫn file `.json`
- `proxy`: để trống `""` nếu không dùng; có thì dạng `http://user:pass@host:port`

Cách lấy cookie: đăng nhập tiktok.com trên Chrome → cài extension **Cookie-Editor**
→ Export JSON → paste vào `cookies` (hoặc lưu ra file `cookies-nick1.json`).

**comments.txt** — mỗi dòng 1 mẫu comment (nội dung bạn đã có sẵn, paste vào).

**targets.txt** — mỗi dòng 1 link video TikTok cần seeding.

**config.json**:
- `headless: false` — hiện trình duyệt để dễ quan sát (khuyên để false)
- `delayBetweenCommentsSec: [45, 120]` — nghỉ ngẫu nhiên 45–120s giữa các comment
- `typingDelayMs: [50, 150]` — delay giữa từng ký tự khi gõ

## Chạy

Chạy thử an toàn (mở trang, tìm ô comment, KHÔNG đăng thật):
```bash
npm run dry
# tương đương: node index.js --dry-run --max-accounts=1 --max-videos=1
```

Chạy thật:
```bash
npm start
```

## Lưu ý quan trọng

- **Test 1 nick trước**, chạy `--dry-run` trước khi chạy thật.
- Nhiều nick chạy cùng 1 IP dễ bị TikTok đánh dấu → mỗi nick nên gắn proxy riêng.
- TikTok hay đổi giao diện: selector nằm gọn trong object `SELECTORS` ở đầu `index.js`,
  gãy chỗ nào sửa đúng chỗ đó.
- Cookie hết hạn → tool tự bỏ qua nick đó và báo trong log, dán lại cookie là chạy tiếp.
- File `accounts.json`, `comments.txt`, `targets.txt` đã cho vào `.gitignore` —
  đừng commit cookie/nick lên git.
