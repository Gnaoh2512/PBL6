import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { COLORS } from './src/utils/constants';
import { useAuthStore } from './src/store/useAuthStore';
import { authService } from './src/services/authService';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      try {
        await useAuthStore.persist.rehydrate();
        if (useAuthStore.getState().token) {
          try {
            const user = await authService.getMe();
            useAuthStore.getState().setUser(user);
          } catch (error: any) {
            if (error?.response?.status === 401 || error?.status === 401) {
              useAuthStore.getState().logout();
            }
            // Keep an existing session on network/server errors; retry on a protected request.
          }
        }
      } finally {
        if (mounted) setAuthReady(true);
      }
    };
    restoreSession();
    return () => { mounted = false; };
  }, []);

  if (!fontsLoaded || !authReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
