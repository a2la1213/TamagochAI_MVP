// src/components/chat/ChatInput.tsx
// Barre de saisie du chat

import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Image, Alert, Modal, Pressable, Animated } from 'react-native';
import { THEME } from '../../constants/config';

interface ChatInputProps {
  onSend: (message: string, attachments?: Array<{ type: 'image'; uri: string; base64: string; mimeType: string }>) => void;
  isGenerating: boolean;
  placeholder?: string;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
  listening?: boolean;
  partialText?: string;
  onMicPress?: () => void;
  voiceMode?: boolean;
  onToggleVoiceMode?: () => void;
  speaking?: boolean;
  onStopSpeak?: () => void;
  initialText?: string;
  onTextChange?: (text: string) => void;
}

export function ChatInput({ onSend, isGenerating, placeholder, editingMessage, onCancelEdit, listening, partialText, onMicPress, voiceMode, onToggleVoiceMode, speaking, onStopSpeak, initialText, onTextChange }: ChatInputProps) {
  const [text, setText] = useState(initialText || '');
  const handleTextChange = useCallback((t: string) => { try { setText(t); onTextChange?.(t); } catch(e) { console.warn('text change error:', e); } }, [onTextChange]);

  const [attachments, setAttachments] = useState<Array<{ type: 'image'; uri: string; base64: string; mimeType: string }>>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const micPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (listening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      micPulse.setValue(1);
    }
  }, [listening]);

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

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const ext = asset.name.split('.').pop()?.toLowerCase() || '';
        const textExts = ['txt', 'md', 'py', 'js', 'ts', 'jsx', 'tsx', 'json', 'csv', 'html', 'css', 'xml', 'yaml', 'yml', 'sh', 'bash', 'sql', 'java', 'c', 'cpp', 'h', 'rb', 'php', 'swift', 'kt', 'rs', 'go', 'r', 'log', 'env', 'ini', 'toml', 'cfg', 'conf', 'dockerfile', 'makefile', 'gitignore', 'editorconfig', 'vue', 'svelte'];
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
        const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'];

        if (imageExts.includes(ext)) {
          // Traiter comme image
          const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
          setAttachments(prev => [...prev, {
            type: 'image',
            uri: asset.uri,
            base64,
            mimeType: asset.mimeType || 'image/jpeg',
          }]);
        } else if (textExts.includes(ext) || asset.mimeType?.startsWith('text/')) {
          // Lire le contenu texte du fichier
          const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
          const filePreview = '📄 ' + asset.name;
          const fileContent = '--- Contenu du fichier "' + asset.name + '" ---\n' + content + (content.length > 5000 ? '\n[... tronqué, ' + content.length + ' caractères au total]' : '') + '\n--- Fin du fichier ---';
          setAttachments(prev => [...prev, {
            type: 'file' as any,
            uri: asset.uri,
            base64: '',
            mimeType: asset.mimeType || 'text/plain',
            fileName: asset.name,
            textContent: fileContent,
          }]);
        } else if (docExts.includes(ext)) {
          // Documents (PDF, Word, Excel, etc.) — on indique le nom et les métadonnées
          let content = '';
          try {
            // Essayer de lire comme texte (certains formats le permettent)
            content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
            content = content;
          } catch (e) {
            content = '[Contenu binaire - impossible de lire le texte directement]';
          }
          const fileInfo = await FileSystem.getInfoAsync(asset.uri);
          const sizeKB = fileInfo.exists ? Math.round((fileInfo.size || 0) / 1024) : 0;
          const fileContent = '--- Document "' + asset.name + '" (' + sizeKB + ' KB, type: ' + ext.toUpperCase() + ') ---\n' + content + '\n--- Fin du document ---';
          setAttachments(prev => [...prev, {
            type: 'file' as any,
            uri: asset.uri,
            base64: '',
            mimeType: asset.mimeType || 'application/octet-stream',
            fileName: asset.name,
            textContent: fileContent,
          }]);
        } else {
          // Tout autre fichier — essayer quand même de lire comme texte
          let content = '';
          try {
            content = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
            content = content;
            const fileContent = '--- Fichier "' + asset.name + '" ---\n' + content + '\n--- Fin du fichier ---';
            setAttachments(prev => [...prev, {
              type: 'file' as any,
              uri: asset.uri,
              base64: '',
              mimeType: asset.mimeType || 'application/octet-stream',
              fileName: asset.name,
              textContent: fileContent,
            }]);
          } catch (e) {
            Alert.alert('Fichier non lisible', 'Ce fichier (' + ext + ') ne peut pas être lu comme texte. Les formats supportés incluent : texte, code, PDF, images.');
          }
        }
      }
    } catch (e) {
      console.warn('Document picker failed:', e);
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
    let trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    
    // Injecter le contenu des fichiers texte dans le message
    const fileAtts = attachments.filter((a: any) => a.textContent);
    for (const fa of fileAtts) {
      trimmed += '\n' + (fa as any).textContent;
    }
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
              {att.type === 'image' ? (
                <Image source={{ uri: att.uri }} style={styles.thumbImage} />
              ) : (
                <View style={[styles.thumbImage, styles.fileThumb]}>
                  <Text style={styles.fileThumbEmoji}>📄</Text>
                  <Text style={styles.fileThumbName} numberOfLines={1}>{(att as any).fileName || 'fichier'}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.removeAttachment} onPress={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <View style={styles.container}>
      <TouchableOpacity style={styles.attachButton} onPress={() => setShowAttachMenu(true)} disabled={isGenerating}>
        <Text style={styles.attachButtonText}>📎</Text>
      </TouchableOpacity>

      <Modal visible={showAttachMenu} transparent animationType="fade" onRequestClose={() => setShowAttachMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAttachMenu(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Joindre</Text>
              <TouchableOpacity onPress={() => setShowAttachMenu(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.modalOption} onPress={() => { setShowAttachMenu(false); takePhoto(); }}>
              <Text style={styles.modalOptionEmoji}>📷</Text>
              <View style={styles.modalOptionTextWrap}>
                <Text style={styles.modalOptionText}>Prendre une photo</Text>
                <Text style={styles.modalOptionSub}>Caméra</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => { setShowAttachMenu(false); pickImage(); }}>
              <Text style={styles.modalOptionEmoji}>🖼️</Text>
              <View style={styles.modalOptionTextWrap}>
                <Text style={styles.modalOptionText}>Galerie</Text>
                <Text style={styles.modalOptionSub}>Photos et images</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => { setShowAttachMenu(false); pickDocument(); }}>
              <Text style={styles.modalOptionEmoji}>📄</Text>
              <View style={styles.modalOptionTextWrap}>
                <Text style={styles.modalOptionText}>Fichier / Document</Text>
                <Text style={styles.modalOptionSub}>PDF, code, texte, Excel...</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      <TextInput
        ref={inputRef}
        style={[styles.input, editingMessage ? styles.inputEditing : null, listening ? styles.inputListening : null]}
        value={listening ? (partialText || '') : text}
        onChangeText={handleTextChange}
        placeholder={listening ? '🎤 Je t\'écoute...' : (placeholder || 'Écris un message...')}
        placeholderTextColor={THEME.colors.textSecondary}
        multiline
        editable={!isGenerating}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />
      {editingMessage && (
        <TouchableOpacity style={styles.cancelButton} onPress={() => { setText(''); onCancelEdit?.(); }}>
          <Text style={styles.cancelButtonText}>✕</Text>
        </TouchableOpacity>
      )}
      {/* Bouton Micro */}
      {onMicPress && (
        <Animated.View style={{ transform: [{ scale: micPulse }] }}>
          <TouchableOpacity
            style={[styles.micButton, listening && styles.micButtonActive]}
            onPress={speaking ? onStopSpeak : onMicPress}
            disabled={isGenerating}
          >
            <Text style={styles.micButtonText}>{speaking ? '🔊' : (listening ? '⏹️' : '🎤')}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Bouton Send */}
      <TouchableOpacity
        style={[styles.sendButton, (!text.trim() && !listening || isGenerating) && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={(!text.trim() && !listening) || isGenerating}
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
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  micButtonActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  micButtonText: {
    fontSize: 18,
  },
  inputListening: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    paddingTop: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  modalClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontWeight: 'bold',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalOptionEmoji: {
    fontSize: 24,
    marginRight: 16,
  },
  modalOptionTextWrap: {
    flex: 1,
  },
  modalOptionText: {
    fontSize: 16,
    color: THEME.colors.text,
  },
  modalOptionSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  fileThumb: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileThumbEmoji: {
    fontSize: 22,
  },
  fileThumbName: {
    fontSize: 7,
    color: THEME.colors.textSecondary,
    maxWidth: 55,
    textAlign: 'center',
  },
});
