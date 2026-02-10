// src/components/chat/ChatInput.tsx
// Barre de saisie du chat

import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Image, Alert } from 'react-native';
import { THEME } from '../../constants/config';

interface ChatInputProps {
  onSend: (message: string, attachments?: Array<{ type: 'image'; uri: string; base64: string; mimeType: string }>) => void;
  isGenerating: boolean;
  placeholder?: string;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
}

export function ChatInput({ onSend, isGenerating, placeholder, editingMessage, onCancelEdit }: ChatInputProps) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Array<{ type: 'image'; uri: string; base64: string; mimeType: string }>>([]);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', "L'accès aux photos est nécessaire.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setAttachments(prev => [...prev, {
            type: 'image',
            uri: asset.uri,
            base64: asset.base64!,
            mimeType: asset.mimeType || 'image/jpeg',
          }]);
        }
      }
    } catch (e) {
      console.warn('Image pick failed:', e);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', "L'accès à la caméra est nécessaire.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        const asset = result.assets[0];
        setAttachments(prev => [...prev, {
          type: 'image',
          uri: asset.uri,
          base64: asset.base64!,
          mimeType: asset.mimeType || 'image/jpeg',
        }]);
      }
    } catch (e) {
      console.warn('Camera failed:', e);
    }
  }, []);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [editingMessage]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isGenerating) return;
    onSend(trimmed || '(image)', attachments.length > 0 ? attachments : undefined);
    setText('');
    setAttachments([]);
  }, [text, isGenerating, onSend, attachments]);

  return (
    <View style={styles.wrapper}>
      {attachments.length > 0 && (
        <View style={styles.attachmentPreview}>
          {attachments.map((att, i) => (
            <View key={i} style={styles.attachmentThumb}>
              <Image source={{ uri: att.uri }} style={styles.thumbImage} />
              <TouchableOpacity style={styles.removeAttachment} onPress={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <View style={styles.container}>
      <TouchableOpacity style={styles.attachButton} onPress={() => {
        Alert.alert('Joindre', 'Que veux-tu envoyer ?', [
          { text: '📷 Photo', onPress: takePhoto },
          { text: '🖼️ Galerie', onPress: pickImage },
          { text: 'Annuler', style: 'cancel' },
        ]);
      }} disabled={isGenerating}>
        <Text style={styles.attachButtonText}>📎</Text>
      </TouchableOpacity>
      <TextInput
        ref={inputRef}
        style={[styles.input, editingMessage ? styles.inputEditing : null]}
        value={text}
        onChangeText={setText}
        placeholder={placeholder || 'Écris un message...'}
        placeholderTextColor={THEME.colors.textSecondary}
        multiline
        maxLength={2000}
        editable={!isGenerating}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />
      {editingMessage && (
        <TouchableOpacity style={styles.cancelButton} onPress={() => { setText(''); onCancelEdit?.(); }}>
          <Text style={styles.cancelButtonText}>✕</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.sendButton, (!text.trim() || isGenerating) && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!text.trim() || isGenerating}
      >
        {isGenerating ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.sendButtonText}>➤</Text>
        )}
      </TouchableOpacity>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: THEME.colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: THEME.fontSize.md,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: THEME.colors.textSecondary,
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  wrapper: {
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    backgroundColor: THEME.colors.background,
  },
  attachmentPreview: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  attachmentThumb: {
    position: 'relative',
  },
  thumbImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeAttachment: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  attachButton: {
    width: 36,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButtonText: {
    fontSize: 20,
  },
  inputEditing: {
    borderColor: THEME.colors.primary,
    borderWidth: 2,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cancelButtonText: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
