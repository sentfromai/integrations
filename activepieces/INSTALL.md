# Install the SentFromAI custom piece

This preview is for an Activepieces platform that permits custom pieces. You need platform-administrator access and its API key; ordinary project membership is not enough. Installing it makes the piece available on that platform, not in the global catalog. Hosted installation has not yet been verified by SentFromAI.

The piece declares Activepieces 0.82.0 as its minimum release and requires a Node.js 22 or newer worker. These metadata requirements are not a certification of every platform version. Validate on a test project before using production workflows.

## Download and check

Download `activepieces-piece-sentfromai-0.0.2.tgz`, `SHA256SUMS`, and `release-manifest.json` from the [0.0.2 preview release](https://github.com/sentfromai/integrations/releases/tag/activepieces-v0.0.2). In the download directory, run:

```sh
shasum -a 256 -c SHA256SUMS
```

The archive contains the compiled piece, package metadata, logo, README and license notices. Its SDK dependencies are bundled; no npm installation is needed in the worker to resolve them. The release manifest records the exact source commit and bundled package versions. Keep the `.tgz` intact for upload.

## Upload to your platform

Use your platform's custom-piece upload process. For API installation, the [official publisher](https://github.com/activepieces/activepieces/blob/8fc37e6eb914ff22d1bc3c66dbb4447813364d5e/packages/cli/src/lib/utils/piece-utils.ts) uploads an archive to `POST /v1/pieces` beneath the platform API base URL. The following uses the same multipart fields.

Set `AP_API_URL` to your HTTPS API base, for example `https://your-activepieces.example/api`, and supply `AP_API_KEY` through your local secret manager. This is the **Activepieces platform-admin key**, not a SentFromAI key. Do not commit either credential or paste it into an issue.

```sh
curl --fail-with-body --proto '=https' \
  --request POST "${AP_API_URL%/}/v1/pieces" \
  --header "Authorization: Bearer ${AP_API_KEY}" \
  --form 'pieceArchive=@activepieces-piece-sentfromai-0.0.2.tgz' \
  --form-string 'pieceName=@activepieces/piece-sentfromai' \
  --form-string 'pieceVersion=0.0.2' \
  --form-string 'packageType=ARCHIVE' \
  --form-string 'scope=PLATFORM'
```

This changes the selected platform's available pieces. Check the URL before running it. Do not add redirect-following or insecure TLS flags. If the request is denied, have the platform administrator check custom-piece support and API-key permissions; do not broaden a SentFromAI API key to address an Activepieces authorization error.

## Connect and verify

1. In a test project, add SentFromAI and confirm version 0.0.2 is available.
2. Create a connection with a dedicated SentFromAI test account's key from [the console](https://console.sentfrom.ai/keys). Authentication reads `/v1/account`.
3. Run List Inboxes and Get Email to verify reads. Test an invalid key separately and confirm the connection is rejected.
4. Send and reply only between inboxes you control. Supply a stable Client ID; repeat identical input with that same ID and confirm there is only one delivery. Reusing it with different content should report a conflict.
5. Enable Email Received, deliver one inbound message, and confirm it triggers once. Check that the following poll does not repeat it and outbound messages do not trigger it.

The trigger reads only the latest 100 total messages and cannot backfill a busy inbox. Enabling or republishing resets its cursor to the current time. Review the [polling limitations](README.md#received-email-polling) before relying on it for critical workflows. The complete hosted acceptance checklist is in [SUBMISSION.md](SUBMISSION.md).

If an upload or mail operation times out, inspect the existing installation or message outcome before retrying. Keep the original Client ID for retries of the same email.

Report results or installation failures at [GitHub Issues](https://github.com/sentfromai/integrations/issues), without credentials or customer email content. Support: support@sentfrom.ai.
