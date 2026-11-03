# WhatsApp order confirmation — Meta setup (platform admin)

The app (`src/features/whatsapp/`) sends **approved message templates** from the platform's WhatsApp Business number
(Meta Cloud API). Business-initiated messages must be templates, so create these in **WhatsApp Manager → Message templates**,
each in the languages `ar`, `fr` and `en` (the merchant picks the language; empty = the store's language).
Names = `WHATSAPP_TEMPLATE_PREFIX` (default `scaleitto_`) + the kind below. Category: *Utility*.

| Template | Variables | Buttons |
|---|---|---|
| `scaleitto_confirm` | {{1}} name, {{2}} store, {{3}} order number (#1001), {{4}} products, {{5}} total | 2 quick replies: Confirm, Cancel (in this order) |
| `scaleitto_reminder` | same as confirm | same as confirm |
| `scaleitto_confirmed` | {{1}} name, {{2}} store, {{3}} order number, {{4}} tracking number ("—" if none) | none |
| `scaleitto_shipped` | same as confirmed | none |
| `scaleitto_delivered` | same | none |
| `scaleitto_out_for_delivery` | same | none |
| `scaleitto_failed_attempt` | same | none |
| `scaleitto_at_desk` | same | none |

Example (`scaleitto_confirm`, ar): «مرحباً {{1}}، شكراً لطلبك من {{2}}. طلبيتك {{3}}: {{4}} — المبلغ {{5}} (الدفع عند الاستلام). هل تؤكد الطلبية؟»

The quick-reply buttons' payloads are set by the platform (`confirm:<order id>` / `cancel:<order id>`); the button text
is yours. The buyer's tap arrives on the webhook (`/api/whatsapp`, field `messages`, signed with the App Secret) and is
only accepted from the number the question went to.

Costs and rules (Balance): 5 credits per message (`CREDIT_COSTS`), taken before sending; refunded when Meta refuses the
call or later reports the message `failed`; an empty balance skips the message (`whatsapp_messages.status = skipped`).
Quiet hours (Algeria time) postpone sending; the reminder is queued by the cron after 4 hours unread while the order is
still pending. "Waiting at the desk" relies on the courier's stage words (`at_station` for stop-desk orders).
