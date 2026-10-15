/**
 * src/components/MediaViewer.tsx
 * ================================
 * Renders a skill's demo media: a still/animated image, an inline video, or an
 * empty placeholder. Video playback uses expo-video.
 */

import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';
import { SkillMediaType } from '../database/Database';

interface MediaViewerProps {
  mediaType: SkillMediaType;
  mediaUri: string;
}

const VideoPlayer: React.FC<{ uri: string }> = ({ uri }) => {
  const player = useVideoPlayer(uri, p => { p.loop = true; });
  return (
    <VideoView
      player={player}
      style={styles.media}
      contentFit="contain"
      nativeControls
    />
  );
};

const MediaViewer: React.FC<MediaViewerProps> = ({ mediaType, mediaUri }) => {
  if (mediaType === 'video' && mediaUri) {
    return <VideoPlayer uri={mediaUri} />;
  }
  if (mediaType === 'image' && mediaUri) {
    return (
      <Image
        source={{ uri: mediaUri }}
        style={styles.media}
        resizeMode="contain"
      />
    );
  }
  return (
    <View style={[styles.media, styles.empty]}>
      <Ionicons name="videocam-off-outline" size={30} color={COLORS.textMuted} />
      <Text style={styles.emptyTxt}>No demo added</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  media: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderMain,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.bgTertiary,
    borderStyle: 'dashed',
  },
  emptyTxt: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
});

export default MediaViewer;
