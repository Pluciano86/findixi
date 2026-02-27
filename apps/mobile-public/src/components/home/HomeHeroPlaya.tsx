import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text } from 'react-native';

import { useI18n } from '../../i18n/provider';
import { fonts, spacing } from '../../theme/tokens';

const HERO_IMAGE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/PlayaHeader.png';
const HERO_VIDEO =
  'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/videos/index_video.mp4';

type HomeHeroPlayaProps = {
  canPlay: boolean;
};

export function HomeHeroPlaya({ canPlay }: HomeHeroPlayaProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const shouldRenderVideo = canPlay && !hasPlaybackError;

  return (
    <Pressable style={styles.wrap} onPress={() => router.push('/comercios')}>
      {shouldRenderVideo ? (
        <Video
          source={{ uri: HERO_VIDEO }}
          style={styles.video}
          shouldPlay
          isLooping
          isMuted
          resizeMode={ResizeMode.COVER}
          useNativeControls={false}
          onError={() => {
            setHasPlaybackError(true);
          }}
        />
      ) : (
        <Image source={{ uri: HERO_IMAGE }} style={styles.image} resizeMode="cover" />
      )}

      <LinearGradient
        colors={['rgba(59,130,246,0.4)', 'rgba(248,113,113,0.4)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.overlay}
      />

      <Text style={styles.title}>{t('home.beachTitle')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    height: 260,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1d4ed8',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1d4ed8',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
  },
  title: {
    position: 'absolute',
    color: '#ffffff',
    fontSize: 32,
    fontFamily: fonts.medium,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
