(function () {
  'use strict';

  const LF = window.LabFlow = window.LabFlow || {};

  function localProvider(providerId) {
    const provider = LF.AIProviders && LF.AIProviders[providerId];
    return provider
      ? provider.local === true
      : ['ollama', 'lmstudio', 'llamacpp'].includes(String(providerId || ''));
  }

  function relayEndpoint(endpoint) {
    try {
      const url = new URL(String(endpoint || ''));
      const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
      return loopback && url.port === '8099' && /^\/(?:zai|nvidia)\/v1(?:\/|$)/.test(url.pathname);
    } catch (_) {
      return false;
    }
  }

  function browserRelayProvider(providerId) {
    const provider = LF.AIProviders && LF.AIProviders[providerId];
    return !!(provider && provider.browserRelay === true);
  }

  function browserCorsHint(providerId) {
    if (browserRelayProvider(providerId)) {
      return 'This hosted provider is not browser-CORS compatible from the deployed LabFlow page. '
        + 'Start `python3 tools/provider_relay.py`, select the provider preset again so the endpoint points to the local relay, then retry. '
        + 'A custom endpoint that explicitly permits this browser origin may still be configured directly.';
    }
    if (['openai', 'gemini'].includes(providerId)) {
      return 'The browser did not expose an HTTP response. Check the provider browser/CORS policy for this origin; LabFlow sends the request to the endpoint configured in Settings.';
    }
    if (providerId === 'openrouter') {
      return 'If no HTTP status reached LabFlow, inspect browser network/CORS policy. If an HTTP 401/403 is present, fix the API key instead.';
    }
    return 'The browser did not expose an HTTP response. Check the endpoint, network path and CORS/origin policy.';
  }

  function networkMessage(label, providerId, endpoint) {
    const provider = (LF.AIProviders && LF.AIProviders[providerId]) || null;
    const name = provider && provider.name ? provider.name : 'AI provider';
    const target = String(
      endpoint
      || (LF.Storage && LF.Storage.getAiSettings ? LF.Storage.getAiSettings().endpoint : '')
      || ''
    );

    if (browserRelayProvider(providerId) && relayEndpoint(target)) {
      return label + ' could not reach the local LabFlow provider relay. '
        + 'Start `python3 tools/provider_relay.py`, keep the provider preset endpoint, then retry. '
        + 'The relay only forwards the allowlisted ' + name + ' API routes.';
    }

    if (localProvider(providerId)) {
      const space = LF.AI && LF.AI.targetAddressSpace ? LF.AI.targetAddressSpace(target) : '';
      const securePage = typeof location !== 'undefined' && location.protocol === 'https:';
      const providerHint = providerId === 'lmstudio'
        ? ' Enable Serve on Local Network and CORS when LabFlow runs on another device.'
        : providerId === 'llamacpp'
          ? ' Start llama-server on a LAN interface (for example --host 0.0.0.0) and allow the LabFlow origin with CORS.'
          : ' Expose Ollama on the LAN with OLLAMA_HOST and allow the LabFlow origin with OLLAMA_ORIGINS.';
      const browserHint = securePage && space === 'local'
        ? ' If the browser asks for Local Network access, allow it; some browsers may still require an HTTPS endpoint or a compatible local origin.'
        : '';
      const loopbackHint = space === 'loopback'
        ? ' A loopback endpoint points to the device running this browser, not to another computer on the Wi-Fi/LAN.'
        : '';
      return label + ' ended before LabFlow could read an HTTP response from ' + name + '. '
        + 'Check network reachability, bind address and browser-origin policy.'
        + loopbackHint + providerHint + browserHint;
    }

    return label + ' could not read an HTTP response from ' + name + '. ' + browserCorsHint(providerId);
  }

  function statusHint(status, code) {
    const c = String(code || '');
    if (status === 401 || status === 403) return ' Check provider credentials and permissions.';
    if (status === 404) return ' Check the endpoint path and model name.';
    if (c === '1304') return ' The provider daily quota is exhausted; retrying the same request cannot fix it.';
    if (c === '1308') return ' The provider usage window is exhausted until its reset time; LabFlow will not loop on retries.';
    if (c === '1310') return ' The provider weekly/monthly plan quota is exhausted; LabFlow will not retry automatically.';
    if (c === '1312') return ' The selected model is temporarily under high traffic. Retry later.';
    if (c === '1302') return ' Provider concurrency is saturated. Retry later.';
    if (c === '1303') return ' Provider request frequency is too high. Retry later.';
    if (status === 429 || c === '1305') return ' The provider rate limit was reached. LabFlow does not retry automatically.';
    if (status >= 500) return ' The provider reported a server-side error.';
    if (c === '1261' || c === 'MODEL_CONTEXT_LENGTH') return ' The loaded model context window was exceeded.';
    return '';
  }

  function errorSummary(error) {
    const e = error || {};
    const status = Number(e.status || 0);
    const code = String(e.providerCode || e.code || '');
    let category = 'Provider error';
    let next = 'Review the endpoint, model and provider status.';

    if (e.cancelled) {
      category = 'Cancelled';
      next = 'Run the operation again when ready.';
    } else if (e.timedOut) {
      const providerId = e.providerId || (LF.Storage && LF.Storage.getAiSettings ? LF.Storage.getAiSettings().provider : '');
      const provider = LF.AIProviders && LF.AIProviders[providerId];
      category = 'Timeout';
      next = provider && provider.local === true
        ? 'Retry or increase the inactivity timeout if the local model is still loading.'
        : 'The provider did not expose a response before the deadline. Retry once; if curl succeeds while the browser does not, inspect browser CORS/network policy.';
    } else if (e.isNetwork || (!status && /reach|network|fetch|cors|preflight|blocked/i.test(String(e.message || '')))) {
      const providerId = e.providerId || (LF.Storage && LF.Storage.getAiSettings ? LF.Storage.getAiSettings().provider : '');
      const endpoint = e.endpoint || (LF.Storage && LF.Storage.getAiSettings ? LF.Storage.getAiSettings().endpoint : '');
      if (browserRelayProvider(providerId) && relayEndpoint(endpoint)) {
        category = 'Provider relay unreachable';
        next = 'Start `python3 tools/provider_relay.py`, then retry. If the browser asks for Local Network access, allow it.';
      } else {
        category = localProvider(providerId) ? 'Local endpoint unreachable' : 'Browser / network';
        if (providerId === 'lmstudio') next = 'Confirm LM Studio Serve on Local Network/CORS and use the LAN host or IP when LabFlow runs on another device.';
        else if (providerId === 'ollama') next = 'Confirm Ollama is exposed with OLLAMA_HOST and OLLAMA_ORIGINS allows the LabFlow page origin.';
        else if (providerId === 'llamacpp') next = 'Confirm llama-server listens on a LAN-reachable address (for example --host 0.0.0.0), serves /v1/chat/completions, and allows the LabFlow origin with CORS. On another device use fedora.local or a private IP rather than localhost.';
        else next = browserCorsHint(providerId);
      }
    } else if (e.isContextOverflow || code === 'MODEL_CONTEXT_LENGTH' || code === '1261') {
      category = 'Model context';
      next = 'The prompt exceeded the model context loaded by the provider. Increase the loaded context or narrow the task.';
    } else if (e.isContract && String(e.finishReason || '') === 'length') {
      category = 'Model output limit';
      next = 'The provider returned a valid response envelope but exhausted the bounded output budget.';
    } else if (status === 400 && /reasoning[^.\n]{0,100}(?:mandatory|required|cannot be disabled)|(?:mandatory|required)[^.\n]{0,80}reasoning/i.test(String(e.providerMessage || e.message || ''))) {
      category = 'Thinking compatibility';
      next = e.reasoningCompatibilityRetry
        ? 'The provider still rejected its own default reasoning mode after LabFlow removed the explicit override. Choose another model/provider or inspect provider-specific reasoning requirements.'
        : 'LabFlow will normally retry once without a disable-reasoning override; if this persists, use Auto thinking or another model.';
    } else if (status === 400 && /(?:failed|unable) to load model|model (?:is )?not (?:found|loaded)|invalid (?:request[^.]* )?model/i.test(String(e.providerMessage || e.message || ''))) {
      category = 'Model unavailable';
      next = 'The provider could not load the configured model. Load/select a valid model in the provider, then Detect or Save & test again.';
    } else if (status === 401 || status === 403) {
      category = 'Authentication';
      next = 'Check the API key or provider permissions.';
    } else if (status === 404) {
      const providerId = e.providerId || (LF.Storage && LF.Storage.getAiSettings ? LF.Storage.getAiSettings().provider : '');
      category = providerId === 'nvidia' ? 'Model unavailable' : 'Endpoint / model';
      next = providerId === 'nvidia'
        ? 'Choose a currently served NVIDIA model and retry.'
        : 'Check the endpoint path and configured model.';
    } else if (['1304', '1308', '1310'].includes(code) || (e.rateLimited && e.rateLimitRetryable === false)) {
      category = 'Provider quota';
      next = 'The provider quota/window is exhausted. Check its reset status or use another provider.';
    } else if (status === 429 || ['1302', '1303', '1305', '1312'].includes(code) || e.rateLimited) {
      category = code === '1312' ? 'Model capacity' : 'Rate limit';
      const retryMs = Math.max(0, Number(e.retryAfterMs || e.retryInMs) || 0);
      next = retryMs ? 'Retry after about ' + Math.max(1, Math.ceil(retryMs / 1000)) + ' s.' : 'Retry later or use another provider.';
    } else if (status >= 500) {
      category = 'Provider server';
      next = 'Check provider status/logs and retry.';
    }

    return { category: category, next: next, status: status || '', providerCode: code };
  }

  function contextNote(providerId) {
    providerId = String(
      providerId
      || (LF.Storage && LF.Storage.getAiSettings ? LF.Storage.getAiSettings().provider : '')
      || ''
    );
    const provider = LF.AIProviders && LF.AIProviders[providerId];
    const endpoint = LF.Storage && LF.Storage.getAiSettings ? LF.Storage.getAiSettings().endpoint : '';
    if (browserRelayProvider(providerId) && relayEndpoint(endpoint)) {
      return (provider && provider.name ? provider.name : providerId)
        + ' uses the explicit local browser relay preset. The relay only forwards allowlisted API routes and owns no LabFlow state.';
    }
    return provider && provider.local === true
      ? 'LabFlow connects directly from this browser to the configured local/LAN endpoint.'
      : 'LabFlow connects from this browser to the configured provider endpoint.';
  }

  LF.AIDiagnostics = {
    networkMessage: networkMessage,
    statusHint: statusHint,
    errorSummary: errorSummary,
    contextNote: contextNote
  };
}());
