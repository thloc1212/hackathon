import React, { useState } from 'react';
import { Platform, SafeAreaView, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';

// Địa chỉ server Node của bạn (Gemini backend)
const SERVER_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000' // Android emulator
    : 'http://localhost:3000'; // iOS simulator

export default function GeminiScreen() {
  const [ocrText, setOcrText] = useState('Highlands Coffee\nLatte 45000\nCookie 25000\nTotal 70000');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');

  const callGemini = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const url = `${SERVER_URL}/parse`;
      const body = JSON.stringify({ ocrText });
      console.log('[client] POST', url, 'body length', body.length);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      // Log full error for debugging
      console.error('[client] fetch error:', err);
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  // Connectivity checks
  const doPing = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/ping`);
      const json = await res.json();
      console.log('[client] ping response', json);
      alert(`ping ok: ${json.ok}`);
    } catch (err) {
      console.error('[client] ping error', err);
      alert(`ping error: ${err}`);
    }
  };

  const doParseTest = async () => {
    try {
      const url = `${SERVER_URL}/parse-test`;
      const body = JSON.stringify({ test: true, sample: 'abc' });
      console.log('[client] POST', url, 'body', body);
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const json = await res.json();
      console.log('[client] parse-test response', json);
      alert(`parse-test ok: ${JSON.stringify(json)}`);
    } catch (err) {
      console.error('[client] parse-test error', err);
      alert(`parse-test error: ${err}`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 10 }}>🧾 Gemini Local Demo (Expo)</Text>
        <Text style={{ color: '#555' }}>Nhập OCR text → gửi tới server Gemini → hiển thị JSON</Text>

        <TextInput
          multiline
          value={ocrText}
          onChangeText={setOcrText}
          style={{
            marginTop: 16,
            borderColor: '#ccc',
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
            backgroundColor: '#fff',
            minHeight: 120,
            textAlignVertical: 'top',
          }}
        />

        <Pressable
          onPress={callGemini}
          style={{
            backgroundColor: '#111827',
            paddingVertical: 12,
            borderRadius: 10,
            marginTop: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>
            {loading ? 'Đang gửi...' : 'Gửi tới Gemini'}
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Pressable onPress={doPing} style={{ padding: 8, backgroundColor: '#0ea5e9', borderRadius: 8 }}>
            <Text style={{ color: 'white' }}>Ping server</Text>
          </Pressable>
          <Pressable onPress={doParseTest} style={{ padding: 8, backgroundColor: '#10b981', borderRadius: 8 }}>
            <Text style={{ color: 'white' }}>Parse-test</Text>
          </Pressable>
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 20 }} size="large" />}

        {error ? <Text style={{ color: 'red', marginTop: 20 }}>Lỗi: {error}</Text> : null}

        {result && (
          <ScrollView style={{ marginTop: 20, backgroundColor: '#111827', borderRadius: 8 }}>
            <Text
              style={{
                color: '#e5e7eb',
                padding: 10,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              }}
            >
              {JSON.stringify(result, null, 2)}
            </Text>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
