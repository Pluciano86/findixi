import {
  calcularDistanciaHaversineKm,
  calcularTiempoEnVehiculo,
  formatearTelefonoDisplay,
  formatearTelefonoHref,
  resolverPlanComercio,
} from '@findixi/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ScreenState } from '../src/components/ScreenState';
import { fetchComercios } from '../src/features/comercios/api';
import type { ComercioListItem } from '../src/features/comercios/types';
import { requestUserLocation, type UserLocation } from '../src/lib/location';

function formatDistanceText(item: ComercioListItem, location: UserLocation | null): string {
  if (!location || item.latitud == null || item.longitud == null) return 'Sin distancia';

  const distanceKm = calcularDistanciaHaversineKm(
    location.latitude,
    location.longitude,
    Number(item.latitud),
    Number(item.longitud)
  );
  const travel = calcularTiempoEnVehiculo(distanceKm);

  return `${distanceKm.toFixed(1)} km - ${travel.texto}`;
}

export default function ComerciosScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ComercioListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<UserLocation | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fetchComercios();
      setItems(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar el listado';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const requestLocation = useCallback(async () => {
    try {
      const coords = await requestUserLocation();
      setLocation(coords);
    } catch {
      setLocation(null);
    }
  }, []);

  const summary = useMemo(() => {
    if (!items.length) return '0 comercios';
    return `${items.length} comercios cargados`;
  }, [items]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  if (loading) return <ScreenState loading message="Cargando comercios..." />;

  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenState message={`Error: ${error}`} />
        <Pressable style={styles.retryButton} onPress={() => void load()}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Text style={styles.summary}>{summary}</Text>
        <Pressable style={styles.geoButton} onPress={requestLocation}>
          <Text style={styles.geoButtonText}>{location ? 'Ubicacion activa' : 'Usar ubicacion'}</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const plan = resolverPlanComercio(item);
          const phoneText = formatearTelefonoDisplay(item.telefono ?? '');
          const phoneHref = formatearTelefonoHref(item.telefono ?? '');

          return (
            <Pressable
              style={styles.card}
              onPress={() => {
                router.push({ pathname: '/comercio/[id]', params: { id: String(item.id) } });
              }}
            >
              <Text style={styles.name}>{item.nombre}</Text>
              <Text style={styles.meta}>{item.municipio || 'Municipio no disponible'}</Text>
              <Text style={styles.meta}>Plan: {plan.nombre}</Text>
              <Text style={styles.meta}>{formatDistanceText(item, location)}</Text>

              {phoneHref ? (
                <Pressable style={styles.phonePill} onPress={() => void Linking.openURL(phoneHref)}>
                  <Text style={styles.phonePillText}>{phoneText || 'Llamar'}</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={<ScreenState message="No hay comercios para mostrar." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summary: {
    color: '#0f172a',
    fontWeight: '600',
  },
  geoButton: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  geoButtonText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 4,
  },
  name: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '700',
  },
  meta: {
    color: '#475569',
    fontSize: 13,
  },
  phonePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: '#0f766e',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  phonePillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  retryButton: {
    alignSelf: 'center',
    marginTop: 6,
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
