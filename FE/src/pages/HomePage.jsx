import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import DatePicker from "../components/DatePicker";
import SelectMenu from "../components/SelectMenu";
import { addDaysISO } from "../components/dateUtils";
import { useToast } from "../contexts/ToastContext";
import "./HomePage.css";

const photos = {
  hero: "https://images.unsplash.com/photo-1735770517146-e95c872226fc?auto=format&fit=crop&w=2200&q=88",
  pool: "https://images.unsplash.com/photo-1713843841925-6af6ed0df472?auto=format&fit=crop&w=1200&q=85",
  room: "https://images.unsplash.com/photo-1718942899965-4fc10607d805?auto=format&fit=crop&w=1200&q=85",
  suite: "https://images.unsplash.com/photo-1646974400439-321c4a9240b9?auto=format&fit=crop&w=1200&q=85",
  retreat: "https://images.unsplash.com/photo-1588504633950-9dc518941e93?auto=format&fit=crop&w=1800&q=88",
  loyalty: "https://images.unsplash.com/photo-1679069389827-a633b8905d95?auto=format&fit=crop&w=1800&q=88",
};

const featuredRooms = [
  {
    name: "Suite Sân Hiên Biển",
    label: "SUITE ĐẶC TRƯNG",
    image: photos.room,
    alternate: "https://images.unsplash.com/photo-1597126729864-51740ac05236?auto=format&fit=crop&w=1200&q=85",
    price: "5.850.000 ₫",
    guests: "2 khách",
    size: "58 m²",
    copy: "Không gian nghỉ dưỡng thoáng đãng, nơi đường chân trời hòa vào căn phòng.",
  },
  {
    name: "Biệt Thự Hướng Vịnh",
    label: "DINH THỰ RIÊNG",
    image: photos.suite,
    alternate: "https://images.unsplash.com/photo-1666433638132-16f0185d2fdf?auto=format&fit=crop&w=1200&q=85",
    price: "7.600.000 ₫",
    guests: "4 khách",
    size: "86 m²",
    copy: "Không gian ngập nắng, sân hiên rộng rãi và tầm nhìn trọn vẹn ra vịnh.",
  },
  {
    name: "Biệt Thự Hồ Bơi Sân Vườn",
    label: "BIỆT THỰ BIỆT LẬP",
    image: photos.pool,
    alternate: "https://images.unsplash.com/photo-1739066500258-2c131cdf9852?auto=format&fit=crop&w=1200&q=85",
    price: "9.200.000 ₫",
    guests: "4 khách",
    size: "112 m²",
    copy: "Chốn nghỉ yên bình với hồ bơi riêng và khu vườn ven biển xanh mát.",
  },
];

const moments = [
  [
    "Phòng nghỉ",
    "Không gian tĩnh tại ôm trọn ánh sáng đổi thay trên mặt vịnh.",
    "https://images.unsplash.com/photo-1718942899965-4fc10607d805?auto=format&fit=crop&w=1200&q=86",
    "https://images.unsplash.com/photo-1597126729864-51740ac05236?auto=format&fit=crop&w=1200&q=86",
    "wide",
  ],
  [
    "Ẩm thực",
    "Nguyên liệu bản địa, bàn tiệc ngoài trời và những buổi tối thong thả.",
    "https://images.unsplash.com/photo-1748052132432-c9ed80205de6?auto=format&fit=crop&w=900&q=86",
    "https://images.unsplash.com/photo-1651697224183-1b25332e6967?auto=format&fit=crop&w=900&q=86",
    "tall",
  ],
  [
    "Chăm sóc sức khỏe",
    "Những liệu trình phục hồi giữa không gian tĩnh lặng bên bờ biển.",
    "https://images.unsplash.com/photo-1737352777897-e22953991a32?auto=format&fit=crop&w=900&q=86",
    "https://images.unsplash.com/photo-1488345979593-09db0f85545f?auto=format&fit=crop&w=900&q=86",
  ],
  [
    "Suite",
    "Không gian riêng tư rộng rãi với tầm nhìn biển không giới hạn.",
    "https://images.unsplash.com/photo-1666433638132-16f0185d2fdf?auto=format&fit=crop&w=900&q=86",
    "https://images.unsplash.com/photo-1611920629515-3f76f8c36b37?auto=format&fit=crop&w=900&q=86",
  ],
  [
    "Trải nghiệm ẩm thực",
    "Thực đơn tinh tế từ nông sản địa phương và hải sản đánh bắt trong ngày.",
    "https://images.unsplash.com/photo-1641924676093-42e61835bbe2?auto=format&fit=crop&w=1200&q=86",
    "https://images.unsplash.com/photo-1651697219057-7b44d777dc87?auto=format&fit=crop&w=1200&q=86",
    "wide",
  ],
  [
    "Hồ bơi",
    "Làn nước mát, nắng ấm và đường chân trời ngay trước mắt.",
    "https://images.unsplash.com/photo-1615722440048-da4ccf6de048?auto=format&fit=crop&w=900&q=86",
    "https://images.unsplash.com/photo-1739066500258-2c131cdf9852?auto=format&fit=crop&w=900&q=86",
    "wide",
  ],
];

const services = [
  [
    "Ẩm thực tại phòng",
    "Món ăn theo mùa và hương vị thân quen được phục vụ riêng tại phòng.",
    "Xem chi tiết ẩm thực",
    "https://images.unsplash.com/photo-1621873495868-6c5774cf6012?auto=format&fit=crop&w=900&q=84",
  ],
  [
    "Nhà hàng & lounge",
    "Thực đơn ven biển, cocktail tinh tuyển và bàn tiệc hướng ra đại dương.",
    "Khám phá ẩm thực",
    "https://images.unsplash.com/photo-1741852197045-cc35920a3aa0?auto=format&fit=crop&w=900&q=84",
  ],
  [
    "Spa",
    "Bộ sưu tập liệu trình phục hồi lấy cảm hứng từ thảo mộc trên đảo.",
    "Khám phá chăm sóc sức khỏe",
    "https://images.unsplash.com/photo-1737352777897-e22953991a32?auto=format&fit=crop&w=900&q=84",
  ],
  [
    "Hồ bơi & bãi biển",
    "Ngày thư thái bên hồ bơi vô cực và bờ biển riêng kín đáo.",
    "Khám phá bờ biển",
    "https://images.unsplash.com/photo-1669542755430-be091cefbef8?auto=format&fit=crop&w=900&q=84",
  ],
  [
    "Dịch vụ concierge",
    "Gợi ý am hiểu địa phương và hỗ trợ tận tâm để bạn khám phá hòn đảo theo cách riêng.",
    "Gặp đội ngũ concierge",
    "https://images.unsplash.com/photo-1631352564777-fe9802f4924c?auto=format&fit=crop&w=900&q=84",
  ],
  [
    "Dịp đặc biệt",
    "Không gian riêng tư và dấu ấn cá nhân cho những khoảnh khắc đáng nhớ.",
    "Lên kế hoạch sự kiện",
    "https://images.unsplash.com/photo-1576343547429-1a9ac89d7013?auto=format&fit=crop&w=900&q=84",
  ],
];

function Icon({ name, size = 18 }) {
  const icons = {
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    wifi: (
      <>
        <path d="M5 12.6a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
        <circle cx="12" cy="20" r=".5" fill="currentColor" />
      </>
    ),
    bed: (
      <>
        <path d="M3 7v14M21 21V11a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10M3 17h18" />
        <path d="M7 9V7a2 2 0 0 0-2-2H3v8" />
      </>
    ),
    waves: <path d="M2 8c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 14c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 20c3-3 5 3 8 0s5 3 8 0 4 0 4 0" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
}

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6].map((count) => ({ value: String(count), label: `${count} khách` }));

function getToday() {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// [selector, extra class, stagger children?]
const REVEAL_TARGETS = [
  [".resort-booking-form", "reveal-zoom"],
  [".resort-intro > div:first-child", "reveal-left"],
  [".resort-intro > div:last-child", "reveal-right"],
  [".resort-section-heading > div", "reveal-left"],
  [".resort-section-heading > p", "reveal-right"],
  [".resort-bento-card", "reveal-zoom"],
  [".resort-room-card", ""],
  [".all-rooms", ""],
  [".experience-photo", "reveal-left"],
  [".experience-copy > *", ""],
  [".resort-service-card", ""],
  [".loyalty-photo", "reveal-left"],
  [".loyalty-copy > *", ""],
  [".resort-offers > *", ""],
];

function useScrollReveal(rootRef) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const items = [];
    REVEAL_TARGETS.forEach(([selector, variant]) => {
      root.querySelectorAll(selector).forEach((el, i) => {
        if (el.classList.contains("reveal")) return;
        el.classList.add("reveal");
        if (variant) el.classList.add(variant);
        // stagger siblings that share a selector (cards, copy lines, ...)
        el.style.setProperty("--reveal-delay", `${(i % 6) * 0.1}s`);
        items.push(el);
      });
    });
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    items.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      items.forEach((el) => {
        el.classList.remove("reveal", "reveal-left", "reveal-right", "reveal-zoom", "is-visible");
        el.style.removeProperty("--reveal-delay");
      });
    };
  }, [rootRef]);
}

export default function HomePage() {
  const rootRef = useRef(null);
  const location = useLocation();
  useScrollReveal(rootRef);

  // Scroll to the section named in the URL hash (works from the navbar, from
  // other pages, and when the same link is clicked twice).
  useEffect(() => {
    const id = decodeURIComponent(location.hash.replace("#", ""));
    const timer = setTimeout(() => {
      if (!id) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      // The booking bar is centred on screen; every other section starts under the navbar.
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: id === "stay" ? "center" : "start" });
    }, 60);
    return () => clearTimeout(timer);
  }, [location.hash, location.key]);

  const navigate = useNavigate();
  const { addToast } = useToast();
  const [checkInDate, setCheckInDate] = useState(getToday);
  const [checkOutDate, setCheckOutDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  const [guestCount, setGuestCount] = useState(2);
  const searchRooms = useCallback(() => {
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      addToast("Ngày trả phòng phải sau ngày nhận phòng.", "error");
      return;
    }
    const filters = new URLSearchParams({ checkIn: checkInDate, checkOut: checkOutDate, guests: String(guestCount) });
    navigate(`/booking?${filters.toString()}`);
  }, [addToast, checkInDate, checkOutDate, guestCount, navigate]);

  const updateCheckIn = (date) => {
    setCheckInDate(date);
    if (new Date(checkOutDate) <= new Date(date)) {
      const nextDay = new Date(`${date}T00:00:00`);
      nextDay.setDate(nextDay.getDate() + 1);
      setCheckOutDate(new Date(nextDay.getTime() - nextDay.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
    }
  };

  const bookRoom = (roomId) => {
    const filters = { checkIn: checkInDate, checkOut: checkOutDate, guests: String(guestCount) };
    if (roomId) filters.roomId = String(roomId);
    navigate(`/booking?${new URLSearchParams(filters)}`);
  };
  const rooms = featuredRooms;

  return (
    <div className="resort-home" ref={rootRef}>
      <Navbar variant="resort" />
      <section className="resort-hero">
        <img src={photos.hero} alt="Hồ bơi vô cực tại khu nghỉ dưỡng Azure Bay hướng ra biển" />
        <div className="resort-hero-shade" />
        <div className="resort-hero-copy">
          <h1>
            <span>Nơi đường chân trời</span>
            <br />
            <em>khiến bạn sống chậm lại.</em>
          </h1>
        </div>
        <Link className="resort-scroll-cue" to={{ pathname: "/", hash: "#discover" }}>
          <span /> KHÁM PHÁ AZURE BAY
        </Link>
      </section>

      <section className="resort-booking" id="stay">
        <div className="resort-booking-form">
          <div className="resort-date-field" data-fp-anchor>
            <span>NHẬN PHÒNG</span>
            <div>
              <Icon name="calendar" />
              <DatePicker ariaLabel="Ngày nhận phòng" min={getToday()} value={checkInDate} onChange={updateCheckIn} />
            </div>
          </div>
          <div className="resort-date-field" data-fp-anchor>
            <span>TRẢ PHÒNG</span>
            <div>
              <Icon name="calendar" />
              <DatePicker ariaLabel="Ngày trả phòng" min={addDaysISO(checkInDate, 1)} value={checkOutDate} onChange={setCheckOutDate} />
            </div>
          </div>
          <div className="resort-date-field guests-field" data-fp-anchor>
            <span>KHÁCH</span>
            <div>
              <Icon name="users" />
              <SelectMenu ariaLabel="Số khách" icon="bi-people" value={String(guestCount)} onChange={(value) => setGuestCount(Number(value))} options={GUEST_OPTIONS} />
            </div>
          </div>
          <button className="resort-button primary search-rooms" onClick={searchRooms}>
            <span className="bi bi-search" /> Kiểm tra phòng trống
          </button>
        </div>
      </section>

      <main>
        <section className="resort-intro" id="about">
          <div>
            <span className="resort-eyebrow">NGHỆ THUẬT ĐÓN TIẾP</span>
            <h2>Một vẻ đẹp sang trọng tĩnh tại</h2>
          </div>
          <div>
            <p>Nằm nép mình bên đường cong kín gió của bờ tây Phú Quốc, Azure Bay là chốn nghỉ dưỡng boutique hòa mình vào cảnh sắc. Nơi đây, mỗi kỳ nghỉ đều chuyển động theo nhịp biển.</p>
            <Link to={{ pathname: "/", hash: "#experiences" }}>
              Câu chuyện của chúng tôi <Icon name="arrow" size={17} />
            </Link>
          </div>
        </section>

        <section className="resort-showcase resort-width" id="discover" aria-labelledby="showcase-title">
          <div className="resort-section-heading">
            <div>
              <span className="resort-eyebrow">TRẢI NGHIỆM AZURE BAY</span>
              <h2 id="showcase-title">Một kỳ nghỉ rộng mở để khám phá</h2>
            </div>
            <p>Từ buổi sáng thong thả bên làn nước đến đêm quây quần bên bàn tiệc, hãy cảm nhận nhiều nhịp sống tại Azure Bay.</p>
          </div>
          <div className="resort-bento">
            {moments.map(([title, copy, image, alternate, shape]) => (
              <article className={`resort-bento-card ${shape || ""}`} key={title} tabIndex="0">
                <img className="alternate" src={alternate} alt="" />
                <img className="primary-image" src={image} alt={`${title} tại Azure Bay`} />
                <div className="bento-shade" />
                <div className="bento-caption">
                  <span>KHÁM PHÁ</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="resort-rooms resort-width" id="rooms">
          <div className="resort-section-heading">
            <div>
              <span className="resort-eyebrow">NGHỈ DƯỠNG BÊN BIỂN</span>
              <h2>Phòng nghỉ & biệt thự</h2>
            </div>
            <p>Mỗi không gian được kiến tạo cho buổi sáng thong thả, chiều ngập hương biển và đêm đảo dịu êm.</p>
          </div>
          <div className="resort-room-grid">
            {rooms.map((room, index) => (
              <article className="resort-room-card" key={room.id || room.name}>
                <div className="resort-room-image">
                  <img className="alternate" src={room.alternate || featuredRooms[index % featuredRooms.length].alternate} alt="" />
                  <img className="primary-image" src={room.image} alt={room.name} />
                  <span>{room.label}</span>
                </div>
                <div className="resort-room-content">
                  <h3>{room.name}</h3>
                  <p>{room.copy}</p>
                  <div className="resort-room-meta">
                    <span>
                      <Icon name="users" size={16} />
                      {room.guests}
                    </span>
                    <span>
                      <Icon name="bed" size={16} />
                      {room.size}
                    </span>
                    <span>
                      <Icon name="wifi" size={16} />
                      Wi-Fi
                    </span>
                  </div>
                  <div className="resort-room-footer">
                    <div>
                      <small>GIÁ TỪ</small>
                      <b>{room.price}</b>
                      <span>/ đêm</span>
                    </div>
                    <button aria-label={`Đặt ${room.name}`} onClick={() => bookRoom(room.id)}>
                      <Icon name="arrow" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Link className="resort-button outline all-rooms" to="/booking">
            Khám phá tất cả phòng nghỉ <Icon name="arrow" size={18} />
          </Link>
        </section>

        <section className="resort-experience" id="experiences">
          <div className="experience-photo">
            <img src={photos.retreat} alt="Cầu tàu yên bình vươn ra biển" />
          </div>
          <div className="experience-copy">
            <span className="resort-eyebrow light">HÒN ĐẢO CỦA BẠN, NHỊP ĐIỆU CỦA BẠN</span>
            <h2>
              Những ngày
              <br />
              theo nhịp biển
            </h2>
            <p>Theo con nước bằng thuyền kayak, quây quần bên bàn tiệc của bếp trưởng, hay để một buổi chiều trôi êm tại spa. Mỗi trải nghiệm đều đậm bản sắc địa phương, tinh tế và thong thả.</p>
            <div className="experience-list">
              <Link to={{ pathname: "/", hash: "#services" }}>
                <i>01</i> Hành trình riêng khám phá đảo <Icon name="arrow" />
              </Link>
              <Link to={{ pathname: "/", hash: "#services" }}>
                <i>02</i> Bàn tiệc ven biển <Icon name="arrow" />
              </Link>
              <Link to={{ pathname: "/", hash: "#services" }}>
                <i>03</i> Spa Sóng & Tĩnh Lặng <Icon name="arrow" />
              </Link>
            </div>
          </div>
        </section>

        <section className="resort-services resort-width" id="services">
          <div className="resort-section-heading">
            <div>
              <span className="resort-eyebrow">TẬN TÂM PHỤC VỤ</span>
              <h2>Chăm chút trong từng chi tiết</h2>
            </div>
            <p>Tiện nghi tinh tế và trải nghiệm đảo được chăm chút theo phong cách riêng của bạn.</p>
          </div>
          <div className="resort-service-grid">
            {services.map(([title, copy, link, image]) => (
              <article className="resort-service-card" key={title}>
                <div className="resort-service-image">
                  <img src={image} alt={title} />
                </div>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  <Link to={{ pathname: "/", hash: "#experiences" }}>
                    {link} <Icon name="arrow" size={15} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="resort-loyalty resort-width" id="gallery">
          <div className="loyalty-photo">
            <img src={photos.loyalty} alt="Khoảnh khắc thư thái bên bờ biển tại Azure Bay" />
          </div>
          <div className="loyalty-copy">
            <span className="resort-eyebrow">AZURE BAY PRIVILEGE</span>
            <h2>Đặc quyền dành riêng cho bạn</h2>
            <p>Trở thành một phần của Azure Bay và tận hưởng những ưu đãi được tạo nên cho mỗi hành trình quay trở lại.</p>
            <div className="loyalty-benefits">
              <span>Ưu đãi riêng cho thành viên</span>
              <span>Ưu tiên nâng hạng phòng</span>
              <span>Trải nghiệm được cá nhân hóa</span>
            </div>
            <div className="loyalty-actions">
              <Link className="resort-button primary" to="/register">
                Khám phá đặc quyền <Icon name="arrow" size={16} />
              </Link>
              <Link className="resort-button outline" to="/login">
                Đăng nhập thành viên
              </Link>
            </div>
          </div>
        </section>

        <section className="resort-offers" id="offers">
          <span className="resort-eyebrow">KỲ NGHỈ TIẾP THEO ĐANG CHỜ BẠN</span>
          <h2>Một chốn riêng đang chờ bạn bên bờ biển.</h2>
          <p>Để Azure Bay chăm chút cho kỳ nghỉ tiếp theo với những trải nghiệm tinh tế và ưu đãi riêng từ khu nghỉ dưỡng.</p>
          <Link className="resort-button primary" to="/booking">
            Khám phá ưu đãi <Icon name="arrow" size={17} />
          </Link>
        </section>
      </main>
      <div id="contact">
        <Footer variant="resort" />
      </div>
    </div>
  );
}
