import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AccountScreen } from '@/screens/AccountScreen';
import { ConsolidatedScreen } from '@/screens/ConsolidatedScreen';
import { colors } from '@/theme';

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

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textDim,
        }}
      >
        <Tab.Screen
          name="Accounts"
          component={AccountScreen}
          options={{
            title: '계좌',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>💼</Text>
            ),
          }}
        />
        <Tab.Screen
          name="Consolidated"
          component={ConsolidatedScreen}
          options={{
            title: '통합',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>📊</Text>
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
