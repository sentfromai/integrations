import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const spec = read('test/openapi.json');
const base = read('base.json');
const modules = read('modules.json');
assert.equal(base.baseUrl, spec.servers[0].url);
assert.equal(base.headers.authorization, 'Bearer {{connection.apiKey}}');
assert(base.log.sanitize.includes('request.headers.authorization'));
const auth = read('connections/sentfromai/communication.json');
assert.equal(auth.method, 'GET');
assert.equal(auth.url, base.baseUrl + '/inboxes');
assert(auth.response.valid.includes('200'));
const samples = {
  local_part:'make-test', display_name:'Test agent', domain_id:'44444444-4444-4444-8444-444444444444',
  inbox_id:'33333333-3333-4333-8333-333333333333', to:['controlled@example.com'],
  cc:['cc@example.com'], bcc:['bcc@example.com'], subject:'Fixture only', text:'Do not send this fixture',
  html:'<p>Fixture</p>', client_id:'fixture-unique-request', message_id:'11111111-1111-4111-8111-111111111111', reply_all:false
};
const resolve = schema => schema.$ref ? spec.components.schemas[schema.$ref.split('/').at(-1)] : schema;
function validateValue(schema, value, label) {
  schema=resolve(schema);
  if (schema.type === 'array') { assert(Array.isArray(value), label+' is array'); for (const item of value) validateValue(schema.items,item,label); }
  if (schema.type === 'string') assert.equal(typeof value,'string', label);
  if (schema.type === 'boolean') assert.equal(typeof value,'boolean', label);
}
const parameterName=/^[A-Za-z][A-Za-z0-9_]*$/;
for (const module of modules) {
  const directory='modules/'+module.name+'/';
  const communication=read(directory+'communication.json');
  const staticParameters=read(directory+'static-parameters.json');
  const mappableParameters=read(directory+'mappable-parameters.json');
  const fields=[...staticParameters,...mappableParameters];
  assert.equal(module.connection,'sentfromai','Module must use the sentfromai connection');
  for (const field of fields) {
    assert(parameterName.test(field.name),`${module.name} parameter ${field.name} is not a valid Make parameter name`);
    assert(!field.name.startsWith('__') && field.name!=='__IMTCONN__',`${module.name} must not declare reserved parameter ${field.name}`);
    assert(field.type!=='account:sentfromai','Make injects the connection selector; do not declare account:sentfromai');
  }
  if (module.name==='watchReceivedEmails') assert.deepEqual(staticParameters.map(field=>field.name),['inbox_id','limit']);
  else assert.deepEqual(staticParameters,[],'Only the polling trigger keeps static parameters');
  read(directory+'interface.json'); read(directory+'sample.json');
  if (module.type==='universal') continue;
  const endpoint=communication.url.replace(/\{\{encodeURL\(parameters\.message_id\)\}\}/g,'{id}');
  const operation=spec.paths[endpoint]?.[communication.method.toLowerCase()];
  assert(operation,`Unknown method/endpoint: ${module.name} ${endpoint}`);
  const requested=new Set(Object.keys(communication.qs||{}));
  const supported=new Set((operation.parameters||[]).filter(p=>p.in==='query').map(p=>p.name));
  for (const name of requested) assert(supported.has(name),`Unsupported query ${name}`);
  if (communication.body) {
    const schema=resolve(operation.requestBody.content['application/json'].schema);
    const body={};
    for (const [key,value] of Object.entries(communication.body)) {
      const match=/^\{\{parameters\.(\w+)\}\}$/.exec(value);
      assert(match,'Request body must preserve typed parameter values');
      assert(fields.some(f=>f.name===match[1]),'Undeclared body mapping');
      body[key]=samples[match[1]];
      assert(schema.properties[key],`Unsupported body field: ${key}`);
      validateValue(schema.properties[key],body[key],key);
    }
    for(const name of schema.required||[]) assert(body[name]!==undefined,`Missing required API field ${name}`);
  }
  if (module.type==='search'||module.type==='trigger') {
    assert(fields.some(f=>f.name==='limit'&&f.required),'List limits are mandatory');
    assert.equal(communication.response.limit,'{{parameters.limit}}');
  }
}
const universal=read('modules/makeApiCall/communication.json');
const pathField=read('modules/makeApiCall/mappable-parameters.json').find(f=>f.name==='path');
const pathPattern=new RegExp(pathField.validate.pattern);
for(const input of ['https://evil.example','//evil.example','/\\evil.example','\\evil.example']) assert(!pathPattern.test(input),'External URL accepted');
for(const input of ['inboxes','messages/abc/reply','messages']) {
  assert(pathPattern.test(input));
  const relative=universal.url.replace('{{parameters.path}}',input);
  assert.equal(new URL(base.baseUrl+relative).origin,'https://api.sentfrom.ai');
}
const trigger=read('modules/watchReceivedEmails/communication.json');
assert.equal(trigger.qs.limit,100,'Poll the full available API window, irrespective of output limit');
assert.equal(trigger.response.iterate.condition,"{{item.direction === 'inbound'}}");
assert.equal(trigger.response.trigger.type,'date');
assert.equal(trigger.response.trigger.order,'desc');
assert.equal(trigger.response.trigger.id,'{{item.id}}');
assert(!trigger.pagination,'The API has no paging cursor; do not invent one');
const attachment=read('modules/getEmail/interface.json').find(f=>f.name==='attachments');
assert(attachment.spec.spec.some(f=>f.name==='url'),'Attachment URL uses the API field url');
assert.equal(read('modules/replyToEmail/communication.json').body.client_id,'{{parameters.client_id}}','Reply must preserve the current API retry key');
assert(read('modules/replyToEmail/mappable-parameters.json').some(field=>field.name==='client_id'&&!field.required),'Reply idempotency stays optional');
console.log(`PASS: ${modules.length} Make components checked against the pinned SentFromAI API contract, recipient types, credential handling, safe universal path and polling behavior.`);
console.log('This is local contract validation, not execution by the Make IML runtime.');
