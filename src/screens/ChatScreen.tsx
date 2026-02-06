// src/screens/ChatScreen.tsx
// Écran principal — Dark theme, avatar, typing indicator, dream banner

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChat, useTamadachiData, useEmotion, useBattery, useEvolution } from '../hooks';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatInput } from '../components/chat/ChatInput';
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
import { getUnsharedDream, markDreamAsShared } from '../services/core/DreamService';

type Screen = 'chat' | 'settings' | 'stats';

export function ChatScreen() {
  const { messages, isGenerating, streamingText, error, sendMessage, clearError } = useChat();
  const { name, stage } = useTamadachiData();
  const { emoji: emotionEmoji } = useEmotion();
  const { percent: batteryPercent, isCharging } = useBattery();
  const flatListRef = useRef<FlatList>(null);

  const [activeScreen, setActiveScreen] = useState<Screen>('chat');
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

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0 || streamingText) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, streamingText]);

  // Sous-écrans
  if (activeScreen === 'settings') {
    return <SettingsScreen onClose={() => setActiveScreen('chat')} />;
  }
  if (activeScreen === 'stats') {
    return <StatsScreen onClose={() => setActiveScreen('chat')} />;
  }

  // Messages + streaming
  const displayMessages = [...messages];
  if (streamingText && isGenerating) {
    displayMessages.push({
      id: 'streaming',
      conversationId: '',
      role: 'assistant' as const,
      content: streamingText,
      createdAt: new Date().toISOString(),
      tokensUsed: 0,
      generationTimeMs: 0,
      isEdited: false,
      isRegenerated: false,
    } as Message);
  }

  const renderMessage = ({ item }: { item: Message }) => (
    <ChatBubble message={item} isStreaming={item.id === 'streaming'} />
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
        <TouchableOpacity style={styles.headerButton} onPress={() => setActiveScreen('stats')}>
          <Text style={styles.headerIcon}>📊</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Image
            source={require('../../assets/avatars/avatar_default.png')}
            style={{ width: 36, height: 36, borderRadius: 18 }}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>{name}</Text>
          <BatteryIndicator percent={batteryPercent} isCharging={isCharging || false} />
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => setActiveScreen('settings')}>
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
          <FlatList
            ref={flatListRef}
            data={displayMessages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
          />
        )}

        {/* Typing indicator */}
        {isGenerating && !streamingText && <TypingIndicator />}

        {/* Error banner */}
        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={clearError}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorDismiss}>✕</Text>
          </TouchableOpacity>
        )}

        <ChatInput
          onSend={sendMessage}
          isGenerating={isGenerating}
          placeholder={`Parle à ${name}...`}
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
