import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
  Icon,
} from "n8n-workflow";

export class SentFromAiApi implements ICredentialType {
  name = "sentFromAiApi";
  displayName = "SentFromAI API";
  icon: Icon = "file:../nodes/SentFromAi/sentfromai.svg";
  documentationUrl = "https://sentfrom.ai/docs";
  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      required: true,
      default: "",
      description: "API key from your SentFromAI dashboard",
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: { Authorization: "=Bearer {{$credentials.apiKey}}" },
    },
  };
  test: ICredentialTestRequest = {
    request: {
      baseURL: "https://api.sentfrom.ai/v1",
      url: "/inboxes",
      method: "GET",
    },
  };
}
