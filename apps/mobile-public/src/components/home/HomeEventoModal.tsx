import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { getEventoI18n } from '../../features/home/eventoI18n';
import type { HomeEventoCard, HomeEventoFechaItem } from '../../features/home/types';
import { useI18n } from '../../i18n/provider';
import { borderRadius, fonts, spacing } from '../../theme/tokens';

type HomeEventoModalProps = {
  visible: boolean;
  event: HomeEventoCard | null;
  onClose: () => void;
};

type EventDateGroup = {
  key: string;
  municipio: string;
  lugar: string;
  fechas: HomeEventoFechaItem[];
  enlaceboletos: string | null;
};

function capitalizeFirst(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeAmount(rawValue: string): string {
  const raw = rawValue.trim();
  if (!raw) return '';
  const withoutSymbol = raw.replace(/^\s*\$\s*/, '');
  const isNumericLike = /^[\d,.]+$/.test(withoutSymbol);
  if (!raw.startsWith('$') && isNumericLike) return `$${withoutSymbol}`;
  return raw;
}

function buildEventDateGroups(items: HomeEventoFechaItem[]): EventDateGroup[] {
  const groups = new Map<string, EventDateGroup>();
  items.forEach((item) => {
    const municipio = item.municipioNombre || '';
    const lugar = item.lugar || '';
    const key = `${municipio}||${lugar}`;
    const existing = groups.get(key);
    if (existing) {
      existing.fechas.push(item);
      if (!existing.enlaceboletos && item.enlaceboletos) {
        existing.enlaceboletos = item.enlaceboletos;
      }
      return;
    }

    groups.set(key, {
      key,
      municipio,
      lugar,
      fechas: [item],
      enlaceboletos: item.enlaceboletos || null,
    });
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    fechas: [...group.fechas].sort((a, b) => a.fecha.localeCompare(b.fecha)),
  }));
}

export function HomeEventoModal({ visible, event, onClose }: HomeEventoModalProps) {
  const { lang, t } = useI18n();
  const [showAllDates, setShowAllDates] = useState(false);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [isVertical45, setIsVertical45] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [blinkOn, setBlinkOn] = useState(true);
  const [resolvedEvent, setResolvedEvent] = useState<HomeEventoCard | null>(event);

  const translatingLabel = (() => {
    const langNorm = (lang || 'es').toLowerCase().split('-')[0];
    if (langNorm === 'en') return 'Translating...';
    if (langNorm === 'fr') return 'Traduction...';
    if (langNorm === 'de') return 'Wird ubersetzt...';
    if (langNorm === 'pt') return 'Traduzindo...';
    if (langNorm === 'it') return 'Traduzione in corso...';
    if (langNorm === 'zh') return '正在翻译...';
    if (langNorm === 'ko') return '번역 중...';
    if (langNorm === 'ja') return '翻訳中...';
    return 'Traduciendo...';
  })();

  useEffect(() => {
    setResolvedEvent(event);
  }, [event]);

  useEffect(() => {
    if (!visible || !event) return;
    let active = true;
    const langNorm = (lang || 'es').toLowerCase().split('-')[0];
    const shouldTranslate = langNorm !== 'es';
    setIsTranslating(shouldTranslate);
    if (!shouldTranslate) {
      setResolvedEvent(event);
      return () => {
        active = false;
      };
    }

    void getEventoI18n(event, lang)
      .then((next) => {
        if (!active) return;
        setResolvedEvent(next);
      })
      .catch(() => {
        if (!active) return;
        setResolvedEvent(event);
      })
      .finally(() => {
        if (!active) return;
        setIsTranslating(false);
      });

    return () => {
      active = false;
    };
  }, [event, lang, visible]);

  useEffect(() => {
    if (!visible) {
      setShowAllDates(false);
      setZoomVisible(false);
      setIsTranslating(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!isTranslating) {
      setBlinkOn(true);
      return;
    }
    const timer = setInterval(() => {
      setBlinkOn((value) => !value);
    }, 450);
    return () => clearInterval(timer);
  }, [isTranslating]);

  useEffect(() => {
    setIsVertical45(false);
    const imageUrl = resolvedEvent?.imageUrl || '';
    if (!imageUrl) return;

    Image.getSize(
      imageUrl,
      (width, height) => {
        const ratio = width / height;
        const vertical45 = height > width && ratio >= 0.72 && ratio <= 0.9;
        setIsVertical45(vertical45);
      },
      () => {
        setIsVertical45(false);
      }
    );
  }, [resolvedEvent?.imageUrl]);

  const orderedDates = useMemo(
    () =>
      [...(resolvedEvent?.eventoFechas || [])]
        .filter((item) => Boolean(item.fecha))
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [resolvedEvent?.eventoFechas]
  );

  const todayISO = new Date().toISOString().slice(0, 10);
  const primaryDate = useMemo(() => {
    if (!orderedDates.length) return null;
    return orderedDates.find((item) => item.fecha >= todayISO) || orderedDates[orderedDates.length - 1];
  }, [orderedDates, todayISO]);

  const locale = lang === 'es' ? 'es-PR' : lang;
  const groups = useMemo(() => buildEventDateGroups(orderedDates), [orderedDates]);

  if (!resolvedEvent) return null;

  const municipiosUnicos = Array.from(
    new Set(orderedDates.map((item) => item.municipioNombre || String(item.municipioId || '')).filter(Boolean))
  );
  const lugaresUnicos = Array.from(new Set(orderedDates.map((item) => item.lugar || '').filter(Boolean)));
  const hasManyLocations = municipiosUnicos.length > 1 || lugaresUnicos.length > 1;

  const baseSede = orderedDates.find((item) => item.lugar || item.direccion);
  const lugarText = hasManyLocations
    ? t('evento.variosMunicipios')
    : baseSede?.lugar || resolvedEvent.lugar || 'Lugar no especificado';
  const direccionText = hasManyLocations ? '' : baseSede?.direccion || resolvedEvent.direccion || '';

  const hasLocalTickets = orderedDates.some((item) => Boolean(item.enlaceboletos));
  const useTicketsByLocation =
    resolvedEvent.boletosPorLocalidad || (!resolvedEvent.enlaceBoletosGlobal && hasLocalTickets);
  const globalTicketLink = !useTicketsByLocation ? resolvedEvent.enlaceBoletosGlobal : null;

  const costoText = (() => {
    if (resolvedEvent.gratis) return t('area.gratis');
    const costo = (resolvedEvent.costo || '').trim();
    if (!costo) return '';

    const lower = costo.toLowerCase();
    if (lower.startsWith('desde')) {
      const value = costo.replace(/^desde\s*:?/i, '').trim();
      return `${t('evento.desde')} ${normalizeAmount(value)}`;
    }
    if (lower.startsWith('costo')) return costo;
    return `${t('area.costo')} ${normalizeAmount(costo)}`;
  })();

  const primaryDateText = primaryDate
    ? capitalizeFirst(
        new Date(primaryDate.fecha).toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      )
    : '';

  const primaryTimeText = primaryDate?.horainicio
    ? new Date(`1970-01-01T${primaryDate.horainicio}`).toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  const openZoom = () => {
    setZoomVisible(true);
  };

  return (
    <>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropDismiss} onPress={onClose} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {resolvedEvent.nombre || 'Evento sin título'}
              </Text>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>×</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
              <Pressable style={styles.imageShell} onPress={openZoom}>
                <Image
                  source={{ uri: resolvedEvent.imageUrl || 'https://placehold.co/560x400?text=Evento' }}
                  style={[styles.modalImage, isVertical45 ? styles.modalImageVertical45 : null]}
                  resizeMode="contain"
                />
                <View style={styles.zoomHint}>
                  <Ionicons name="expand-outline" size={16} color="#ffffff" />
                </View>
              </Pressable>

              {isTranslating ? (
                <View style={styles.translateLoadingWrap}>
                  <Text style={[styles.translateLoadingText, !blinkOn ? styles.translateLoadingTextDim : null]}>
                    {translatingLabel}
                  </Text>
                  <View style={styles.skeletonLineLg} />
                  <View style={styles.skeletonLineLg} />
                  <View style={styles.skeletonLineMd} />
                  <View style={styles.skeletonGap} />
                  <View style={styles.skeletonLineSm} />
                  <View style={styles.skeletonLineSm} />
                  <View style={styles.skeletonLineXs} />
                </View>
              ) : (
                <>
                  <Text style={styles.descriptionText}>
                    {resolvedEvent.descripcion?.trim() ? resolvedEvent.descripcion : t('evento.sinDescripcion')}
                  </Text>

                  {primaryDateText ? <Text style={styles.primaryDate}>{primaryDateText}</Text> : null}
                  {primaryTimeText ? <Text style={styles.primaryTime}>{primaryTimeText}</Text> : null}

                  {orderedDates.length > 1 ? (
                    <Pressable style={styles.toggleDatesBtn} onPress={() => setShowAllDates((value) => !value)}>
                      <Text style={styles.toggleDatesText}>
                        {showAllDates ? t('evento.ocultarFechas') : t('evento.verFechas', { count: orderedDates.length })}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Text style={styles.placeText}>{lugarText}</Text>
                  {direccionText ? <Text style={styles.addressText}>{direccionText}</Text> : null}

                  {costoText ? <Text style={styles.costText}>{costoText}</Text> : null}

                  {globalTicketLink ? (
                    <Pressable style={styles.buyButton} onPress={() => void Linking.openURL(globalTicketLink)}>
                      <Text style={styles.buyButtonText}>{t('evento.comprarBoletos')}</Text>
                    </Pressable>
                  ) : null}

                  {showAllDates ? (
                    <View style={styles.groupList}>
                      {groups.map((group) => (
                        <View key={group.key} style={styles.groupCard}>
                          <Text style={styles.groupMunicipio}>{group.municipio || t('area.municipio')}</Text>
                          {group.lugar ? <Text style={styles.groupLugar}>{group.lugar}</Text> : null}

                          <View style={styles.groupDateList}>
                            {group.fechas.map((item) => {
                              const fechaLabel = capitalizeFirst(
                                new Date(item.fecha).toLocaleDateString(locale, {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })
                              );
                              const horaLabel = item.horainicio
                                ? new Date(`1970-01-01T${item.horainicio}`).toLocaleTimeString(locale, {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })
                                : '';
                              const line = horaLabel ? `${fechaLabel} • ${horaLabel}` : fechaLabel;

                              return (
                                <Text key={`${group.key}-${item.fecha}-${item.horainicio}`} style={styles.groupDateLine}>
                                  {line}
                                </Text>
                              );
                            })}
                          </View>

                          {useTicketsByLocation && group.enlaceboletos ? (
                            <Pressable style={[styles.buyButton, styles.groupBuyBtn]} onPress={() => void Linking.openURL(group.enlaceboletos as string)}>
                              <Text style={styles.buyButtonText}>{t('evento.comprarBoletos')}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={zoomVisible} animationType="fade" onRequestClose={() => setZoomVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setZoomVisible(false)}>
          <View style={styles.zoomOverlay}>
            <TouchableWithoutFeedback onPress={() => undefined}>
              <View style={styles.zoomCard}>
                <Pressable style={styles.zoomCloseBtn} onPress={() => setZoomVisible(false)} hitSlop={16}>
                  <Text style={styles.zoomCloseText}>×</Text>
                </Pressable>
                <ScrollView
                  style={styles.zoomScroll}
                  contentContainerStyle={styles.zoomScrollContent}
                  minimumZoomScale={1}
                  maximumZoomScale={4}
                  centerContent
                >
                  <Image
                    source={{ uri: resolvedEvent.imageUrl || 'https://placehold.co/560x400?text=Evento' }}
                    style={styles.zoomImage}
                    resizeMode="contain"
                  />
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '95%',
    height: '85%',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: '#231F20',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 30,
    textAlign: 'center',
    fontFamily: fonts.medium,
    lineHeight: 34,
  },
  closeBtn: {
    position: 'absolute',
    right: spacing.sm,
    top: 2,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 52,
    lineHeight: 52,
    fontFamily: fonts.light,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  imageShell: {
    width: '100%',
    aspectRatio: 7 / 5,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalImageVertical45: {
    width: '72%',
  },
  zoomHint: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  descriptionText: {
    width: '100%',
    color: '#374151',
    textAlign: 'justify',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  translateLoadingWrap: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  translateLoadingText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  translateLoadingTextDim: {
    opacity: 0.36,
  },
  skeletonGap: {
    height: spacing.sm,
  },
  skeletonLineLg: {
    width: '100%',
    height: 14,
    borderRadius: borderRadius.pill,
    backgroundColor: '#d1d5db',
  },
  skeletonLineMd: {
    width: '82%',
    height: 14,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    backgroundColor: '#d1d5db',
  },
  skeletonLineSm: {
    width: '62%',
    height: 16,
    alignSelf: 'center',
    borderRadius: borderRadius.pill,
    backgroundColor: '#d1d5db',
  },
  skeletonLineXs: {
    width: '40%',
    height: 16,
    alignSelf: 'center',
    borderRadius: borderRadius.pill,
    backgroundColor: '#d1d5db',
  },
  primaryDate: {
    color: '#dc2626',
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.semibold,
  },
  primaryTime: {
    color: '#4b5563',
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 26,
    fontFamily: fonts.medium,
  },
  toggleDatesBtn: {
    paddingTop: 2,
  },
  toggleDatesText: {
    color: '#6b7280',
    textDecorationLine: 'underline',
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  placeText: {
    color: '#374151',
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 28,
    fontFamily: fonts.semibold,
  },
  addressText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.regular,
  },
  costText: {
    color: '#16a34a',
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 34,
    fontFamily: fonts.medium,
    marginTop: spacing.xs,
  },
  buyButton: {
    backgroundColor: '#2563eb',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  buyButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: fonts.semibold,
  },
  groupList: {
    width: '100%',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  groupCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  groupMunicipio: {
    color: '#1f2937',
    fontSize: 18,
    fontFamily: fonts.semibold,
    textAlign: 'center',
  },
  groupLugar: {
    color: '#4b5563',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  groupDateList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
    alignItems: 'center',
  },
  groupDateLine: {
    color: '#4b5563',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  groupBuyBtn: {
    marginTop: spacing.sm,
  },
  zoomOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomCard: {
    width: '94%',
    height: '84%',
    position: 'relative',
  },
  zoomScroll: {
    width: '100%',
    height: '100%',
  },
  zoomScrollContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImage: {
    width: '100%',
    height: '100%',
  },
  zoomCloseBtn: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    zIndex: 5,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomCloseText: {
    color: '#ffffff',
    fontSize: 46,
    lineHeight: 46,
    fontFamily: fonts.light,
  },
});
