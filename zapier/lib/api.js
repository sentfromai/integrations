const BASE_URL = 'https://api.sentfrom.ai/v1';

// Only the fixed SentFromAI origin receives the customer's API key.
const addAuth = (request, z, bundle) => {
  const url = new URL(request.url);
  if (url.origin === 'https://api.sentfrom.ai' && url.pathname.startsWith('/v1/')) {
    request.headers.Authorization = `Bearer ${bundle.authData.api_key}`;
    request.headers.Accept = 'application/json';
    request.headers['User-Agent'] = 'SentFromAI-Zapier/1.0.1';
  }
  return request;
};

const handleResponse = (response, z) => {
  if (response.status === 401) {
    throw new z.errors.ExpiredAuthError('Your SentFromAI API key is invalid or revoked. Reconnect your account with a current key.');
  }
  // Platform Core 19 handles 429 + Retry-After before custom middleware.
  if (response.status >= 400) {
    const error = response.data && (response.data.message || response.data.error);
    throw new z.errors.Error(error || `SentFromAI returned HTTP ${response.status}.`, 'SentFromAIError', response.status);
  }
  return response;
};

const compact = (value) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== ''));
const request = async (z, path, { method = 'GET', params, body } = {}) => {
  const response = await z.request({
    url: `${BASE_URL}${path}`, method,
    ...(params ? { params: compact(params) } : {}),
    ...(body ? { body: compact(body), headers: { 'Content-Type': 'application/json' } } : {}),
  });
  return response.status === 204 ? {} : response.data;
};

const requireBody = (z, data) => {
  if (!data.text?.trim() && !data.html?.trim()) {
    throw new z.errors.Error('Provide a text body or an HTML body.', 'MissingEmailBody', 400);
  }
};

module.exports = { BASE_URL, addAuth, handleResponse, compact, request, requireBody };
