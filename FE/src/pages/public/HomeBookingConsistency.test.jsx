import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HomePage from './HomePage';
import BookingPage from './BookingPage';
import { ToastProvider } from '../../contexts/ToastContext';
import { AuthProvider } from '../../contexts/AuthContext';

const MOCK_ROOM_TYPES = [
  {
    roomTypeId: 1,
    typeName: 'Standard Garden',
    capacity: 2,
    basePrice: 800000,
    amenities: 'Wifi, TV, Điều hòa',
    description: 'Phòng tiêu chuẩn hướng vườn yên tĩnh.',
  },
  {
    roomTypeId: 2,
    typeName: 'Deluxe Ocean',
    capacity: 3,
    basePrice: 1500000,
    amenities: 'Wifi, Ban công hướng biển, Minibar',
    description: 'Phòng Deluxe có ban công ngắm trọn bình minh trên biển.',
  },
];

const MOCK_AVAILABLE_ROOMS = [
  {
    roomId: 101,
    roomNumber: '101',
    floor: 1,
    status: 'AVAILABLE',
    roomType: MOCK_ROOM_TYPES[0],
    pricePerNight: 800000,
  },
  {
    roomId: 201,
    roomNumber: '201',
    floor: 2,
    status: 'AVAILABLE',
    roomType: MOCK_ROOM_TYPES[1],
    pricePerNight: 1500000,
  },
];

function mockFetchImplementation(url) {
  const path = String(url);
  if (path.includes('/api/public/rooms/room-types')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: MOCK_ROOM_TYPES }),
    });
  }
  if (path.includes('/api/public/rooms/available')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: MOCK_AVAILABLE_ROOMS }),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data: [] }),
  });
}

describe('HomePage and BookingPage room catalog consistency', () => {
  beforeEach(() => {
    global.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    global.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
    window.scrollTo = vi.fn();
    vi.spyOn(global, 'fetch').mockImplementation(mockFetchImplementation);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('displays real room types on HomePage and preserves exact name, info and price on BookingPage', async () => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/booking" element={<BookingPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthProvider>,
    );

    // HomePage displays real backend room types and prices instead of hardcoded mock rooms
    expect(await screen.findByText('Standard Garden')).toBeInTheDocument();
    expect(screen.getByText('Deluxe Ocean')).toBeInTheDocument();
    expect(screen.getByText('800.000 đ')).toBeInTheDocument();
    expect(screen.getByText('1.500.000 đ')).toBeInTheDocument();
    expect(screen.queryByText('Suite Sân Hiên Biển')).not.toBeInTheDocument();

    // Clicking "Đặt Deluxe Ocean" navigates to BookingPage with the matching room selected
    await user.click(screen.getByRole('button', { name: 'Đặt Deluxe Ocean' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Deluxe Ocean' })).toBeInTheDocument();
    });
    expect(screen.getByText('Phòng Deluxe có ban công ngắm trọn bình minh trên biển.')).toBeInTheDocument();
    expect(screen.getByText('1.500.000 đ / đêm')).toBeInTheDocument();
  });
});
