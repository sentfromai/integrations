# Use SentFromAI with Zapier

Connect your SentFromAI inbox to a workflow that receives email, requests your approval, and saves an unsent reply draft.

**Release status: invite-only preview.** This guide is being prepared for the existing private integration. Its installation link is awaiting verification. A verified link will be added here before this guide is distributed. This is not a Zapier App Directory listing or a published Zap template.

## What you need

- Your own [SentFromAI account](https://sentfrom.ai/?utm_source=zapier&utm_medium=integration&utm_campaign=agent-email), an inbox, and an API key.
- A Zapier account. The approval workflow below requires a paid Zapier plan with Human in the Loop. On Professional, you review your own requests; review by teammates requires the appropriate team access. See [Zapier's approval guide](https://help.zapier.com/hc/en-us/articles/38731463206029-Request-approval-to-keep-your-workflow-running-with-Human-in-the-Loop).
- A mailbox you control for the first test message.

## Connect your account

1. Accept the verified SentFromAI invitation in the Zapier account where you will build the workflow.
2. In the [SentFromAI dashboard](https://console.sentfrom.ai/inboxes), create or select an inbox. Keep its address handy. You only need to create the inbox once.
3. Create a key on the [API keys page](https://console.sentfrom.ai/keys).
4. Create a Zap and select **SentFromAI**. Connect a new account and paste the key into **API Key**, without the word `Bearer`.
5. Check that the connection label shows the intended SentFromAI workspace.

Each user connects their own account. Keep API keys in Zapier's connection dialog; do not put them into message text or ordinary step fields.

## Recipe: receive an email, approve a reply, save a draft

This written recipe can be followed after accepting the private invitation. Private integrations do not support shared Zap templates. [Zapier integration types](https://docs.zapier.com/integrations/quickstart/private-vs-public-integrations)

### 1. Receive an email

Select **SentFromAI → New Email Received**. Choose the inbox from setup; select one specific inbox for this recipe.

Send a short test email to that inbox from your controlled mailbox. Test the trigger and select the received message. Check its **Message ID**, **From**, **Subject**, and **Text Body**.

The trigger loads real messages from your account. If no sample appears, confirm the selected inbox and send a fresh message. The sample picker considers recent messages; it is separate from the instant webhook used when the Zap is on.

### 2. Request your approval

Add **Human in the Loop → Request Approval**. Configure these values:

| Setting | Value |
| --- | --- |
| Approval request message | Review this proposed reply before it is saved as a draft. |
| Content to review: Original subject | Map **Subject** from the email trigger. |
| Content to review: Original email | Map **Text Body** from the email trigger. |
| Content to review: Reply text | For the first test: `Thanks for getting in touch. We will review your message and follow up.` |
| Let reviewer edit content? | **No** for this first recipe. |
| Action if reviewer declines | **Stop run** |
| On timeout | **End run** |

Select yourself as reviewer and choose your notification destination. Add **Filter by Zapier** afterward, continuing only when the approval step's **Decision** exactly matches `approved`.

For this first test, the reply text is a fixed acknowledgement. Once the workflow works, you can insert your chosen drafting step before approval and map its proposed reply into **Reply text**.

### 3. Save the approved reply

Add **SentFromAI → Create Draft** and map these fields:

| Field | Value |
| --- | --- |
| Inbox | Select the same inbox used in the trigger. |
| Reply to Message ID | Map **Message ID** from **New Email Received**. |
| Text Body | Map the approval step's submitted **Reply text** field. |
| To, Subject, Cc, Bcc, HTML Body | Leave blank for this recipe. |

SentFromAI inherits the reply's recipient, subject, and thread from the original message. The result includes a **Draft ID** and **Status** of `draft`; it is not scheduled or sent.

Use the Draft ID in your application or the [SentFromAI API](https://docs.sentfrom.ai) to retrieve the saved draft. The relevant endpoint is `GET /v1/drafts/{id}`. Do not add **Send Email** or **Reply to Email** unless you intend the workflow to send a message.

### 4. Check the complete workflow

Turn on the Zap, then send one new test email to your selected inbox. Approve the review request and check Zap History: the trigger, approval, filter, and draft step should succeed, with a Draft ID returned.

Run a second test and decline approval. Confirm the draft step does not run. Keep the successful run available if you need support. The approval editor's sample test alone does not demonstrate a live review request. [Approval step testing](https://help.zapier.com/hc/en-us/articles/38731463206029-Request-approval-to-keep-your-workflow-running-with-Human-in-the-Loop)

This recipe is configuration guidance. Its complete approval workflow has not yet been verified in a hosted Zap.

## Other available steps

| Step | Use it to |
| --- | --- |
| New Inbox | Start a workflow when an inbox is created. |
| Send Email | Send a new message from your selected inbox. |
| Reply to Email | Send a reply in an existing thread; choose whether to reply to all. |
| Create Inbox | Provision a new, uniquely named inbox. |
| Get Message | Retrieve a message's complete content, labels, and attachment links. |
| Find Message | Find the best match for a query, optionally in one inbox. |

For **Send Email**, map an event-specific value into **Unique Send ID** to prevent a repeated request from sending another copy. If your installed **Reply to Email** step offers **Unique Reply ID**, use it the same way. This reply field is new in source version 1.0.1 and is not available in the original 1.0.0 step.

Use a different key for every intended send or reply across your workspace, including different workflow steps. Keep the same key and content when retrying. If the service reports `client_id_conflict` or `send_outcome_pending`, check the prior outcome; switching to a fresh key can produce a duplicate. Draft creation has no retry key, so inspect earlier results before replaying it.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| SentFromAI is missing from the app picker | Accept the verified invitation using the same Zapier account. A private integration is not discoverable in the public directory. |
| Invalid or revoked API key | Reconnect using a current key from the intended workspace. |
| `address_taken` when creating an inbox | The requested address already exists. Choose it from the inbox dropdown for sending/drafting, or use a different local part if you need a new inbox. Re-running **Create Inbox** with the same local part does not reuse, replace, or overwrite it. |
| Inbox limit reached | Check your SentFromAI plan and existing inboxes. |
| No new-email sample | Select the correct inbox and receive a fresh test message. |
| No draft after review | Check **Decision**, the filter, and whether the request was declined or timed out. |
| Sending paused, suppressed recipient, or other sending restriction | Review the account's sending status and the API error. Reconnecting or replaying does not remove a sending restriction. |
| An old attachment link stopped working | Run **Get Message** again to obtain fresh links. |

For help, contact **support@sentfrom.ai** with the step name, time, and non-sensitive error text. Do not include your API key or private email content.
