const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Ajv = require('ajv');
const root = __dirname;
const provider = JSON.parse(fs.readFileSync(path.join(root, 'provider.json'), 'utf8'));
const schemaPath = process.argv[2] || path.join(root, 'references/provider-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, discriminator: true });
const validate = ajv.compile(schema);
assert(validate(provider), JSON.stringify(validate.errors, null, 2));
const config = provider.sentfromai;
assert.equal(config.auth_mode, 'API_KEY');
assert.equal(config.proxy.base_url, 'https://api.sentfrom.ai');
assert.equal(config.proxy.headers.authorization, 'Bearer ${apiKey}');
assert.deepEqual(config.proxy.verification, {method:'GET',endpoints:['/v1/inboxes']});
assert(config.credentials.apiKey.secret);
assert(!config.credentials.apiKey.pattern, 'Legacy valid key prefixes must remain supported');
for (const relative of ['docs/integrations/all/sentfromai.mdx','docs/integrations/all/sentfromai/connect.mdx','packages/webapp/public/images/template-logos/sentfromai.svg']) {
  assert(fs.existsSync(path.join(root,'overlay',relative)), `Missing upstream asset ${relative}`);
}
const connect=fs.readFileSync(path.join(root,'overlay/docs/integrations/all/sentfromai/connect.mdx'),'utf8');
assert(connect.includes('## Step 1: Create an API key'));
assert.equal(config.credentials.apiKey.doc_section,'#step-1-create-an-api-key');
const broken=structuredClone(provider);
broken.sentfromai.auth_mode='INVENTED_AUTH';
assert(!validate(broken),'Upstream schema must reject invalid provider configuration');
console.log('PASS: Nango upstream JSON schema, read-only credential check, private key declaration, docs anchors and required logo/docs assets.');
console.log('Live Nango connection flow and upstream repository validation remain required before approval.');
