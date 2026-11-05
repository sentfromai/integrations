"""Build Make editor component files. No network calls; no credentials."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def write(path, value):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, indent=2) + "\n")

def field(name, label, type="text", **kwargs):
    return dict(name=name, label=label, type=type, **kwargs)

def mapping(name):
    return "{{parameters." + name + "}}"

connection = field("__IMTCONN__", "Connection", "account:sentfromai", required=True)
id_field = field("message_id", "Message ID", required=True, help="SentFromAI message UUID, not the email Message-ID header.")
inbox_field = field("inbox_id", "Inbox ID", required=True)
inbox_interface = [field("id", "Inbox ID"), field("local_part", "Local part"), field("display_name", "Display name"), field("address", "Email address", "email")]
message_interface = [field("id", "Message ID"), field("thread_id", "Thread ID"), field("direction", "Direction"), field("from_addr", "From", "email"), field("to_addrs", "To", "array", spec={"type": "email"}), field("subject", "Subject"), field("created_at", "Created at", "date"), field("sent_at", "Sent at", "date"), field("received_at", "Received at", "date")]
send_interface = [field("id", "Message ID"), field("thread_id", "Thread ID"), field("message_id", "Email Message-ID"), field("ses_message_id", "Delivery provider message ID")]
sample_message = {"id":"11111111-1111-4111-8111-111111111111", "thread_id":"22222222-2222-4222-8222-222222222222", "direction":"inbound", "from_addr":"customer@example.com", "to_addrs":["agent@example.com"], "subject":"Order update", "created_at":"2026-11-05T12:00:00.000Z", "received_at":"2026-11-05T12:00:00.000Z", "sent_at":None}
sample_inbox = {"id":"33333333-3333-4333-8333-333333333333", "local_part":"agent", "display_name":"Support Agent", "address":"agent@example.com"}
sample_send = {"id":sample_message["id"], "thread_id":sample_message["thread_id"], "message_id":"<example@example.com>", "ses_message_id":"example-delivery-id"}

write("app-settings.json", {"name":"sentfromai", "label":"SentFromAI", "version":1, "description":"Create agent inboxes, send and reply to email, and read or search messages with SentFromAI.", "website":"https://sentfrom.ai", "support":"support@sentfrom.ai", "note":"Editor setup manifest, not a Make-generated export. See README.md."})
write("base.json", {"baseUrl":"https://api.sentfrom.ai/v1", "headers":{"authorization":"Bearer {{connection.apiKey}}", "content-type":"application/json"}, "response":{"error":{"message":"[{{statusCode}}] {{ifempty(body.message, body.error)}}"}}, "log":{"sanitize":["request.headers.authorization"]}})
write("connections/sentfromai/parameters.json", [field("apiKey", "API key", "password", required=True, editable=True, help="Create an API key at https://console.sentfrom.ai. Paste only the key, without Bearer.")])
write("connections/sentfromai/communication.json", {"url":"https://api.sentfrom.ai/v1/inboxes", "method":"GET", "headers":{"authorization":"Bearer {{parameters.apiKey}}"}, "response":{"valid":"{{statusCode === 200}}", "error":{"message":"[{{statusCode}}] {{ifempty(body.message, body.error)}}"}, "data":{"apiKey":"{{parameters.apiKey}}"}, "metadata":{"type":"text", "value":"SentFromAI"}}, "log":{"sanitize":["request.headers.authorization", "response.data.apiKey"]}})

modules = []
def module(name, label, kind, description, api, expect, interface, sample, static=None, epoch=None):
    modules.append({"name":name,"label":label,"type":kind,"description":description,"connection":"sentfromai"})
    write(f"modules/{name}/communication.json",api)
    write(f"modules/{name}/static-parameters.json", [connection] + (static or []))
    write(f"modules/{name}/mappable-parameters.json",expect)
    write(f"modules/{name}/interface.json",interface)
    write(f"modules/{name}/sample.json",sample)
    if epoch is not None: write(f"modules/{name}/epoch.json",epoch)

create_fields = [field("local_part","Local part",required=True,help="Lowercase letters, digits, dots, underscores and hyphens. Reserved shared-domain addresses are rejected."),field("display_name","Display name"),field("domain_id","Verified domain ID",help="Leave empty for the managed mail.sentfrom.ai domain.")]
module("createInbox","Create an Inbox","action","Creates an inbox on the managed domain or a verified custom domain.",{"url":"/inboxes","method":"POST","type":"json","body":{f["name"]:mapping(f["name"]) for f in create_fields},"response":{"output":"{{body}}"}},create_fields,inbox_interface,sample_inbox)
module("listInboxes","List Inboxes","search","Lists the inboxes belonging to the connected account.",{"url":"/inboxes","method":"GET","response":{"iterate":"{{body.inboxes}}","output":"{{item}}"}},[],inbox_interface,sample_inbox)
send_fields = [inbox_field,field("to","To","array",required=True,spec={"type":"email"}),field("subject","Subject",required=True),field("text","Plain-text body",required=True,multiline=True),field("html","HTML body",multiline=True),field("cc","Cc","array",spec={"type":"email"}),field("bcc","Bcc","array",spec={"type":"email"}),field("client_id","Idempotency key",help="Optional. Use a stable, unique ID for this logical send. Reuse it only when retrying that same send.")]
module("sendEmail","Send an Email","action","Sends an email from a SentFromAI inbox.",{"url":"/messages","method":"POST","type":"json","body":{f["name"]:mapping(f["name"]) for f in send_fields},"response":{"output":"{{body}}"}},send_fields,send_interface,sample_send)
reply_fields = [id_field,field("text","Plain-text reply",required=True,multiline=True),field("html","HTML reply",multiline=True),field("reply_all","Reply to all","boolean",default=False)]
module("replyToEmail","Reply to an Email","action","Replies in the original thread; SentFromAI derives recipients and threading headers.",{"url":"/messages/{{encodeURL(parameters.message_id)}}/reply","method":"POST","type":"json","body":{f["name"]:mapping(f["name"]) for f in reply_fields if f["name"]!="message_id"},"response":{"output":"{{body}}"}},reply_fields,send_interface,sample_send)
module("getEmail","Get an Email","action","Retrieves a message with body, labels, and signed attachment URLs.",{"url":"/messages/{{encodeURL(parameters.message_id)}}","method":"GET","response":{"output":"{{body}}"}},[id_field],message_interface+[field("body_text","Text body"),field("body_html","HTML body"),field("attachments","Attachments","array",spec={"type":"collection","spec":[field("id","Attachment ID"),field("filename","Filename"),field("mime_type","MIME type"),field("size_bytes","Size in bytes","uinteger"),field("url","Download URL","url")]}),field("labels","Labels","array",spec={"type":"collection","spec":[field("id","Label ID"),field("name","Name"),field("color","Color")]})],{**sample_message,"body_text":"Please send an update.","body_html":None,"attachments":[],"labels":[]})
search_fields=[field("query","Query",help="Leave empty for recent messages."),field("inbox_id","Inbox ID",help="Optional inbox filter."),field("mode","Search mode","select",default="keyword",options=[{"label":"Keyword","value":"keyword"},{"label":"Semantic","value":"semantic"},{"label":"Hybrid","value":"hybrid"}],help="Semantic and hybrid search require a supported plan. The API may fall back to keyword."),field("limit","Limit","uinteger",default=25,required=True,validate={"min":1,"max":100})]
module("searchEmails","Search Emails","search","Searches up to 100 messages; each matching message becomes a bundle.",{"url":"/messages","method":"GET","qs":{f["name"]:mapping(f["name"]) for f in search_fields},"response":{"iterate":"{{body.messages}}","output":"{{item}}"}},search_fields,message_interface,sample_message)
module("watchReceivedEmails","Watch Received Emails","trigger","Polls the latest 100 messages for incoming email. Schedule frequently enough to stay within that window.",{"url":"/messages","method":"GET","qs":{"inbox_id":"{{parameters.inbox_id}}","limit":100},"response":{"iterate":{"container":"{{body.messages}}","condition":"{{item.direction === 'inbound'}}"},"output":"{{item}}","trigger":{"type":"date","order":"desc","id":"{{item.id}}","date":"{{item.created_at}}"}}},[],message_interface,sample_message,static=[field("inbox_id","Inbox ID",required=True,help="Watches this inbox. Only the newest 100 inbound AND outbound messages are returned by the API per poll. More than 100 new messages between polls may be missed. This is not a historical backfill.")],epoch={"response":{"limit":100,"output":{"label":"{{item.subject}}","date":"{{item.created_at}}"}}})
api_fields=[field("path","API path",required=True,validate={"pattern":"^[A-Za-z0-9][A-Za-z0-9_./%~-]*$"},help="Path relative to /v1/, for example inboxes or messages. Host is fixed to api.sentfrom.ai."),field("method","Method","select",required=True,default="GET",options=[{"label":x,"value":x} for x in ["GET","POST","PUT","PATCH","DELETE"]]),field("query","Query string","array",spec=[field("key","Key",required=True),field("value","Value",required=True)]),field("body","JSON body","json",help="Optional valid JSON body. Leave empty for GET/DELETE requests.")]
module("makeApiCall","Make an API Call","universal","Makes an authenticated request to the SentFromAI API.",{"url":"/"+mapping("path"),"method":mapping("method"),"qs":"{{toCollection(parameters.query, 'key', 'value')}}","body":"{{parameters.body}}","type":"raw","response":{"output":{"body":"{{body}}","headers":"{{headers}}","statusCode":"{{statusCode}}"}}},api_fields,[field("body","Body","any"),field("headers","Headers","collection"),field("statusCode","Status code","uinteger")],{"body":{"inboxes":[sample_inbox]},"headers":{},"statusCode":200})
limit_field = field("limit", "Limit", "uinteger", required=True, default=100, validate={"min":1,"max":100}, help="Maximum output bundles per execution, up to 100.")
for name in ["listInboxes", "searchEmails", "watchReceivedEmails"]:
    api_path = ROOT / f"modules/{name}/communication.json"
    api = json.loads(api_path.read_text())
    api["response"]["limit"] = "{{parameters.limit}}"
    write(f"modules/{name}/communication.json", api)
    param_file = "static-parameters.json" if name == "watchReceivedEmails" else "mappable-parameters.json"
    params = json.loads((ROOT / f"modules/{name}/{param_file}").read_text())
    if not any(p["name"] == "limit" for p in params): params.append(limit_field)
    write(f"modules/{name}/{param_file}", params)

# Map date strings to Make dates explicitly, retaining the known API fields.
for name in ["searchEmails", "watchReceivedEmails", "getEmail"]:
    api = json.loads((ROOT / f"modules/{name}/communication.json").read_text())
    interface = json.loads((ROOT / f"modules/{name}/interface.json").read_text())
    source = "body" if name == "getEmail" else "item"
    output = {}
    for f in interface:
        key = f["name"]
        output[key] = "{{" + source + "." + key + "}}"
        if f["type"] == "date":
            output[key] = "{{if(" + source + "." + key + ", parseDate(" + source + "." + key + ", 'YYYY-MM-DDTHH:mm:ss.SSSZ'), null)}}"
    api["response"]["output"] = output
    if name == "watchReceivedEmails":
        api["response"]["trigger"]["date"] = "{{parseDate(item.created_at, 'YYYY-MM-DDTHH:mm:ss.SSSZ')}}"
    write(f"modules/{name}/communication.json", api)
write("modules.json",modules)
print(f"Wrote {len(modules)} Make modules.")
