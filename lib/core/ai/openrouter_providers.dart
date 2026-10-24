import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import 'openrouter_client.dart';

part 'openrouter_providers.g.dart';

/// OpenRouter API key from compile-time define.
///
/// Pass via `--dart-define=OPENROUTER_API_KEY=sk-or-xxx` at build/run time.
/// Falls back to empty string (client will fail gracefully if not provided).
const String _openRouterApiKey = String.fromEnvironment(
  'OPENROUTER_API_KEY',
  defaultValue: '',
);

/// OpenRouter base URL (can be overridden for testing/proxy).
const String _openRouterBaseUrl = String.fromEnvironment(
  'OPENROUTER_BASE_URL',
  defaultValue: 'https://openrouter.ai/api/v1',
);

/// OpenRouter client provider.
///
/// Returns null if no API key is configured (allows graceful degradation).
@Riverpod(keepAlive: true)
OpenRouterClient? openRouterClient(Ref ref) {
  if (_openRouterApiKey.isEmpty) {
    return null;
  }
  return OpenRouterClient(
    apiKey: _openRouterApiKey,
    baseUrl: _openRouterBaseUrl,
  );
}

/// Default model to use for VEDA/OpenRouter calls.
///
/// Override via `--dart-define=OPENROUTER_DEFAULT_MODEL=google/gemini-2.5-flash`
const String _defaultModel = String.fromEnvironment(
  'OPENROUTER_DEFAULT_MODEL',
  defaultValue: 'google/gemini-2.5-flash',
);

@riverpod
String openRouterDefaultModel(Ref ref) => _defaultModel;