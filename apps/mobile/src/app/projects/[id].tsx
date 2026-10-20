import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useMobileData } from '@/providers/mobile-data-provider';

export default function ProjectDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { selectProject } = useMobileData();
  const [message, setMessage] = useState('Opening project…');

  useEffect(() => {
    if (!id) {
      router.replace('/(tabs)');
      return;
    }
    void selectProject(id)
      .then(() => router.replace('/(tabs)'))
      .catch(() => {
        setMessage('That project could not be opened. Returning to your saved dashboard…');
        setTimeout(() => router.replace('/(tabs)'), 1200);
      });
  }, [id, selectProject]);

  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
    <ActivityIndicator />
    <Text style={{ textAlign: 'center' }}>{message}</Text>
  </View>;
}
