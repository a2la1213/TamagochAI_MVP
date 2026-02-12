// src/components/chat/ConversationDrawer.tsx
// Tiroir latéral avec l'historique des conversations

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, Pressable, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { THEME } from '../../constants/config';
import {
  getConversations,
  toggleConversationFavorite,
  renameConversation,
  loadConversationMessages,
  switchToConversation,
  createNewConversation,
} from '../../services/database/DatabaseService';
import { useTamadachiStore } from '../../stores/useTamadachiStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface ConversationItem {
  id: string;
  title: string | null;
  summary: string | null;
  message_count: number;
  is_active: number;
  is_favorite: number;
  created_at: string;
  updated_at: string;
  mood: string;
}

export function ConversationDrawer({ visible, onClose }: Props) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const tamadachi = useTamadachiStore(s => s.tamadachi);

  const loadConversations = useCallback(async () => {
    if (!tamadachi) return;
    setLoading(true);
    try {
      const convs = await getConversations(tamadachi.id, 100);
      setConversations(convs as any[]);
    } catch (e) {
      console.warn('Failed to load conversations:', e);
    }
    setLoading(false);
  }, [tamadachi]);

  useEffect(() => {
    if (visible) loadConversations();
  }, [visible, loadConversations]);

  const handleSwitch = async (convId: string) => {
    if (!tamadachi) return;
    try {
      await switchToConversation(tamadachi.id, convId);
      const msgs = await loadConversationMessages(convId);
      useTamadachiStore.setState({ messages: msgs });
      onClose();
    } catch (e) {
      console.warn('Switch failed:', e);
    }
  };

  const handleNewConversation = async () => {
    if (!tamadachi) return;
    try {
      await createNewConversation(tamadachi.id);
      useTamadachiStore.setState({ messages: [] });
      onClose();
    } catch (e) {
      console.warn('New conversation failed:', e);
    }
  };

  const handleFavorite = async (convId: string) => {
    await toggleConversationFavorite(convId);
    loadConversations();
  };

  const handleRename = async (convId: string) => {
    if (!editTitle.trim()) return;
    await renameConversation(convId, editTitle.trim());
    setEditingId(null);
    setEditTitle('');
    loadConversations();
  };

  // Grouper par date
  const grouped = groupByDate(conversations);

  const renderConversation = ({ item }: { item: ConversationItem }) => {
    const isActive = item.is_active === 1;
    const date = parseDate(item.created_at);
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    let title = item.title;
    if (!title || title === 'Nouvelle conversation') {
      title = item.summary?.slice(0, 40) || ('Conversation du ' + date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
    }

    return (
      <TouchableOpacity
        style={[styles.convItem, isActive && styles.convItemActive]}
        onPress={() => handleSwitch(item.id)}
        onLongPress={() => {
          setEditingId(item.id);
          setEditTitle(title);
        }}
      >
        <View style={styles.convLeft}>
          <TouchableOpacity onPress={() => handleFavorite(item.id)}>
            <Text style={styles.favIcon}>{item.is_favorite ? '⭐' : '☆'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.convCenter}>
          {editingId === item.id ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={editTitle}
                onChangeText={setEditTitle}
                onSubmitEditing={() => handleRename(item.id)}
                onBlur={() => setEditingId(null)}
                autoFocus
                selectTextOnFocus
              />
              <TouchableOpacity onPress={() => handleRename(item.id)}>
                <Text style={styles.editSave}>✓</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[styles.convTitle, isActive && styles.convTitleActive]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.convMeta}>
                {time} · {item.message_count || 0} msgs · {getMoodEmoji(item.mood)}
              </Text>
            </>
          )}
        </View>
        {isActive && <View style={styles.activeDot} />}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.drawer} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>💬 Conversations</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* New conversation button */}
          <TouchableOpacity style={styles.newConvBtn} onPress={handleNewConversation}>
            <Text style={styles.newConvIcon}>✨</Text>
            <Text style={styles.newConvText}>Nouvelle conversation</Text>
          </TouchableOpacity>

          {/* Favorites section */}
          {conversations.some(c => c.is_favorite) && (
            <>
              {renderSectionHeader('⭐ Favoris')}
              <FlatList
                data={conversations.filter(c => c.is_favorite)}
                renderItem={renderConversation}
                keyExtractor={item => 'fav_' + item.id}
                scrollEnabled={false}
              />
            </>
          )}

          {/* All conversations by date */}
          {loading ? (
            <ActivityIndicator style={{ padding: 20 }} color={THEME.colors.primary} />
          ) : (
            <FlatList
              data={conversations}
              renderItem={({ item, index }) => {
                const prev = index > 0 ? conversations[index - 1] : null;
                const currentDate = getDateLabel(item.created_at);
                const prevDate = prev ? getDateLabel(prev.created_at) : null;
                return (
                  <View>
                    {currentDate !== prevDate && renderSectionHeader(currentDate)}
                    {renderConversation({ item })}
                  </View>
                );
              }}
              keyExtractor={item => item.id}
              style={styles.list}
              contentContainerStyle={{ paddingBottom: 30 }}
            />
          )}

          {/* Tip */}
          <Text style={styles.tip}>Appui long pour renommer</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ============================================================
// HELPERS
// ============================================================

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // SQLite datetime('now') = '2025-02-12 14:30:00' (pas de T)
  const fixed = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(fixed);
  return isNaN(d.getTime()) ? new Date() : d;
}

function getDateLabel(dateStr: string): string {
  const date = parseDate(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return 'Il y a ' + diffDays + ' jours';
  if (diffDays < 30) return 'Il y a ' + Math.floor(diffDays / 7) + ' semaine' + (diffDays >= 14 ? 's' : '');
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function groupByDate(conversations: ConversationItem[]): Map<string, ConversationItem[]> {
  const groups = new Map<string, ConversationItem[]>();
  for (const conv of conversations) {
    const label = getDateLabel(conv.created_at);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(conv);
  }
  return groups;
}

function getMoodEmoji(mood: string): string {
  const moods: Record<string, string> = {
    joie: '😊', joy: '😊', tristesse: '😢', sadness: '😢',
    colère: '😠', anger: '😠', peur: '😨', fear: '😨',
    amour: '💚', love: '💚', curiosité: '🤔', curiosity: '🤔',
    neutre: '😐', neutral: '😐',
  };
  return moods[mood?.toLowerCase()] || '💬';
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  drawer: {
    width: '82%',
    backgroundColor: THEME.colors.background,
    borderRightWidth: 1,
    borderRightColor: THEME.colors.border,
    paddingTop: 50,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
    fontWeight: 'bold',
  },
  newConvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: THEME.colors.primary + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.primary + '40',
  },
  newConvIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  newConvText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  list: {
    flex: 1,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.colors.border + '40',
  },
  convItemActive: {
    backgroundColor: THEME.colors.primary + '15',
  },
  convLeft: {
    marginRight: 10,
  },
  favIcon: {
    fontSize: 18,
  },
  convCenter: {
    flex: 1,
  },
  convTitle: {
    fontSize: 15,
    color: THEME.colors.text,
    fontWeight: '500',
  },
  convTitleActive: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  convMeta: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
    marginLeft: 8,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.colors.text,
    backgroundColor: THEME.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  editSave: {
    fontSize: 20,
    color: THEME.colors.primary,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  tip: {
    textAlign: 'center',
    fontSize: 11,
    color: THEME.colors.textSecondary,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
});
