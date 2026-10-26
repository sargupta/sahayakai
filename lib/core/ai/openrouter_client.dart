import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/dio_config.dart';

/// OpenRouter API client for direct AI model access.
///
/// Supports chat completions with streaming. Models are specified by their
/// OpenRouter model IDs (e.g., 'google/gemini-2.5-flash', 'openai/gpt-4o-mini').
class OpenRouterClient {
  OpenRouterClient({
    required String apiKey,
    String baseUrl = 'https://openrouter.ai/api/v1',
    Duration? connectTimeout,
    Duration? receiveTimeout,
    Duration? sendTimeout,
    Dio? dio,
  })  : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: baseUrl,
              connectTimeout: connectTimeout ?? kConnectTimeout,
              receiveTimeout: receiveTimeout ?? kReceiveTimeout,
              sendTimeout: sendTimeout ?? kSendTimeout,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $apiKey',
                'HTTP-Referer': 'https://sahayakai.com',
                'X-Title': 'SahayakAI',
              },
              // 4xx/5xx must throw so callers can map them to typed errors
              // (ApiException). Treating them as success hid invalid/expired/
              // quota-exhausted keys behind a generic parse failure.
              validateStatus: (s) => s != null && s < 400,
            ));

  final Dio _dio;

  /// Sends a chat completion request (non-streaming).
  Future<OpenRouterChatResponse> chat(OpenRouterChatRequest request) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/chat/completions',
        data: request.toJson(),
      );
      return OpenRouterChatResponse.fromJson(response.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    } on FormatException catch (e) {
      throw ApiException(
        ApiErrorKind.badResponse,
        'Unexpected response from AI service.',
        raw: e,
      );
    }
  }

  /// Sends a streaming chat completion request.
  Stream<OpenRouterChatStreamChunk> chatStream(OpenRouterChatRequest request) {
    final controller = StreamController<OpenRouterChatStreamChunk>();

    _dio
        .post<ResponseBody>(
      '/chat/completions',
      data: {...request.toJson(), 'stream': true},
      options: Options(responseType: ResponseType.stream),
    )
        .then((response) {
      final stream = response.data!.stream
          .transform(StreamTransformer.fromHandlers(
            handleData: (data, sink) {
              sink.add(utf8.decode(data));
            },
          ))
          .transform(const LineSplitter())
          .where((line) => line.startsWith('data: '))
          .map((line) => line.substring(6))
          .where((line) => line != '[DONE]')
          .map((line) => OpenRouterChatStreamChunk.fromJson(json.decode(line) as Map<String, dynamic>));

      stream.listen(
        controller.add,
        onError: controller.addError,
        onDone: controller.close,
      );
    }).catchError((e) {
      controller.addError(e);
      controller.close();
      return null;
    });

    return controller.stream;
  }

  void dispose() {
    _dio.close();
  }
}

/// OpenRouter chat completion request.
class OpenRouterChatRequest {
  OpenRouterChatRequest({
    required this.model,
    required this.messages,
    this.temperature = 0.7,
    this.maxTokens,
    this.topP,
    this.frequencyPenalty,
    this.presencePenalty,
    this.stop,
    this.stream = false,
  });

  final String model;
  final List<OpenRouterMessage> messages;
  final double temperature;
  final int? maxTokens;
  final double? topP;
  final double? frequencyPenalty;
  final double? presencePenalty;
  final List<String>? stop;
  final bool stream;

  Map<String, dynamic> toJson() => {
        'model': model,
        'messages': messages.map((m) => m.toJson()).toList(),
        'temperature': temperature,
        if (maxTokens != null) 'max_tokens': maxTokens,
        if (topP != null) 'top_p': topP,
        if (frequencyPenalty != null) 'frequency_penalty': frequencyPenalty,
        if (presencePenalty != null) 'presence_penalty': presencePenalty,
        if (stop != null) 'stop': stop,
        'stream': stream,
      };
}

/// OpenRouter chat message.
class OpenRouterMessage {
  OpenRouterMessage({
    required this.role,
    required this.content,
    this.name,
  });

  final String role; // 'system', 'user', 'assistant'
  final String content;
  final String? name;

  Map<String, dynamic> toJson() => {
        'role': role,
        'content': content,
        if (name != null) 'name': name,
      };
}

/// OpenRouter chat completion response (non-streaming).
class OpenRouterChatResponse {
  OpenRouterChatResponse({
    required this.id,
    required this.object,
    required this.created,
    required this.model,
    required this.choices,
    required this.usage,
  });

  final String id;
  final String object;
  final int created;
  final String model;
  final List<OpenRouterChoice> choices;
  final OpenRouterUsage usage;

  factory OpenRouterChatResponse.fromJson(Map<String, dynamic> json) {
    final choicesRaw = json['choices'];
    if (choicesRaw is! List || choicesRaw.isEmpty) {
      throw const FormatException('OpenRouter response missing choices');
    }
    final usageRaw = json['usage'];
    return OpenRouterChatResponse(
      id: (json['id'] as String?) ?? '',
      object: (json['object'] as String?) ?? 'chat.completion',
      created: (json['created'] as num?)?.toInt() ?? 0,
      model: (json['model'] as String?) ?? '',
      choices: choicesRaw
          .map((c) => OpenRouterChoice.fromJson(c as Map<String, dynamic>))
          .toList(),
      usage: usageRaw is Map<String, dynamic>
          ? OpenRouterUsage.fromJson(usageRaw)
          : const OpenRouterUsage(promptTokens: 0, completionTokens: 0, totalTokens: 0),
    );
  }

  String get content => choices.firstOrNull?.message.content ?? '';
}

/// OpenRouter choice.
class OpenRouterChoice {
  OpenRouterChoice({
    required this.index,
    required this.message,
    required this.finishReason,
  });

  final int index;
  final OpenRouterResponseMessage message;
  final String finishReason;

  factory OpenRouterChoice.fromJson(Map<String, dynamic> json) {
    final msg = json['message'];
    return OpenRouterChoice(
      index: (json['index'] as num?)?.toInt() ?? 0,
      message: msg is Map<String, dynamic>
          ? OpenRouterResponseMessage.fromJson(msg)
          : OpenRouterResponseMessage(role: 'assistant', content: ''),
      finishReason: (json['finish_reason'] as String?) ?? '',
    );
  }
}

/// OpenRouter message in response (distinct from request message).
class OpenRouterResponseMessage {
  OpenRouterResponseMessage({
    required this.role,
    required this.content,
  });

  final String role;
  final String content;

  factory OpenRouterResponseMessage.fromJson(Map<String, dynamic> json) {
    return OpenRouterResponseMessage(
      role: (json['role'] as String?) ?? 'assistant',
      content: (json['content'] as String?) ?? '',
    );
  }
}

/// OpenRouter usage stats.
class OpenRouterUsage {
  const OpenRouterUsage({
    required this.promptTokens,
    required this.completionTokens,
    required this.totalTokens,
  });

  final int promptTokens;
  final int completionTokens;
  final int totalTokens;

  factory OpenRouterUsage.fromJson(Map<String, dynamic> json) {
    return OpenRouterUsage(
      promptTokens: json['prompt_tokens'] as int,
      completionTokens: json['completion_tokens'] as int,
      totalTokens: json['total_tokens'] as int,
    );
  }
}

/// OpenRouter streaming chunk.
class OpenRouterChatStreamChunk {
  OpenRouterChatStreamChunk({
    required this.id,
    required this.object,
    required this.created,
    required this.model,
    required this.choices,
  });

  final String id;
  final String object;
  final int created;
  final String model;
  final List<OpenRouterStreamChoice> choices;

  factory OpenRouterChatStreamChunk.fromJson(Map<String, dynamic> json) {
    return OpenRouterChatStreamChunk(
      id: json['id'] as String,
      object: json['object'] as String,
      created: json['created'] as int,
      model: json['model'] as String,
      choices: (json['choices'] as List)
          .map((c) => OpenRouterStreamChoice.fromJson(c as Map<String, dynamic>))
          .toList(),
    );
  }

  String get deltaContent => choices.firstOrNull?.delta.content ?? '';
  bool get isDone => choices.firstOrNull?.finishReason != null;
}

/// OpenRouter streaming choice.
class OpenRouterStreamChoice {
  OpenRouterStreamChoice({
    required this.index,
    required this.delta,
    required this.finishReason,
  });

  final int index;
  final OpenRouterDelta delta;
  final String? finishReason;

  factory OpenRouterStreamChoice.fromJson(Map<String, dynamic> json) {
    return OpenRouterStreamChoice(
      index: json['index'] as int,
      delta: OpenRouterDelta.fromJson(json['delta'] as Map<String, dynamic>),
      finishReason: json['finish_reason'] as String?,
    );
  }
}

/// OpenRouter streaming delta.
class OpenRouterDelta {
  OpenRouterDelta({
    required this.role,
    required this.content,
  });

  final String? role;
  final String content;

  factory OpenRouterDelta.fromJson(Map<String, dynamic> json) {
    return OpenRouterDelta(
      role: json['role'] as String?,
      content: json['content'] as String? ?? '',
    );
  }
}