import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortfolioProvider } from '@/context/PortfolioContext';
import { AppNavigator } from '@/navigation/AppNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PortfolioProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </PortfolioProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
