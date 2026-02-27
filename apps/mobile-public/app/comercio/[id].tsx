import {
  calcularDistanciaHaversineKm,
  calcularTiempoEnVehiculo,
  formatearMonedaUSD,
  formatearTelefonoDisplay,
  formatearTelefonoHref,
  resolverPlanComercio,
} from '@findixi/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenState } from '../../src/components/ScreenState';
import { fetchComercioById } from '../../src/features/comercios/api';
import type { ComercioRow } from '../../src/features/comercios/types';
import { requestUserLocation, type UserLocation } from '../../src/lib/location';

function parseId(value: string | string[] | undefined): number {
  if (Array.isArray(value)) return Number(value[0] ?? 0);
  return Number(value ?? 0);
}

export default function ComercioDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseId(params.id);

  const [item, setItem] = useState<ComercioRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<UserLocation | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) {
      setError('ID de comercio invalido');
      setLoading(false);
      return;
    }

    let active = true;
    const run = async () => {
      setError('');
      setLoading(true);
      try {
        const data = await fetchComercioById(id);
        if (!active) return;
        setItem(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar el comercio');
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [id]);

  const plan = useMemo(() => resolverPlanComercio(item || {}), [item]);

  const distanceText = useMemo(() => {
    if (!item || !location || item.latitud == null || item.longitud == null) return 'Sin distancia';
    const distanceKm = calcularDistanciaHaversineKm(
      location.latitude,
      location.longitude,
      Number(item.latitud),
      Number(item.longitud)
    );
    const travel = calcularTiempoEnVehiculo(distanceKm);
    return `${distanceKm.toFixed(1)} km - ${travel.texto}`;
  }, [item, location]);

  const phoneHref = formatearTelefonoHref(item?.telefono ?? '');

  if (loading) return <ScreenState loading message="Cargando perfil comercio..." />;
  if (error) return <ScreenState message={`Error: ${error}`} />;
  if (!item) return <ScreenState message="Comercio no encontrado." />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{item.nombre}</Text>
      <Text style={styles.meta}>Municipio: {item.municipio || 'No disponible'}</Text>
      <Text style={styles.meta}>Direccion: {item.direccion || 'No disponible'}</Text>
      <Text style={styles.meta}>Plan: {plan.nombre}</Text>
      <Text style={styles.meta}>Precio plan: {formatearMonedaUSD(plan.precio, { fallback: 'Gratis' })}</Text>
      <Text style={styles.meta}>Distancia: {distanceText}</Text>

      {item.descripcion ? <Text style={styles.description}>{item.descripcion}</Text> : null}

      {phoneHref ? (
        <Pressable style={styles.button} onPress={() => void Linking.openURL(phoneHref)}>
          <Text style={styles.buttonText}>Llamar: {formatearTelefonoDisplay(item.telefono ?? '')}</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.secondaryButton}
        onPress={() =>
          void requestUserLocation()
            .then(setLocation)
            .catch(() => setLocation(null))
        }
      >
        <Text style={styles.secondaryButtonText}>Actualizar ubicacion</Text>
      </Pressable>

      <View style={styles.flagsWrap}>
        <Text style={styles.flagsTitle}>Flags de plan (shared/rules)</Text>
        <Text style={styles.flag}>Perfil: {plan.permite_perfil ? 'si' : 'no'}</Text>
        <Text style={styles.flag}>Menu: {plan.permite_menu ? 'si' : 'no'}</Text>
        <Text style={styles.flag}>Especiales: {plan.permite_especiales ? 'si' : 'no'}</Text>
        <Text style={styles.flag}>Ordenes: {plan.permite_ordenes ? 'si' : 'no'}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  title: {
    fontSize: 24,
    color: '#0f172a',
    fontWeight: '700',
  },
  meta: {
    fontSize: 14,
    color: '#334155',
  },
  description: {
    marginTop: 8,
    color: '#1e293b',
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontWeight: '600',
  },
  flagsWrap: {
    marginTop: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  flagsTitle: {
    color: '#0f172a',
    fontWeight: '700',
  },
  flag: {
    color: '#475569',
    fontSize: 13,
  },
});
