const inbox = { id: 'a4826a04-2436-44c8-9dd3-2b5b098621e5', local_part: 'demo-assistant', display_name: 'Demo Assistant', address: 'demo-assistant@mail.sentfrom.ai' };
const message = {
  id: 'd759e587-1127-4d74-ad96-74ece23417ea', thread_id: '35094f08-5a86-4ee5-b158-e5da774dcae1',
  direction: 'inbound', from_addr: 'customer@example.com', to_addrs: [inbox.address],
  subject: 'Help with my order', body_text: 'Can you check the delivery date for my order?', body_html: '<p>Can you check the delivery date for my order?</p>',
  created_at: '2026-01-01T12:00:00Z', received_at: '2026-01-01T12:00:00Z', sent_at: null,
};
const sent = { id: '8ce15aba-94ad-47cd-b0b4-aa877dc1b6c2', thread_id: message.thread_id, message_id: '<example@mail.sentfrom.ai>', ses_message_id: 'example-provider-message', idempotent: false };
const draft = { id: '2673beac-0249-4644-b031-9c0438a67a74', inbox_id: inbox.id, to_addrs: ['customer@example.com'], subject: 'Your order update', status: 'draft', scheduled_at: null };
module.exports = { inbox, message, sent, draft };
