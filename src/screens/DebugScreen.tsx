// src/screens/DebugScreen.tsx
// Écran de debug — affiche tous les logs en temps réel

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { useDebugStore, LogEntry } from '../stores/useDebugStore';
import { THEME } from '../constants/config';
import { getAvailableProviders, getPreferredProvider } from '../services/llm/LLMOrchestrator';

const LEVEL_COLORS = {
  info: '#4CAF50',
  warn: '#FF9800',
  error: '#F44336',
};

function LogLine({ item }: { item: LogEntry }) {
  return (
    <View style={styles.logLine}>
      <Text style={[styles.logLevel, { color: LEVEL_COLORS[item.level] }]}>
        {item.level === 'info' ? 'ℹ️' : item.level === 'warn' ? '⚠️' : '❌'}
      </Text>
      <Text style={styles.logTime}>{item.timestamp}</Text>
      <Text style={styles.logTag}>[{item.tag}]</Text>
      <Text style={styles.logMsg} numberOfLines={3}>{item.message}</Text>
    </View>
  );
}

export default function DebugScreen({ onClose }: { onClose: () => void }) {
  const { logs, clearLogs } = useDebugStore();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Auto-scroll to bottom
    if (logs.length > 0 && flatListRef.current) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [logs.length]);

  const providers = getAvailableProviders();
  const preferred = getPreferredProvider();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 Debug Console</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          LLM: {preferred || 'none'} | Available: {providers.length > 0 ? providers.join(', ') : 'NONE'}
        </Text>
        <Text style={styles.statusText}>{logs.length} logs</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={logs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <LogLine item={item} />}
        style={styles.logList}
        initialNumToRender={50}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={clearLogs}>
          <Text style={styles.btnText}>🗑️ Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => {
          const { debugLog } = require('../stores/useDebugStore');
          debugLog('info', 'Test', 'Provider: ' + preferred + ', Available: ' + providers.join(', '));
        }}>
          <Text style={styles.btnText}>🔍 Test LLM Status</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { color: '#fff', fontSize: 24, padding: 4 },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#1a1a2e' },
  statusText: { color: '#888', fontSize: 11, fontFamily: 'monospace' },
  logList: { flex: 1, padding: 4 },
  logLine: { flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  logLevel: { fontSize: 10, width: 20 },
  logTime: { color: '#666', fontSize: 10, width: 55, fontFamily: 'monospace' },
  logTag: { color: '#4FC3F7', fontSize: 10, width: 70, fontFamily: 'monospace' },
  logMsg: { color: '#ddd', fontSize: 10, flex: 1, fontFamily: 'monospace' },
  footer: { flexDirection: 'row', padding: 8, gap: 8, borderTopWidth: 1, borderTopColor: '#333' },
  btn: { flex: 1, backgroundColor: '#333', padding: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 13 },
});
