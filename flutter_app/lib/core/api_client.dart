import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({
    this.baseUrl = 'https://api.synexa.cc',
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  final String baseUrl;
  final http.Client _httpClient;

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String?> query = const {},
  }) async {
    final uri = _uri(path, query);
    final response = await _httpClient.get(uri);
    return _decode(response);
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic> body = const {},
    Map<String, String> headers = const {},
  }) async {
    final uri = _uri(path);
    final response = await _httpClient.post(
      uri,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Uri _uri(String path, [Map<String, String?> query = const {}]) {
    final cleanBase = baseUrl.replaceAll(RegExp(r'/+$'), '');
    final cleanPath = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('$cleanBase$cleanPath');
    final queryParameters = Map<String, String>.fromEntries(
      query.entries
          .where((entry) => entry.value != null && entry.value!.isNotEmpty)
          .map((entry) => MapEntry(entry.key, entry.value!)),
    );
    return queryParameters.isEmpty
        ? uri
        : uri.replace(queryParameters: queryParameters);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final decoded = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
    final success = decoded['success'];
    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        success != false) {
      return decoded;
    }
    throw ApiException(
      decoded['message']?.toString() ?? '接口请求失败：${response.statusCode}',
      statusCode: response.statusCode,
    );
  }
}
