// src/components/chat/ChatBubble.tsx
// Bulle de message — affiche un message user ou assistant

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../../types';
import { THEME } from '../../constants/config';

interface ChatBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

function ChatBubbleInner({ message, isStreaming }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text selectable style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
          {isStreaming && <Text style={styles.cursor}>▌</Text>}
        </Text>
      </View>
      {message.emotionAtTime && !isUser && (
        <Text style={styles.emotionTag}>{message.emotionAtTime}</Text>
      )}
    </View>
  );
}

export const ChatBubble = memo(ChatBubbleInner);

function formatTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 12,
    maxWidth: '92%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  assistantContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: THEME.colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: THEME.colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  text: {
    fontSize: THEME.fontSize.md,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: THEME.colors.text,
  },
  cursor: {
    color: THEME.colors.primary,
    fontWeight: 'bold',
  },
  emotionTag: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    marginLeft: 8,
  },
});
