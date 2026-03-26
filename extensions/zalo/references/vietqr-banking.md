# VietQR & Banking Reference

> Loaded by `@rune/zalo` when payment, bank transfer, QR code, or VietQR patterns detected.

---

## VietQR Transfer Messages

Send bank transfer QR codes directly in Zalo chat — recipient scans to pay via their banking app.

### Send Bank Card

```bash
# CLI: send bank card with account details
zalo-agent msg send-card -t <threadId> \
  --bank vcb \
  --account-number 1234567890 \
  --account-name "NGUYEN VAN A"

# With custom amount and message
zalo-agent msg send-card -t <threadId> \
  --bank mbbank \
  --account-number 0987654321 \
  --account-name "TRAN THI B" \
  --amount 500000 \
  --message "Thanh toan don hang #123"
```

### Send QR Transfer

```bash
# Generate VietQR and send as image
zalo-agent msg send-qr-transfer -t <threadId> \
  --bank techcombank \
  --account-number 19033456789 \
  --account-name "LE VAN C" \
  --amount 1000000 \
  --message "Tien thue thang 3"
```

### Implementation Pattern

```typescript
import { generateVietQR } from './vietqr-utils'

interface BankTransfer {
  bankCode: string       // BIN code or alias (e.g., 'vcb', 'mbbank')
  accountNumber: string
  accountName: string
  amount?: number
  message?: string       // Noi dung chuyen khoan
}

async function sendBankCard(api: ZaloApi, threadId: string, transfer: BankTransfer) {
  // 1. Resolve bank alias to BIN code
  const bin = BANK_ALIASES[transfer.bankCode] ?? transfer.bankCode

  // 2. Generate VietQR URL (NAPAS standard)
  const qrUrl = `https://img.vietqr.io/image/${bin}-${transfer.accountNumber}-compact.png`
    + (transfer.amount ? `?amount=${transfer.amount}` : '')
    + (transfer.message ? `&addInfo=${encodeURIComponent(transfer.message)}` : '')

  // 3. Download QR image to temp file
  const tempPath = await downloadToTemp(qrUrl)

  // 4. Send as image with caption
  const caption = [
    `🏦 ${BANK_NAMES[bin] ?? bin}`,
    `📋 STK: ${transfer.accountNumber}`,
    `👤 ${transfer.accountName}`,
    transfer.amount ? `💰 ${new Intl.NumberFormat('vi-VN').format(transfer.amount)} VND` : null,
    transfer.message ? `📝 ${transfer.message}` : null,
  ].filter(Boolean).join('\n')

  await api.sendMessage({ body: caption, attachments: [tempPath] }, threadId, 'User')
}
```

---

## Vietnamese Bank Aliases

55+ banks supported via VietQR / NAPAS standard:

| Alias | Bank Name | BIN |
|-------|-----------|-----|
| `vcb`, `vietcombank` | Vietcombank | 970436 |
| `bidv` | BIDV | 970418 |
| `vietinbank`, `ctg` | VietinBank | 970415 |
| `agribank` | Agribank | 970405 |
| `mb`, `mbbank` | MB Bank | 970422 |
| `techcombank`, `tcb` | Techcombank | 970407 |
| `acb` | ACB | 970416 |
| `vpbank` | VPBank | 970432 |
| `tpbank` | TPBank | 970423 |
| `sacombank`, `stb` | Sacombank | 970403 |
| `hdbank` | HDBank | 970437 |
| `ocb` | OCB | 970448 |
| `msb` | MSB | 970426 |
| `seabank` | SeABank | 970440 |
| `shb` | SHB | 970443 |
| `eximbank` | Eximbank | 970431 |
| `vib` | VIB | 970441 |
| `scb` | SCB | 970429 |
| `ncb` | NCB | 970419 |
| `abbank` | ABBank | 970425 |
| `dongabank` | DongA Bank | 970406 |
| `kienlongbank` | Kien Long Bank | 970452 |
| `baovibank` | BaoViet Bank | 970438 |
| `pvcombank` | PVcomBank | 970412 |
| `lienvietpostbank`, `lpb` | LienVietPostBank | 970449 |
| `namabank` | Nam A Bank | 970428 |
| `pgbank` | PG Bank | 970430 |
| `vietabank` | VietA Bank | 970427 |
| `bacabank` | Bac A Bank | 970409 |
| `saigonbank` | Saigon Bank | 970400 |
| `gpbank` | GP Bank | 970408 |
| `cbbank` | CB Bank | 970444 |
| `oceanbank` | OceanBank | 970414 |
| `shinhan` | Shinhan Vietnam | 970424 |
| `hsbc` | HSBC Vietnam | 970443 |
| `cimb` | CIMB Vietnam | 422589 |
| `woori` | Woori Vietnam | 970457 |
| `uob` | UOB Vietnam | 970458 |
| `standardchartered`, `sc` | Standard Chartered VN | 970410 |
| `publicbank` | Public Bank VN | 970439 |
| `cake` | CAKE (VPBank Digital) | 546034 |
| `ubank` | Ubank (VPBank) | 546035 |
| `timo` | Timo (Ban Viet) | 963388 |
| `vnptmoney` | VNPT Money | 971011 |
| `momo` | MoMo (via NAPAS) | 999996 |
| `zalopay` | ZaloPay (via NAPAS) | 999997 |
| `viettelpay` | ViettelPay | 971005 |

### Alias Lookup

```typescript
const BANK_ALIASES: Record<string, string> = {
  vcb: '970436', vietcombank: '970436',
  bidv: '970418',
  vietinbank: '970415', ctg: '970415',
  agribank: '970405',
  mb: '970422', mbbank: '970422',
  techcombank: '970407', tcb: '970407',
  acb: '970416',
  vpbank: '970432',
  tpbank: '970423',
  // ... extend as needed
}
```

---

## Sharp Edges

- **VietQR image service**: `img.vietqr.io` is free but rate-limited — cache generated QR images locally for repeated sends
- **Amount encoding**: Must be integer (VND has no decimal). `500000` not `500,000` or `500.000`
- **Message encoding**: `addInfo` must be URL-encoded, max 25 characters (NAPAS limit), ASCII only — no Vietnamese diacritics
- **Bank BIN codes**: Change rarely but verify against NAPAS registry for production use
- **QR expiry**: VietQR codes don't expire — they encode static account info. But amounts can become stale if prices change
