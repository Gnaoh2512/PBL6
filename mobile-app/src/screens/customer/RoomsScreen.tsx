import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHotelStore } from '../../store/useHotelStore';
import { Room } from '../../models/Room';
import RoomCard from '../../components/rooms/RoomCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import HeaderBackButton from '../../components/common/HeaderBackButton';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { COLORS, FONTS, SPACING } from '../../utils/constants';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RoomsScreen() {
  const insets = useSafeAreaInsets();
  const { rooms, isLoading, error, loadRooms } = useHotelStore();
  const navigation = useNavigation<Nav>();

  useEffect(() => {
    loadRooms();
  }, []);

  const handleRoomPress = (room: Room) => {
    navigation.navigate('RoomDetail', { room });
  };

  if (isLoading && rooms.length === 0) {
    return <LoadingSpinner fullScreen message="Đang tải danh sách phòng..." />;
  }

  if (error && rooms.length === 0) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Không thể tải danh sách phòng</Text>
          <Text style={styles.errorDetail}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.headerRow}>
          <HeaderBackButton style={styles.backBtn} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Các loại phòng</Text>
            <Text style={styles.subtitle}>{rooms.length} loại phòng có sẵn</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RoomCard room={item} onPress={handleRoomPress} />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: SPACING.xl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.primary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: SPACING.xs,
    marginLeft: -SPACING.xs,
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.surface,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  list: { paddingTop: SPACING.md, paddingBottom: SPACING.xl },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.error,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});
