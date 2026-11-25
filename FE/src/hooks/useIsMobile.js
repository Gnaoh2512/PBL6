import { useEffect, useState } from "react";

const QUERY = "(max-width: 768px)"; // same breakpoint as styles/mobile.css

export default function useIsMobile() {
  const get = () => typeof window !== "undefined" && window.matchMedia(QUERY).matches;
  const [isMobile, setIsMobile] = useState(get);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
