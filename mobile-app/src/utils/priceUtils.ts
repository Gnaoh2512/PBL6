export const formatPrice = (amount: number): string => {
  return amount.toLocaleString('vi-VN') + ' ₫';
};

export const formatPriceShort = (amount: number): string => {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}tr ₫`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1000).toFixed(0)}k ₫`;
  }
  return `${amount} ₫`;
};

export const calculateTotalPrice = (
  pricePerNight: number,
  nights: number,
): number => {
  return pricePerNight * nights;
};
