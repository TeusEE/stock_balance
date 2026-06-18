import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AccountScreen } from '@/screens/AccountScreen';
import { ConsolidatedScreen } from '@/screens/ConsolidatedScreen';
import { BrowseScreen } from '@/screens/BrowseScreen';
import { colors } from '@/theme';
import { SCREENSHOT_ENABLED, screenshotInitialTab } from '@/utils/screenshot';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bg,
    border: colors.border,
    text: colors.text,
    primary: colors.primary,
  },
};

export const AppNavigator = () => {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        initialRouteName={SCREENSHOT_ENABLED ? screenshotInitialTab() : undefined}
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textDim,
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 4,
          },
        }}
      >
        <Tab.Screen
          name="Accounts"
          component={AccountScreen}
          options={{ title: '계좌' }}
        />
        <Tab.Screen
          name="Consolidated"
          component={ConsolidatedScreen}
          options={{ title: '통합' }}
        />
        <Tab.Screen
          name="Browse"
          component={BrowseScreen}
          options={{ title: '둘러보기' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
