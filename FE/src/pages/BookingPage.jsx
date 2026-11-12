import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Modal from "../components/Modal";
import { apiCall, formatVND, getAuthUser } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import DatePicker from "../components/DatePicker";
import SelectMenu from "../components/SelectMenu";
import { addDaysISO, todayISO } from "../components/dateUtils";
import "./BookingPage.css";

const getTodayStr = todayISO;
const getTomorrowStr = () => addDaysISO(todayISO(), 1);

const ID_TYPE_OPTIONS = [
  { value: "CCCD", label: "CCCD / Căn cước" },
  { value: "PASSPORT", label: "Hộ chiếu (Passport)" },
  { value: "OTHER", label: "Khác" },
];

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6].map((count) => ({ value: String(count), label: `${count} khách` }));

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  const queryRoomId = searchParams.get("roomId") || "";
  const queryCheckIn = searchParams.get("checkIn") || "";
  const queryCheckOut = searchParams.get("checkOut") || "";
  const queryGuests = searchParams.get("guests") || "2";

  const [availableRooms, setAvailableRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState(queryRoomId);
  const [checkInDate, setCheckInDate] = useState(() => queryCheckIn || getTodayStr());
  const [checkOutDate, setCheckOutDate] = useState(() => queryCheckOut || getTomorrowStr());
  const [guestCount, setGuestCount] = useState(queryGuests);

  const authUser = getAuthUser();
  const [fullName, setFullName] = useState(authUser?.fullName || "");
  const [phone, setPhone] = useState(authUser?.phone || "");
  const [email, setEmail] = useState(authUser?.email || "");
  const [nationality, setNationality] = useState("Việt Nam");
  const [idType, setIdType] = useState("CCCD");
  const [idNumber, setIdNumber] = useState("");
  const [note, setNote] = useState("");

  // Voucher
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  // Form submit & QR modal
  const [submitting, setSubmitting] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [bookingData, setBookingData] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [qrImageFailed, setQrImageFailed] = useState(false);

  const pollingRef = useRef(null);
  const containerRef = useRef(null);

  // Make the page content exactly as wide (and aligned) as the navbar content.
  useLayoutEffect(() => {
    const el = containerRef.current;
    const navInner = document.querySelector("header.hc-navbar .hc-container");
    if (!el || !navInner) return undefined;
    const sync = () => {
      const style = getComputedStyle(navInner);
      const rect = navInner.getBoundingClientRect();
      const padLeft = parseFloat(style.paddingLeft) || 0;
      const padRight = parseFloat(style.paddingRight) || 0;
      const parentLeft = el.parentElement.getBoundingClientRect().left;
      el.style.setProperty("--bk-content-width", `${rect.width - padLeft - padRight}px`);
      el.style.setProperty("--bk-content-offset", `${rect.left + padLeft - parentLeft}px`);
    };
    sync();
    window.addEventListener("resize", sync);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    observer?.observe(navInner);
    return () => {
      window.removeEventListener("resize", sync);
      observer?.disconnect();
    };
  }, []);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const res = await apiCall("/api/public/rooms/available", {
        method: "POST",
        body: { checkInDate, checkOutDate },
        silentError: true,
      });
      if (res && res.success && res.data) {
        setAvailableRooms(res.data);
        setSelectedRoomId((current) => {
          if (queryRoomId && res.data.some((room) => String(room.roomId) === String(queryRoomId))) return queryRoomId;
          return res.data.some((room) => String(room.roomId) === String(current)) ? current : "";
        });
      }
    } catch {
      // silent fallback
    } finally {
      setRoomsLoading(false);
    }
  }, [checkInDate, checkOutDate, queryRoomId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const nights = Math.max(1, Math.round((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)) || 1);
  const roomsForGuests = availableRooms.filter((room) => Number(room.roomType?.capacity || room.capacity || 10) >= Number(guestCount));
  const currentRoom = roomsForGuests.find((r) =>