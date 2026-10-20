/**
 * src/components/MediaField.tsx
 * ===============================
 * Centralized picker field for attaching demo media (image/GIF/video) to a
 * skill or workout. Renders a dashed pick-box when empty, or a live preview
 * with Replace / Remove actions. The parent owns the value and file lifecycle
 * (discard uncommitted picks on cancel, delete replaced originals on save).
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';
import { MediaType } from '../database/Database';
import { pickMedia } from '../utils/media';
import MediaViewer from './MediaViewer';

interface MediaFieldProps {
  mediaType: MediaType;
  mediaUri: string;
  onChange: (next: { type: MediaType; uri: string }) => void;
}

const MediaField: React.FC<MediaFieldProps> = ({ mediaType, mediaUri, onChange }) => {
  const [picking, setPicking] = useState(false);

  const handlePick = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const picked = await pickMedia();
      if (picked) onChange({ type: picked.type, uri: picked.uri });
    } catch (e) {
      console.error('pick media error:', e);
      // Keep silent for the caller; screens surface their own alerts on save.
    } finally {
      setPicking(false);
    }
  };

  const handleRemove = () => {
    onChange({ type: 'none', uri: '' });
  };

  return (
    <>
      <Text style={styles.label}>DEMO MEDIA</Text>
      {mediaUri ? (
        <>
          <MediaViewer mediaType={mediaType} mediaUri={mediaUri} />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handlePick} disabled={picking}>
              {picking
                ? <ActivityIndicator size="small" color={COLORS.accentCyan} />
                : (
                  <>
                    <Ionicons name="swap-horizontal" size={15} color={COLORS.accentCyan} />
                    <Text style={styles.actionTxt}>Replace</Text>
                  </>
                )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleRemove}>
              <Ionicons name="trash-outline" size={15} color={COLORS.accentRed} />
              <Text style={[styles.actionTxt, { color: COLORS.accentRed }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity style={styles.pickBox} onPress={handlePick} disabled={picking} activeOpacity={0.75}>
          {picking
            ? <ActivityIndicator color={COLORS.accentCyan} />
            : (
              <>
                <Ionicons name="cloud-upload-outline" size={26} color={COLORS.accentCyan} />
                <Text style={styles.pickBoxTxt}>Pick image, GIF or video</Text>
              </>
            )}
        </TouchableOpacity>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  label:      { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },

  pickBox:    { height: 130, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.borderMain, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.bgTertiary, marginBottom: 8 },
  pickBoxTxt: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },

  actions:    { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 4 },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  actionTxt:  { color: COLORS.accentCyan, fontSize: 13, fontWeight: '600' },
});

export default MediaField;
