import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PublicAppChrome } from '../src/components/layout/PublicAppChrome';
import { HomeAreasGrid } from '../src/components/home/HomeAreasGrid';
import { HomeBusinessCta } from '../src/components/home/HomeBusinessCta';
import { HomeCarousel } from '../src/components/home/HomeCarousel';
import { HomeCategoriesGrid } from '../src/components/home/HomeCategoriesGrid';
import { HomeComercioRail } from '../src/components/home/HomeComercioRail';
import { HomeEspecialesCard } from '../src/components/home/HomeEspecialesCard';
import { HomeEventosRail } from '../src/components/home/HomeEventosRail';
import { HomeEventoModal } from '../src/components/home/HomeEventoModal';
import { HomeHeroPlaya } from '../src/components/home/HomeHeroPlaya';
import { HomeLoadingBlock } from '../src/components/home/HomeLoadingBlock';
import { HomeSectionTitle } from '../src/components/home/HomeSectionTitle';
import { fetchHomeIndexData } from '../src/features/home/api';
import { preloadEventoTraducciones } from '../src/features/home/eventoI18n';
import { useI18n } from '../src/i18n/provider';
import type { HomeEventoCard, HomeIndexData } from '../src/features/home/types';
import { backgroundGray, fonts, spacing } from '../src/theme/tokens';

const EMPTY_HOME_DATA: HomeIndexData = {
  topBanners: [],
  categories: [],
  comidaCards: [],
  jangueoCards: [],
  eventos: [],
  areas: [],
};

export default function HomeScreen() {
  const { lang, t } = useI18n();
  const [data, setData] = useState<HomeIndexData>(EMPTY_HOME_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [heroPlaybackUnlocked, setHeroPlaybackUnlocked] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<HomeEventoCard | null>(null);

  const loadHomeData = useCallback(async () => {
    setError('');
    try {
      const next = await fetchHomeIndexData();
      setData(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('home.loadError');
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void loadHomeData();
  }, [loadHomeData]);

  useEffect(() => {
    if (!data.eventos.length) return;
    void preloadEventoTraducciones(
      data.eventos.map((item) => item.id).filter((id) => Number.isFinite(id) && id > 0),
      lang
    );
  }, [data.eventos, lang]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHomeData();
  }, [loadHomeData]);

  const unlockHeroPlayback = useCallback(() => {
    setHeroPlaybackUnlocked((current) => (current ? current : true));
  }, []);

  return (
    <PublicAppChrome>
      {({ onScroll, scrollEventThrottle, contentPaddingStyle }) => (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, contentPaddingStyle]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          onScrollBeginDrag={unlockHeroPlayback}
          onTouchStart={unlockHeroPlayback}
        >
          <HomeCarousel items={data.topBanners} />

          <HomeSectionTitle title={t('home.categoriesTitle')} />
          <HomeCategoriesGrid items={data.categories} />

          <HomeEspecialesCard />

          <HomeSectionTitle title={t('home.comidaTitle')} />
          {loading ? (
            <HomeLoadingBlock text={t('home.loadingRestaurants')} />
          ) : (
            <HomeComercioRail
              items={data.comidaCards}
              emptyText={t('home.emptyRestaurants')}
            />
          )}

          <View style={styles.separatorSpace} />

          <HomeSectionTitle title={t('home.jangueoTitle')} />
          {loading ? (
            <HomeLoadingBlock text={t('home.loadingJangueo')} />
          ) : (
            <HomeComercioRail
              items={data.jangueoCards}
              emptyText={t('home.emptyJangueo')}
              autoplayDirection="reverse"
            />
          )}

          <View style={styles.separatorSpace} />

          <HomeSectionTitle title={t('home.eventsTitle')} />
          {loading ? (
            <HomeLoadingBlock text={t('home.loadingEvents')} />
          ) : (
            <HomeEventosRail items={data.eventos} onPressEvent={setSelectedEvento} />
          )}

          <HomeHeroPlaya canPlay={heroPlaybackUnlocked} />

          <View style={styles.areaTitleWrap}>
            <Text style={styles.areaTitle}>{t('home.areaTitle')}</Text>
          </View>
          {loading ? <HomeLoadingBlock text={t('home.loadingAreas')} /> : <HomeAreasGrid items={data.areas} />}

          <HomeBusinessCta />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <HomeEventoModal
            visible={Boolean(selectedEvento)}
            event={selectedEvento}
            onClose={() => setSelectedEvento(null)}
          />
        </ScrollView>
      )}
    </PublicAppChrome>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: backgroundGray,
  },
  scrollContent: {
    paddingBottom: spacing.xl + spacing.md,
  },
  separatorSpace: {
    height: spacing.xl,
  },
  areaTitleWrap: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  areaTitle: {
    textAlign: 'center',
    color: '#111827',
    fontSize: 28,
    fontFamily: fonts.medium,
  },
  errorText: {
    color: '#b91c1c',
    textAlign: 'center',
    fontSize: 12,
    fontFamily: fonts.regular,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});
