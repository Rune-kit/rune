# Config, CI, and infrastructure files

Blocking here: credentials in the tree, a CI workflow that lets untrusted code reach a secret, and a
production default that is wide open. Formatting, key order, and comment density are not findings —
config files attract style opinions, and a report full of them buries the one line that matters.

## Secrets

- A token, key, password, or connection string with a literal value
- A `.env` file committed with real values rather than placeholders
- A secret passed as a build argument or baked into an image layer — it stays in history
- A credential echoed into logs by a debug or verbose setting

Do not report an obvious placeholder (`changeme`, `xxx`, `example.com`, a documented dummy) or a
value in a file the repo's ignore rules already exclude — check before reporting.

## CI workflow security

- `pull_request_target` combined with a checkout of the PR's head — untrusted code runs with secrets
- A third-party action pinned to a tag or branch rather than a commit SHA
- A workflow token granted write scope where the job only reads
- A secret referenced in a job that a fork's PR can trigger
- User-controlled text (title, branch name, body) interpolated straight into a `run:` block

Do not report an unpinned action published by the same organization as the repository, where the
project's other workflows follow the same convention.

## Runtime and container defaults

- A container running as root, or with `privileged`, host network, or a docker socket mounted
- An image tagged `latest` in anything that is deployed
- A debug, verbose, or development flag set in a production-facing config
- A health check or resource limit absent on a deployed service

Do not report root or `latest` in a local development compose file, a test fixture, or a
documentation example — the risk is a property of where it is deployed, not of the string.

## Network exposure

- An ingress, security group, or firewall rule open to `0.0.0.0/0` on a non-public port
- CORS allowing `*` together with credentials — the browser rejects it, and the intent is unclear
- TLS verification disabled, or a minimum protocol version below the project's stated baseline
- A management, metrics, or admin endpoint bound to a public interface

Do not report a wildcard CORS origin on an endpoint that serves only public, unauthenticated data.

## File semantics

- YAML where an unquoted `yes`, `no`, `on`, `off`, or a country code like `NO` is read as a boolean
- Duplicate keys in YAML or JSON — the last one silently wins
- A number that must stay a string (a version, a zip code, an account id) left unquoted
- A tab character used for indentation in YAML — a parse error

Do not report quoting style on values where no type coercion is possible.

## Versions and dependencies

- A floating range (`*`, `latest`, an unbounded caret) in a manifest with no lockfile committed
- A lockfile changed with no corresponding manifest change, or the reverse
- A pinned dependency with a known advisory where the fix is a patch release

Do not report a floating range in a devDependency of a library whose lockfile is deliberately not
committed — that is the standard convention for published packages.
