// src/components/chat/ChatBubble.tsx
// Bulle de message — affiche un message user ou assistant

import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Message } from '../../types';
import { THEME } from '../../constants/config';

const EMOTION_FR: Record<string, string> = {
  neutral: 'Neutre', joy: 'Joie', sadness: 'Triste', anger: 'Colère',
  fear: 'Peur', surprise: 'Surprise', love: 'Amour', curiosity: 'Curiosité',
  excitement: 'Excité', pride: 'Fierté', calm: 'Calme', anxiety: 'Anxiété',
  confusion: 'Confusion', disgust: 'Dégoût', melancholy: 'Mélancolie', shame: 'Honte',
};

interface ChatBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onEdit?: (message: Message) => void;
}

function ChatBubbleInner({ message, isStreaming, onEdit }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => {
          Clipboard.setStringAsync(message.content);
          Alert.alert('Copié !', 'Le message a été copié dans le presse-papier.', [{ text: 'OK' }], { cancelable: true });
        }}
        delayLongPress={400}
        style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}
      >
        {message.attachments && message.attachments.map((att, i) => (
          att.type === 'image' && <Image key={i} source={{ uri: att.uri }} style={styles.attachedImage} resizeMode="cover" />
        ))}
        <Text selectable style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
          {isStreaming && <Text style={styles.cursor}>▌</Text>}
        </Text>
      </TouchableOpacity>
      {message.emotionAtTime && !isUser && (
        <Text style={styles.emotionTag}>{EMOTION_FR[message.emotionAtTime || ''] || message.emotionAtTime}</Text>
      )}
      {isUser && onEdit && (
        <TouchableOpacity onPress={() => onEdit(message)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.editButton}>✏️ Modifier</Text>
        </TouchableOpacity>
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
    marginVertical: 3,
    marginHorizontal: 8,
  },
  userContainer: {
    alignSelf: 'stretch',
  },
  assistantContainer: {
    alignSelf: 'stretch',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: THEME.colors.primary,
    borderBottomRightRadius: 4,
    flex: 1,
    marginHorizontal: 10,
  },
  assistantBubble: {
    backgroundColor: THEME.colors.surface,
    borderBottomLeftRadius: 4,
    flex: 1,
    marginHorizontal: 10,
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
  attachedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 6,
  },
  editButton: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 3,
    alignSelf: 'flex-end',
  },
});
