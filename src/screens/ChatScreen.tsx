// src/screens/ChatScreen.tsx
// Écran principal — Dark theme, avatar, typing indicator, dream banner

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChat, useTamadachiData, useEmotion, useBattery, useEvolution } from '../hooks';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { useVoice } from '../hooks/useVoice';
import { initVoice, isVoiceMode } from '../services/sensors/VoiceService';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { EmptyState } from '../components/chat/EmptyState';
import { DreamBanner } from '../components/chat/DreamBanner';
import { StatusBar } from '../components/common/StatusBar';
import { EvolutionModal } from '../components/modals/EvolutionModal';
import { SettingsScreen } from './SettingsScreen';
import { StatsScreen } from './StatsScreen';
import { BatteryIndicator } from '../components/common/BatteryIndicator';
import { THEME } from '../constants/config';
import { Message, Dream, EvolutionStage } from '../types';
import { getAvatarImage } from '../constants/avatar';
import { getUnsharedDream, markDreamAsShared } from '../services/core/DreamService';
import { getAllMessages } from '../services/core/ConversationService';
import { useTamadachiStore } from '../stores/useTamadachiStore';

type Screen = 'chat' | 'settings' | 'stats';

export function ChatScreen() {
  const { messages, isGenerating, streamingText, error, sendMessage, clearError } = useChat();
  const { name, stage, avatar } = useTamadachiData();
  const { emoji: emotionEmoji } = useEmotion();
  const { percent: batteryPercent, isCharging } = useBattery();
  const flatListRef = useRef<FlatList>(null);
  const draftRef = useRef<string>('');
  const isNearBottom = useRef(true);
  const prevMessageCount = useRef(0);

  const [activeScreen, setActiveScreen] = useState<Screen>('chat');
  const [loadingMore, setLoadingMore] = useState(false);

  // Voice
  const handleVoiceSend = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);
  const voice = useVoice(handleVoiceSend);

  useEffect(() => {
    initVoice();
  }, []);

  // Auto-speak les réponses en mode vocal
  useEffect(() => {
    if (isVoiceMode() && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant' && !isGenerating) {
        voice.speakText(lastMsg.content);
      }
    }
  }, [messages.length, isGenerating]);
  const allLoaded = useRef(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [showEvolution, setShowEvolution] = useState(false);
  const [evolutionStage, setEvolutionStage] = useState<EvolutionStage>(stage);
  const [previousStage, setPreviousStage] = useState<EvolutionStage | undefined>();
  const [dreamToShow, setDreamToShow] = useState<Dream | null>(null);

  // Détection d'évolution
  useEffect(() => {
    if (stage !== evolutionStage) {
      setPreviousStage(evolutionStage);
      setEvolutionStage(stage);
      setShowEvolution(true);
    }
  }, [stage]);

  // Vérifier les rêves au montage
  useEffect(() => {
    const dream = getUnsharedDream();
    if (dream) setDreamToShow(dream);
  }, []);

  // Charger plus de messages quand on scroll en haut
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || allLoaded.current) return;
    setLoadingMore(true);
    try {
      const store = useTamadachiStore.getState();
      const tama = store.tamadachi;
      if (!tama) return;
      const currentCount = messages.length;
      const allMsgs = await getAllMessages(tama.id, currentCount + 50);
      if (allMsgs.length <= currentCount) {
        allLoaded.current = true;
      } else {
        useTamadachiStore.setState({ messages: allMsgs });
      }
    } catch (e) {
      console.warn('Load more failed:', e);
    }
    setLoadingMore(false);
  }, [messages.length, loadingMore]);

  // Auto-scroll — toujours aller en bas quand nouveau message ou streaming
  useEffect(() => {
    if (messages.length > 0 || streamingText) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [messages.length]);

  // Scroll en bas pendant le streaming
  useEffect(() => {
    if (streamingText) {
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  }, [streamingText]);

  // Scroll en bas quand on revient sur le chat
  useEffect(() => {
    if (activeScreen === 'chat' && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 200);
    }
  }, [activeScreen]);

  // Sous-écrans
  if (activeScreen === 'settings') {
    return <SettingsScreen onClose={() => setActiveScreen('chat')} />;
  }
  if (activeScreen === 'stats') {
    return <StatsScreen onClose={() => setActiveScreen('chat')} />;
  }

  // Messages (pas de faux message streaming — on utilise le TypingIndicator)
  const displayMessages = [...messages];

  const renderMessage = ({ item }: { item: Message }) => (
    <ChatBubble message={item} onEdit={(msg) => setEditingMessage({ id: msg.id, content: msg.content })} />
  );

  const handleDreamTap = () => {
    if (dreamToShow) {
      sendMessage("Raconte-moi ton rêve !");
      markDreamAsShared(dreamToShow.id);
      setDreamToShow(null);
    }
  };

  const isEmpty = messages.length === 0 && !isGenerating;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => { setActiveScreen('stats'); }}>
          <Text style={styles.headerIcon}>📊</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image
            source={getAvatarImage(avatar?.type || 'animal')}
            style={{ width: 40, height: 40, borderRadius: 20 }}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>{name}</Text>
          <BatteryIndicator percent={batteryPercent} isCharging={isCharging || false} />
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => { setActiveScreen('settings'); }}>
          <Text style={styles.headerIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <StatusBar />

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Dream Banner */}
        {dreamToShow && (
          <DreamBanner
            dream={dreamToShow}
            onTap={handleDreamTap}
            onDismiss={() => setDreamToShow(null)}
          />
        )}

        {/* Messages ou Empty State */}
        {isEmpty ? (
          <EmptyState onSuggestionTap={sendMessage} />
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={displayMessages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={true}
              onContentSizeChange={() => {
                if (displayMessages.length !== prevMessageCount.current) {
                  flatListRef.current?.scrollToEnd({ animated: true });
                  prevMessageCount.current = displayMessages.length;
                }
              }}
              onScroll={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
                isNearBottom.current = distanceFromBottom < 150;
                // Charger plus quand on est en haut
                if (contentOffset.y < 100 && !loadingMore) {
                  loadMoreMessages();
                }
              }}
              scrollEventThrottle={100}
              initialNumToRender={20}
              windowSize={5}
              maxToRenderPerBatch={10}
              removeClippedSubviews={true}
              onEndReachedThreshold={0.1}
              ListHeaderComponent={loadingMore ? <View style={{ padding: 10, alignItems: 'center' }}><ActivityIndicator size="small" color={THEME.colors.primary} /></View> : null}
            />
            {displayMessages.length > 5 && (
              <View style={styles.scrollButtons}>
                <TouchableOpacity
                  style={styles.scrollBtn}
                  onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
                >
                  <Text style={styles.scrollBtnText}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.scrollBtn}
                  onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
                >
                  <Text style={styles.scrollBtnText}>↓</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Typing indicator */}
        {isGenerating && <TypingIndicator />}

        {/* Error banner */}
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={clearError}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorDismiss}>✕</Text>
          </TouchableOpacity>
        )}

        <ChatInput
          initialText={draftRef.current}
          onTextChange={(t: string) => { draftRef.current = t; }}
          onSend={(msg, atts) => {
            if (editingMessage) {
              useTamadachiStore.getState().editAndResend(editingMessage.id, msg);
              setEditingMessage(null);
            } else {
              sendMessage(msg, atts);
            }
          }}
          isGenerating={isGenerating}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          placeholder={`Parle à ${name}...`}
          listening={voice.listening}
          partialText={voice.partialText}
          onMicPress={voice.toggleListening}
          voiceMode={voice.voiceMode}
          onToggleVoiceMode={voice.toggleVoiceMode}
          speaking={voice.speaking}
          onStopSpeak={voice.stopSpeak}
        />
      </KeyboardAvoidingView>

      {/* Evolution Modal */}
      <EvolutionModal
        visible={showEvolution}
        stage={stage}
        previousStage={previousStage}
        onClose={() => setShowEvolution(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: { fontSize: 20 },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEmoji: { fontSize: 20 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  chatContainer: { flex: 1 },
  scrollButtons: {
    position: 'absolute',
    right: 8,
    bottom: 80,
    gap: 6,
  },
  scrollBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  scrollBtnText: {
    fontSize: 18,
    color: THEME.colors.text,
    fontWeight: 'bold',
  },
  messageList: {
    paddingVertical: 12,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.error + '20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    color: THEME.colors.error,
    fontSize: 13,
  },
  errorDismiss: {
    color: THEME.colors.error,
    fontSize: 16,
    paddingLeft: 8,
  },
});
