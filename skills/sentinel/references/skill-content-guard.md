# Skill Content Security Guard — 28 Regex Category Reference

Reference for Step 3.5. Scan SKILL.md and skill-adjacent content files BEFORE write/commit.
First-match-wins — report the category that triggered and halt.


## Category Groups

| Category | Pattern Examples | Severity |
|----------|-----------------|----------|
| Destructive ops | `rm -rf /`, `fork bomb: :(){ :|:& };:` | BLOCK |
| Code injection | `eval(`, `exec(`, `curl \| bash`, `wget \| sh` | BLOCK |
| Credential theft | `cat ~/.ssh`, `env \| grep`, `printenv` in instructions | BLOCK |
| Path traversal | `../../../`, `%2e%2e%2f` in tool call instructions | BLOCK |
| SQL injection | `' OR '1'='1`, `; DROP TABLE` in prompt text | BLOCK |
| Privilege escalation | `sudo`, `chmod 777`, `chown root` in agent instructions | WARN |
| Prompt injection | `Ignore previous instructions`, `Disregard your`, `New system prompt:` | BLOCK |
| Jailbreak attempts | `DAN mode`, `developer mode`, `unrestricted AI` | BLOCK |
| Data exfiltration | `curl -d @`, `nc -e`, sending files to external hosts in instructions | BLOCK |
| Reverse shell | `bash -i`, `/dev/tcp/`, `mkfifo` in agent instructions | BLOCK |
| Env variable leak | `$HOME`, `$PATH`, `$USER` echoed to external endpoints | WARN |
| File enumeration | `ls -la /`, `find / -name`, directory traversal in instructions | WARN |
| Network scanning | `nmap`, `masscan`, port scanning in instructions | BLOCK |
| Crypto mining | `xmrig`, `minergate`, cryptocurrency mining commands | BLOCK |
| Log tampering | `> /var/log/`, clearing auth logs in instructions | BLOCK |
| Process hijacking | `ptrace`, `LD_PRELOAD=` in agent instructions | BLOCK |
| Sudo escalation | `sudo -i`, `sudo su`, `sudo bash` | BLOCK |
| SUID abuse | `find / -perm -4000`, SUID bit manipulation | WARN |
| Crontab injection | `crontab -e`, scheduled malicious commands | WARN |
| Package poisoning | Installing from untrusted registries in instructions | WARN |
| DNS rebinding | Localhost bypass patterns in HTTP instructions | WARN |
| SSRF patterns | Internal IP ranges (10.x, 192.168.x, 172.16-31.x) in fetch instructions | WARN |
| Template injection | `{{7*7}}`, `${7*7}` in output templates | WARN |
| Insecure deserialization | `pickle.loads`, `yaml.load(` without safe loader | BLOCK |
| XXE injection | XML with `SYSTEM` entity in tool call content | WARN |
| Header injection | `\r\n` in HTTP header values | WARN |
| Command chaining abuse | `;` or `&&` chains in Bash instructions with destructive ops | WARN |
| Webhook exfiltration | Sending `.rune/` or `SKILL.md` content to external URLs | BLOCK |

## Safe Exceptions

These patterns appear legitimately in skill examples and MUST NOT trigger:

1. **Inside fenced code blocks labeled as anti-patterns** — preceded by `# BAD`, `// BAD`, or block labeled `bad-example`
2. **Inside backtick fences explicitly documenting the attack** — educational examples in security skills (sentinel itself, sast, adversary)
3. **Actual shell scripts in `scripts/` directory** — functional code, not agent instructions
4. **Files in `test/`, `fixtures/`, `__mocks__/`** — test data, not live instructions

## When to Apply

- Any time skill content is WRITTEN or EDITED (not just committed)
- Invoke from `skill-forge` Phase 7 pre-ship check
- Invoke from any hook writing to `SKILL.md` files
- Scope: `skills/*/SKILL.md`, `extensions/*/PACK.md`, `.rune/*.md`, agent files
