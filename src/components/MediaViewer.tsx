/**
 * src/components/MediaViewer.tsx
 * ================================
 * Centralized demo-media display for skills and workouts (exercises).
 *
 * - MediaViewer: inline 16:9 preview (image/GIF/animated or video with native
 *   controls); tapping the expand badge (or the image itself) opens fullscreen.
 * - MediaThumb: compact list-card thumbnail that opens the same fullscreen view.
 * - FullscreenMedia: black modal that fills the screen; unlocks the device
 *   orientation while open (so video/photos can be viewed in landscape) and
 *   re-locks to portrait on close. Video playback uses expo-video.
 */

import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, Modal, TouchableOpacity, Pressable, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/game';
import { MediaType } from '../database/Database';

// ── Fullscreen ───────────────────────────────

interface FullscreenProps {
  visible: boolean;
  mediaType: MediaType;
  mediaUri: string;
  onClose: () => void;
}

const FullscreenVideo: React.FC<{ uri: string }> = ({ uri }) => {
  const player = useVideoPlayer(uri, p => { p.loop = true; });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls
    />
  );
};

/** Full-screen media layer. Unlocks orientation while visible, portrait on close. */
export const FullscreenMedia: React.FC<FullscreenProps> = ({
  visible, mediaType, mediaUri, onClose,
}) => {
  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [visible]);

  if (!visible || !mediaUri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={fsStyles.root}>
        {/* Tap backdrop closes images; for video, the close button stays on top. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={mediaType === 'video' ? undefined : onClose} />
        <View style={fsStyles.stage}>
          {mediaType === 'video' ? (
            <FullscreenVideo uri={mediaUri} />
          ) : (
            <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          )}
        </View>
        <TouchableOpacity style={fsStyles.close} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// ── Inline viewer ────────────────────────────

interface MediaViewerProps {
  mediaType: MediaType;
  mediaUri: string;
}

const InlineVideo: React.FC<{ uri: string }> = ({ uri }) => {
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

const ExpandBadge: React.FC = () => (
  <View style={styles.expandBadge} pointerEvents="none">
    <Ionicons name="expand" size={14} color="#FFF" />
  </View>
);

const MediaViewer: React.FC<MediaViewerProps> = ({ mediaType, mediaUri }) => {
  const [fullscreen, setFullscreen] = useState(false);

  if ((mediaType === 'video' || mediaType === 'image') && mediaUri) {
    return (
      <>
        <TouchableOpacity
          style={styles.tapWrap}
          activeOpacity={0.9}
          onPress={() => setFullscreen(true)}
          delayPressIn={120}
        >
          {mediaType === 'video' ? <InlineVideo uri={mediaUri} /> : (
            <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="contain" />
          )}
          <ExpandBadge />
        </TouchableOpacity>
        <FullscreenMedia
          visible={fullscreen}
          mediaType={mediaType}
          mediaUri={mediaUri}
          onClose={() => setFullscreen(false)}
        />
      </>
    );
  }

  return (
    <View style={[styles.media, styles.empty]}>
      <Ionicons name="videocam-off-outline" size={30} color={COLORS.textMuted} />
      <Text style={styles.emptyTxt}>No demo added</Text>
    </View>
  );
};

// ── Card thumbnail ───────────────────────────

interface MediaThumbProps {
  mediaType: MediaType;
  mediaUri: string;
  width?: number;
  height?: number;
}

/** Compact 16:9 preview for list cards; tap → fullscreen. */
export const MediaThumb: React.FC<MediaThumbProps> = ({
  mediaType, mediaUri, width = 104, height = 58,
}) => {
  const [fullscreen, setFullscreen] = useState(false);
  if (!mediaUri || mediaType === 'none') return null;

  return (
    <>
      <TouchableOpacity
        style={[styles.thumb, { width, height }]}
        activeOpacity={0.85}
        onPress={() => setFullscreen(true)}
      >
        {mediaType === 'video' ? (
          <Ionicons name="play-circle" size={24} color="#FFF" />
        ) : (
          <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        <View style={styles.thumbBadge} pointerEvents="none">
          <Text style={styles.thumbBadgeTxt}>{mediaType === 'video' ? 'VIDEO' : 'DEMO'}</Text>
        </View>
      </TouchableOpacity>
      <FullscreenMedia
        visible={fullscreen}
        mediaType={mediaType}
        mediaUri={mediaUri}
        onClose={() => setFullscreen(false)}
      />
    </>
  );
};

// ── Styles ───────────────────────────────────

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
  tapWrap: {
    width: '100%',
  },
  expandBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    padding: 5,
  },

  thumb: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderMain,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    paddingVertical: 1,
  },
  thumbBadgeTxt: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});

const fsStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  close: {
    position: 'absolute',
    top: 48,
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
});

export default MediaViewer;
