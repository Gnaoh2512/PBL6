import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../utils/constants';

import HomeScreen from '../screens/customer/HomeScreen';
import RoomsScreen from '../screens/customer/RoomsScreen';
import MyBookingsScreen from '../screens/customer/MyBookingsScreen';
import ContactScreen from '../screens/customer/ContactScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';

export type CustomerTabParamList = {
  Home: undefined;
  Rooms: undefined;
  MyBookings: undefined;
  Contact: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<CustomerTabParamList>();

export default function CustomerTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.secondary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: FONTS.sizes.xs,
          fontWeight: FONTS.weights.medium,
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home',
            Rooms: 'bed',
            MyBookings: 'receipt',
            Contact: 'call',
            Profile: 'person-outline',
          };
          return (
            <Ionicons name={icons[route.name]} size={size} color={color} />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Trang chủ' }} />
      <Tab.Screen name="Rooms" component={RoomsScreen} options={{ tabBarLabel: 'Phòng' }} />
      <Tab.Screen name="MyBookings" component={MyBookingsScreen} options={{ tabBarLabel: 'Lịch sử' }} />
      <Tab.Screen name="Contact" component={ContactScreen} options={{ tabBarLabel: 'Liên hệ' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Cá nhân' }} />
    </Tab.Navigator>
  );
}
