import React from 'react';
import { NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COLORS } from '../utils/constants';
import { useAuthStore } from '../store/useAuthStore';
import { Room } from '../models/Room';
import { QRInfo } from '../models/Booking';

import CustomerTabNavigator, { CustomerTabParamList } from './CustomerTabNavigator';
import AuthScreen from '../screens/customer/AuthScreen';
import RoomDetailScreen from '../screens/customer/RoomDetailScreen';
import BookingFormScreen from '../screens/customer/BookingFormScreen';
import BookingSuccessScreen from '../screens/customer/BookingSuccessScreen';
import ChatScreen from '../screens/customer/ChatScreen';
import ServicesScreen from '../screens/customer/ServicesScreen';
import PaymentScreen from '../screens/customer/PaymentScreen';
import InvoiceScreen from '../screens/customer/InvoiceScreen';

export type BookingDataParam = {
  roomId: string;
  roomName: string;
  roomType: string;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  guests: number;
  pricePerNight: number;
  specialRequests?: string;
  voucherCode?: string;
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationality: string;
    idNumber?: string;
    idType?: string;
  };
};

export type RootStackParamList = {
  Auth: undefined;
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  RoomDetail: { room: Room };
  BookingForm: undefined;
  Services: { bookingCode?: string } | undefined;
  Payment: {
    bookingCode: string;
    qrInfo?: QRInfo;
    depositRequired?: number;
  };
  BookingSuccess: { bookingId: string };
  Chat: undefined;
  Invoice: { bookingId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.surface,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="CustomerTabs" component={CustomerTabNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="RoomDetail" component={RoomDetailScreen} options={{ title: 'Chi tiết phòng' }} />
            <Stack.Screen name="BookingForm" component={BookingFormScreen} options={{ title: 'Thông tin đặt phòng' }} />
            <Stack.Screen
              name="Services"
              component={ServicesScreen}
              options={{ title: 'Dịch vụ phòng' }}
            />
            <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Thanh toán' }} />
            <Stack.Screen name="BookingSuccess" component={BookingSuccessScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Trợ lý ảo hỗ trợ' }} />
            <Stack.Screen name="Invoice" component={InvoiceScreen} options={{ title: 'Chi tiết hóa đơn' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
