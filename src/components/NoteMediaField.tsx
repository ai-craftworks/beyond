/**
 * src/components/NoteMediaField.tsx
 * =================================
 * Attachments editor for a theory note: a wrap grid of thumbnails (tap =
 * fullscreen) with a per-item remove button, plus an add tile that opens the
 * image/GIF/video picker. The parent owns the value and the file lifecycle
 * (discard uncommitted picks on cancel, delete removed originals on save).
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';
import { NoteMedia } from '../database/Database';
import { pickMedia } from '../utils/media';
import { MediaThumb } from './MediaViewer';

interface NoteMediaFieldProps {
  items: NoteMedia[];
  onChange: (next: NoteMedia[]) => void;
}

const CELL = 92;

const NoteMediaField: React.FC<NoteMediaFieldProps> = ({ items, onChange }) => {
  const [picking, setPicking] = useState(false);

  const handleAdd = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const picked = await pickMedia();
      if (picked) onChange([...items, { type: picked.type, uri: picked.uri }]);
    } catch (e) {
      console.error('pick note media error:', e);
    } finally {
      setPicking(false);
    }
  };

  const handleRemove = (uri: string) => {
    onChange(items.filter(m => m.uri !== uri));
  };

  return (
    <>
      <Text style={styles.label}>
        ATTACHMENTS{items.length > 0 ? ` (${items.length})` : ''}
      </Text>
      <View style={styles.grid}>
        {items.map(m => (
          <View key={m.uri} style={styles.cell}>
            <MediaThumb mediaType={m.type} mediaUri={m.uri}
              width={CELL} height={CELL}
              badge={m.type === 'video' ? 'VIDEO' : 'IMAGE'} />
            <TouchableOpacity style={styles.remove} onPress={() => handleRemove(m.uri)} hitSlop={8}>
              <Ionicons name="close" size={13} color="#FFF" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addTile} onPress={handleAdd} disabled={picking} activeOpacity={0.75}>
          {picking ? (
            <ActivityIndicator size="small" color={COLORS.accentCyan} />
          ) : (
            <>
              <Ionicons name="add" size={22} color={COLORS.accentCyan} />
              <Text style={styles.addTxt}>Add</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      {items.length === 0 && (
        <Text style={styles.hint}>Optional — images, GIFs or videos that illustrate the note.</Text>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  label:   { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },

  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell:    { width: CELL, height: CELL, borderRadius: 8 },
  remove:  { position: 'absolute', top: 4, right: 4, zIndex: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: COLORS.accentRed, alignItems: 'center', justifyContent: 'center' },

  addTile: { width: CELL, height: CELL, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.borderMain, backgroundColor: COLORS.bgTertiary, alignItems: 'center', justifyContent: 'center', gap: 2 },
  addTxt:  { color: COLORS.accentCyan, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  hint:    { color: COLORS.textMuted, fontSize: 11, marginTop: 8, fontStyle: 'italic' },
});

export default NoteMediaField;
