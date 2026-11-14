export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
};

export const validatePhone = (phone: string): boolean => {
  // Chấp nhận mọi số điện thoại Việt Nam: 10 chữ số, bắt đầu bằng 0
  const re = /^0\d{9}$/;
  return re.test(phone.trim());
};

export const validateName = (name: string): boolean => {
  return name.trim().length >= 2;
};

export const validateRequired = (value: string): boolean => {
  return value.trim().length > 0;
};

export const validatePassword = (password: string): boolean => {
  return password.length >= 6;
};
