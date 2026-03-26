# Conversation & Advanced Features Reference

> Loaded by `@rune/zalo` when conversation management, polls, auto-reply, or advanced messaging patterns detected.

---

## Conversation Management

Operations on conversation threads — mute, archive, pin, read status.

### Commands

| Command | Description | Thread Types |
|---------|-------------|--------------|
| `conv pinned` | List pinned conversations | Both |
| `conv archived` | List archived conversations | Both |
| `conv mute <threadId> [-t type]` | Mute notifications | Both |
| `conv unmute <threadId> [-t type]` | Unmute notifications | Both |
| `conv read <threadId> [-t type]` | Mark as read | Both |
| `conv unread <threadId> [-t type]` | Mark as unread | Both |
| `conv delete <threadId> [-t type]` | Delete conversation | Both |

Thread type flag: `-t 0` = User (default), `-t 1` = Group.

### Implementation Pattern

```typescript
// Mute a noisy group for the bot account
await api.muteConversation(groupId, 'Group')

// Mark messages as read after processing (prevents unread badge buildup)
async function processAndAcknowledge(msg: Message) {
  const response = await generateResponse(msg)
  await api.sendMessage(response, msg.threadId, msg.type)
  await api.markRead(msg.threadId, msg.type) // clear unread indicator
}

// Archive old conversations to keep thread list clean
await api.archiveConversation(threadId, 'User')
```

---

## Group Polls

Create and manage polls in group conversations.

### Create Poll

```bash
zalo-agent poll create -t <groupId> \
  --question "Sprint review nào?" \
  --options "Thứ 5 14h" "Thứ 6 10h" "Thứ 6 14h" \
  --multi \                    # Allow multiple choice
  --allow-add-option \         # Members can add options
  --anonymous \                # Hide who voted what
  --expire-ms 86400000         # 24h expiry
```

### Poll Options

| Flag | Description | Default |
|------|-------------|---------|
| `--multi` | Allow selecting multiple options | Single choice |
| `--allow-add-option` | Members can add their own options | Disabled |
| `--hide-vote-preview` | Don't show live vote counts | Show counts |
| `--anonymous` | Hide voter identity | Named votes |
| `--expire-ms <ms>` | Auto-close after duration | No expiry |

### Poll Management

```bash
# View poll results
zalo-agent poll detail -t <groupId> --poll-id <pollId>

# Vote on a poll
zalo-agent poll vote -t <groupId> --poll-id <pollId> --option-ids 0,2

# Lock poll (stop accepting votes)
zalo-agent poll lock -t <groupId> --poll-id <pollId>

# Share poll to another group
zalo-agent poll share -t <groupId> --poll-id <pollId> --to-group <targetGroupId>
```

---

## Reminders

Set timed reminders in group conversations.

```bash
zalo-agent reminder create -t <groupId> \
  --text "Standup meeting bắt đầu!" \
  --time "2026-03-25T09:00:00+07:00"
```

---

## Auto-Reply

Configure automatic responses for personal account (useful for away messages).

```bash
# Set auto-reply for all incoming DMs
zalo-agent auto-reply set \
  --message "Mình đang bận, sẽ trả lời sau. Bot sẽ ghi lại tin nhắn của bạn." \
  --active true
```

### Bot Integration Pattern

```typescript
// Use auto-reply as fallback when bot can't process
async function handleMessage(msg: Message) {
  try {
    const response = await aiProcess(msg)
    await api.sendMessage(response, msg.threadId, 'User')
  } catch {
    // AI unavailable — auto-reply already handles notification
    // Log for later manual follow-up
    logger.warn(`Failed to process message from ${msg.threadId}`)
  }
}
```

---

## Labels & Catalog

### Labels (Tag Conversations)

```bash
# List all labels
zalo-agent label list

# Labels help categorize conversations for bot routing
# e.g., "VIP", "Support", "Sales"
```

### Catalog (Zalo Shop)

```bash
# List catalog items
zalo-agent catalog list

# Useful for e-commerce bots that need product info
```

---

## Message Operations

### Forward Messages

```typescript
// Forward a received message to another thread
await api.forwardMessage(messageId, targetThreadId, targetType)
```

### Recall (Unsend) Messages

```typescript
// Recall a sent message (within Zalo's recall window)
await api.undoMessage(messageId, threadId, type)
```

### Delete Messages (Local Only)

```typescript
// Delete message from bot's view only — recipient still sees it
await api.deleteMessage(messageId, threadId, type)
```

---

## Contact Cards

Send a user's contact card to another conversation:

```typescript
// Share a contact card
await api.sendMessage({
  type: 'contact',
  contactId: userId,
  body: 'Liên hệ anh A nhé'
}, threadId, 'User')
```

---

## Link Previews

```typescript
// Send a link — Zalo auto-generates rich preview (OG tags)
await api.sendMessage({
  type: 'link',
  url: 'https://example.com/product/123',
  body: 'Xem sản phẩm mới'
}, threadId, 'User')
```

---

## Sharp Edges

- **Poll create**: Only works in groups, not 1:1 DMs
- **Poll expire-ms**: Milliseconds, not seconds — `86400000` = 24 hours
- **Anonymous polls**: Cannot be changed to named after creation
- **Auto-reply**: Applies to ALL incoming DMs — no per-contact filtering
- **Message recall**: Time window is ~2 hours (undocumented, may change)
- **Forward**: Preserves original sender info — recipient sees who originally sent it
- **Labels**: Personal account feature only — OA uses tag system instead (different API)
- **Catalog**: Requires Zalo Shop activation — not available on all accounts
