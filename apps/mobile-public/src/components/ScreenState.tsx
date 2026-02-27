import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type ScreenStateProps = {
  loading?: boolean;
  message: string;
};

export function ScreenState({ loading = false, message }: ScreenStateProps) {
  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator size="small" color="#0f766e" /> : null}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    color: '#334155',
    fontSize: 14,
    textAlign: 'center',
  },
});
