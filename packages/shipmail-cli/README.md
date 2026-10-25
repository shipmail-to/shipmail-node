# Shipmail CLI

Official command line interface for the Shipmail API.

```bash
npx -y shipmail-cli --help
```

## Authentication

Sign in once through the browser, with no API key to copy:

```bash
shipmail login
```

The CLI opens Shipmail, you choose the organizations it may reach, and it saves the login in the
macOS Keychain, in the Secret Service through `secret-tool` on Linux, or otherwise in
`~/.config/shipmail/credentials.json`, readable only by you. The login refreshes itself.
`shipmail login --no-browser` prints the URL without opening a browser. If the login can reach
several organizations, pick one with `--organization org_...` or `SHIPMAIL_ORGANIZATION`, or save a
default with `shipmail login --organization org_...`. `shipmail logout` revokes the login and
deletes it.

An API key still works and takes precedence over the login. Create one in the Shipmail dashboard
and export it:

```bash
export SHIPMAIL_API_KEY="sm_live_..."
```

You can also pass `--api-key` to any command. Use `SHIPMAIL_BASE_URL` or `--base-url` when targeting a non-production API.

## Common Commands

```bash
# Check public API health
shipmail status

# Create a domain, retrieve records, and verify DNS
shipmail domains create example.com
shipmail domains dns-records dom_123
shipmail domains health dom_123
shipmail domains verify dom_123

# Create a mailbox
shipmail mailboxes create --domain-id dom_123 --address hello --password-file ./mailbox-password.txt --display-name "Hello"
shipmail mailboxes suspend mbx_123
shipmail mailboxes resume mbx_123
shipmail mailboxes forwarding-add mbx_123 --destination owner@example.net --recipient support@example.com
shipmail mailboxes forwarding mbx_123
shipmail mailboxes forwarding-remove mbx_123 fwd_123
shipmail mailboxes rules mbx_123
shipmail mailboxes app-passwords list mbx_123
shipmail mailboxes app-passwords create mbx_123 --name "Desktop mail" --expires-at 2026-10-01T00:00:00Z
shipmail mailboxes app-passwords revoke mbx_123 appwd_123

# Send email
shipmail messages send \
  --mailbox-id mbx_123 \
  --to user@example.com \
  --subject "Hello" \
  --text "It works." \
  --client-reference crm-123 \
  --metadata '{"campaign":"onboarding"}' \
  --source-rfc-message-id '<crm-123@example.com>'

shipmail messages list --client-reference crm-123
shipmail messages analytics --updated-after 2026-07-01T00:00:00Z --limit 100
shipmail messages reply msg_123 --to user@example.com --text "Thanks"

# Stage a raw file, then pass the returned sat_... ID when sending
shipmail mailboxes stage-attachment mbx_123 ./invoice.pdf --content-type application/pdf

# Prepare a five-minute, single-use upload URL for a browser-hosted component
shipmail mailboxes prepare-attachment-upload mbx_123 ./invoice.pdf --content-type application/pdf

shipmail messages send \
  --mailbox-id mbx_123 \
  --to customer@example.com \
  --subject "Invoice" \
  --text "Attached." \
  --staged-attachment-id sat_123 \
  --scheduled-at 2026-08-01T08:00:00.000Z

shipmail scheduled-messages list
shipmail scheduled-messages get msg_123
shipmail scheduled-messages update msg_123 \
  --to customer@example.com \
  --subject "Updated invoice" \
  --text "Attached." \
  --staged-attachment-id sat_123 \
  --scheduled-at 2026-08-02T08:00:00.000Z
shipmail scheduled-messages cancel msg_123

# Use an sm_test_... key to simulate an outbound result and fake inbound reply
shipmail messages send --mailbox-id mbx_123 --to user@example.com --subject "Test" --text "Not delivered" --sandbox-outcome bounced
shipmail mailboxes sandbox-inbound mbx_123 --from customer@example.com --subject "Re: Test" --text "Fake inbound reply"

# Read inbound mail
shipmail inbox list 550e8400-e29b-41d4-a716-446655440000 --folder-role inbox --after 2025-07-20T00:00:00Z --limit 25
shipmail inbox list 550e8400-e29b-41d4-a716-446655440000 --from billing@vendor.example --subject invoice --has-attachment
shipmail inbox message 550e8400-e29b-41d4-a716-446655440000 eml_123
# Enable API-agent hold with a mailbox-management credential.
shipmail mailboxes update 550e8400-e29b-41d4-a716-446655440000 --agent-security-hold true
# Use a separate securityReview credential to inspect and release the exact snapshot.
SHIPMAIL_API_KEY=sm_live_review_... shipmail inbox message 550e8400-e29b-41d4-a716-446655440000 eml_123
SHIPMAIL_API_KEY=sm_live_review_... shipmail inbox security-review 550e8400-e29b-41d4-a716-446655440000 eml_123 --reason "Reviewed against the customer request" --expected-content-sha256 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
shipmail inbox threads 550e8400-e29b-41d4-a716-446655440000 --attention-state needs_reply --after 2025-07-20T00:00:00Z --limit 50
shipmail inbox thread 550e8400-e29b-41d4-a716-446655440000 thr_123
shipmail inbox draft 550e8400-e29b-41d4-a716-446655440000 thr_123 --expected-version 7 --text "Thanks for the note"
# Read and approve content_sha256; later edits and stale drafts fail with 409 without delivery.
shipmail inbox get-draft 550e8400-e29b-41d4-a716-446655440000 thr_123 drf_123
shipmail inbox send-draft 550e8400-e29b-41d4-a716-446655440000 thr_123 drf_123 --expected-content-sha256 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
# Save a new message to Drafts for a human to review and send; this never sends
shipmail inbox compose-draft 550e8400-e29b-41d4-a716-446655440000 --to user@example.com --subject "Kickoff" --text "Draft for review"
shipmail inbox thread-attention 550e8400-e29b-41d4-a716-446655440000 thr_123 --done true --expected-version 8
shipmail inbox reply-message 550e8400-e29b-41d4-a716-446655440000 eml_123 --to user@example.com --text "Thanks"
shipmail inbox reply-thread 550e8400-e29b-41d4-a716-446655440000 thr_123 --to user@example.com --text "Following up"

# Frozen historical scan, retained for 30 days (repeat --mailbox-id for more mailboxes)
shipmail reply-scans create --mailbox-id 550e8400-e29b-41d4-a716-446655440000 --after 2025-07-20T00:00:00Z
shipmail reply-scans status rsc_123
shipmail reply-scans results rsc_123 --limit 100

# Find reusable sender identity IDs, then create a draft with blocks
shipmail newsletter-sender-identities list
shipmail newsletters create \
  --audience-id aud_123 \
  --sender-identity-id nwsid_456 \
  --name "July changelog" \
  --subject "What shipped in July" \
  --blocks @blocks.json
shipmail newsletters update nws_123 --subject "Updated subject"
# Or write the body in Markdown; Shipmail converts it to blocks
shipmail newsletters update nws_123 --markdown @issue.md
# A concurrent update exits with conflict (409); fetch the latest newsletter before retrying.
shipmail newsletters preview nws_123
shipmail newsletters test-send nws_123 --recipient-email owner@example.com
shipmail newsletters preflight nws_123
shipmail newsletters schedule nws_123 --scheduled-at 2026-08-01T09:00:00.000Z
shipmail newsletter-assets list --kind image --q hero --limit 25
shipmail newsletter-assets upload ./hero.png --content-type image/png
shipmail newsletter-assets upload ./demo.mp4 --content-type video/mp4 --thumbnail ./demo-poster.jpg
shipmail newsletter-assets register-url https://cdn.shipmail.to/newsletter-images/org_123/hero.png

# Welcome new readers with a sequence of emails
shipmail audiences welcome add-step aud_123 --subject "Welcome" --markdown @welcome.md
shipmail audiences welcome add-step aud_123 --subject "Our best posts" --markdown @day-3.md --wait-minutes 4320
shipmail audiences welcome enable aud_123

# Manage webhooks
shipmail webhooks create \
  --url https://example.com/shipmail/webhook \
  --events message.received,message.bounced \
  --authorization "Bearer your-endpoint-key"
shipmail webhooks update whk_123 --clear-authorization
shipmail webhooks update whk_123 --standard-webhooks-secret "whsec_..."
shipmail webhooks update whk_123 --clear-standard-webhooks-secret
shipmail webhooks deliveries whk_123 --status failed
shipmail webhooks replay-delivery whk_123 dlv_123 --idempotency-key replay-123
```

Paragraph, quote, callout, list-item, and column bodies in `--blocks` accept bare text or
sanitized inline HTML. Use `<p>` and `<br>` for line breaks. Shipmail keeps `a`, `b`, `br`,
`code`, `em`, `i`, `p`, `s`, `span`, `strong`, and `u`, with safe attributes and URLs.

`--markdown` (text, or `@file` to read a file) is an alternative to `--blocks` and `--body-html`.
Shipmail converts headings, paragraphs, lists, quotes, code, images, links, dividers and tables
to blocks. A callout starts with a line `:::callout` (optionally `info`, `warning` or `success`,
then a title) and ends with a line `:::`.

`newsletter-assets upload` uses a five-minute direct storage PUT, then calls the single-use
completion URL. Video uploads require a JPEG poster through `--thumbnail`. `newsletter-assets list`
includes current newsletter media storage usage and a `pagination.next_cursor` value in the JSON
response. Pass that opaque value back with `--cursor` to browse the next page.

## Generic API Command

The `api` command reaches every Shipmail REST endpoint, including endpoints that do not have a shorthand command yet.

```bash
shipmail api GET /domains
```

Use repeatable `--header "Name: value"` flags for request headers. Use `--output path` to write non-JSON responses, such as attachment downloads.

## Command Surface

- `status`
- `api <METHOD> <PATH>`
- `domains list|search|create|get|verify|delete`
- `mailboxes list|create|get|update|suspend|resume|forwarding|forwarding-add|forwarding-remove|app-passwords|folders|identities|stage-attachment|prepare-attachment-upload`
- `members list|get`
- `inbox list|message|security-review|threads|thread|thread-state|draft|send-draft|reply-message|reply-thread|update|move`
- `reply-scans create|status|results`
- `messages send|list|analytics|get|reply` (test keys also support `--sandbox-outcome`)
- `scheduled-messages list|get|update|cancel`
- `mailboxes sandbox-inbound`
- `webhooks list|create|update|test|deliveries|replay-delivery`
- `suppressions add|list|remove`
- `audiences list|create|get|update|delete`
- `audiences feed get|update|rotate|revoke`
- `audiences welcome get|enable|disable|add-step|update-step|remove-step`
- `audiences subscribers add|list|get|by-email|update|unsubscribe|resubscribe|remove`
- `newsletter-sender-identities list`
- `newsletter-domains list`
- `newsletters create|update|preview|preflight|test-send|schedule|cancel|resume`
- `newsletter-assets list|upload|register-url`

Member output uses the roles `owner`, `admin`, and `member`. Its `mailbox_access.scope` is `all` or
`selected`; `mailbox_ids` is empty for `all`, while selected IDs may be limited to mailboxes the
API key can reach.

Configure a publisher-owned Atom self URL and the number of recent newsletters:

```bash
shipmail audiences feed update aud_123 \
  --canonical-url https://example.com/feed.xml \
  --entry-limit 25
```

Run `shipmail --help` for flags and examples.
