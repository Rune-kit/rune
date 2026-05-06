# Trusted MCP Allowlist

The quarantine hook treats `mcp__*` namespaces as untrusted by default. Add namespaces here to skip the `[QUARANTINE-NOTICE]` advisory for MCPs you trust.

## Default Trusted Namespaces

These are baked into the hook — no allowlist file required:

| Namespace | Why trusted by default |
|---|---|
| `mcp__linear` | Authenticated workspace MCP — content authored by your own team |
| `mcp__github` | Authenticated GitHub MCP — repo content under your access controls |
| `mcp__jira` | Authenticated workspace MCP — content authored by your own team |
| `mcp__atlassian` | Authenticated workspace MCP — content authored by your own team |
| `mcp__claude_ai_Google_Drive` | Authenticated Drive MCP — your own files |
| `mcp__neural-memory` | Local cognitive store — your own captured memories |

## Operator Allowlist File

Path: `~/.claude/quarantine.d/trusted-mcp-allowlist.txt`

Resolution in code:

```js
const allowlistPath = path.join(os.homedir(), '.claude', 'quarantine.d', 'trusted-mcp-allowlist.txt');
```

Format: one namespace per line. `#` introduces a comment. Empty lines ignored.

```
# My internal docs MCP — content authored by my team only
mcp__internal_wiki

# Local-only filesystem MCP — no external network reach
mcp__local_fs

# Custom Postgres MCP — read-only against my own DB
mcp__local_postgres
```

The hook reads the file every call — no daemon restart, no in-memory cache. Add a namespace and the next tool call respects it.

## Trust Calibration

Add a namespace to the allowlist when ALL of the following are true:

1. **Authentication boundary**: only authenticated identities you trust can produce content the MCP returns.
2. **No public-content surface**: the MCP does NOT expose user-uploaded data, public web content, or third-party tickets.
3. **Audit trail**: actions through the MCP are logged somewhere reviewable.

If any condition fails, leave the namespace OUT of the allowlist. A `[QUARANTINE-NOTICE]` is cheap (~5-10ms + ~200 bytes context per call). False trust is expensive.

## Untrusted Examples (do NOT allowlist)

| Namespace | Why untrusted |
|---|---|
| `mcp__zendesk` | Customer-authored ticket content — public/external surface |
| `mcp__intercom` | Customer-authored chat content — public/external surface |
| `mcp__freshdesk` | Customer-authored ticket content — public/external surface |
| `mcp__slack` (community channels) | Mixed-trust authorship — depends on channel scope |
| `mcp__hackernews`, `mcp__reddit`, etc. | Public content by definition |
| Any MCP that scrapes / proxies third-party HTML | Treat as `WebFetch` — always quarantine |

For mixed-trust MCPs (e.g., Slack with both internal and external channels), the safer default is keeping it OUT of the allowlist. The advisory cost is negligible.

## Removing a Namespace

Delete the line. Next call gets the advisory.

## Verifying Current Allowlist

```bash
# Show effective list (defaults + operator additions)
cat ~/.claude/quarantine.d/trusted-mcp-allowlist.txt 2>/dev/null
```

If the file does not exist, only the 6 default namespaces are trusted.
