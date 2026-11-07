import {
  createTrigger,
  TriggerStrategy,
  type AppConnectionValueForAuthProperty,
  type StaticPropsValue,
} from '@activepieces/pieces-framework';
import {
  DedupeStrategy,
  pollingHelper,
  type Polling,
} from '@activepieces/pieces-common';
import { sentFromAiAuth } from '../auth';
import { listInboundForPoll } from '../common/client';
import { optionalInboxDropdown } from '../common/fields';
import { optionalText } from '../common/validate';

const props = {
  inboxId: optionalInboxDropdown(),
};

const polling: Polling<
  AppConnectionValueForAuthProperty<typeof sentFromAiAuth>,
  StaticPropsValue<typeof props>
> = {
  strategy: DedupeStrategy.TIMEBASED,
  async items({ auth, propsValue }) {
    const messages = await listInboundForPoll(
      auth.secret_text,
      optionalText(propsValue.inboxId),
    );
    return messages.map((message) => ({
      epochMilliSeconds: message.epochMilliSeconds,
      data: message.data,
    }));
  },
};

export const emailReceivedTrigger = createTrigger({
  name: 'email_received',
  displayName: 'Email Received',
  description:
    'Triggers when an inbound email is in the newest 100 messages and is newer than the last poll.',
  aiMetadata: {
    description:
      'Polls SentFromAI for inbound email after the flow is turned on. One payload is one inbound message. Outbound messages are ignored. Deduplication uses the polling cursor and received_at or created_at. The API returns only the newest 100 messages and has no next page, so a burst larger than that window can be missed.',
  },
  auth: sentFromAiAuth,
  type: TriggerStrategy.POLLING,
  sampleData: {
    id: 'd759e587-1127-4d74-ad96-74ece23417ea',
    thread_id: '35094f08-5a86-4ee5-b158-e5da774dcae1',
    direction: 'inbound',
    from_addr: 'customer@example.com',
    to_addrs: ['agent@mail.sentfrom.ai'],
    subject: 'Help with my order',
    received_at: '2026-01-01T12:00:00.000Z',
    created_at: '2026-01-01T12:00:00.000Z',
  },
  props,
  async onEnable(context) {
    await pollingHelper.onEnable(polling, context);
  },
  async onDisable(context) {
    await pollingHelper.onDisable(polling, context);
  },
  async run(context) {
    return pollingHelper.poll(polling, context);
  },
  async test(context) {
    return pollingHelper.test(polling, context);
  },
});
