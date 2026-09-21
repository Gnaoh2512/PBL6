package com.example.pbl6.service;

import com.example.pbl6.dto.auth.AccountResponse;
import com.example.pbl6.dto.auth.AuthResponse;
import com.example.pbl6.dto.auth.LoginRequest;
import com.example.pbl6.dto.auth.RegisterRequest;
import com.example.pbl6.entity.Account;
import com.example.pbl6.exception.ResourceNotFoundException;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    @Transactional
    public AccountResponse register(RegisterRequest request) {
        String username = request.getUsername().trim();
        if (accountRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("Tên đăng nhập '" + username + "' đã được sử dụng");
        }

        if (StringUtils.hasText(request.getEmail())) {
            String email = request.getEmail().trim();
            if (accountRepository.existsByEmail(email)) {
                throw new IllegalArgumentException("Email '" + email + "' đã được đăng ký cho tài khoản khác");
            }
        }

        String role = StringUtils.hasText(request.getRole()) ? request.getRole().trim().toUpperCase() : "CUSTOMER";

        Account account = Account.builder()
                .username(username)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .email(StringUtils.hasText(request.getEmail()) ? request.getEmail().trim() : null)
                .phone(StringUtils.hasText(request.getPhone()) ? request.getPhone().trim() : null)
                .role(role)
                .status("ACTIVE")
                .build();

        Account saved = accountRepository.save(account);
        log.info("Registered new user with username: {}", saved.getUsername());
        return AccountResponse.fromEntity(saved);
    }

    @Override
    @Transactional
    public AuthResponse login(LoginRequest request) {
        String username = request.getUsername().trim();
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Tên đăng nhập hoặc mật khẩu không chính xác"));

        if (!passwordEncoder.matches(request.getPassword(), account.getPasswordHash())) {
            throw new IllegalArgumentException("Tên đăng nhập hoặc mật khẩu không chính xác");
        }

        if ("LOCKED".equalsIgnoreCase(account.getStatus())) {
            throw new IllegalArgumentException("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên");
        }

        if ("INACTIVE".equalsIgnoreCase(account.getStatus())) {
            throw new IllegalArgumentException("Tài khoản của bạn hiện đang ngưng hoạt động");
        }

        account.setLastLogin(LocalDateTime.now());
        accountRepository.save(account);

        String token = jwtTokenProvider.generateToken(account.getUsername(), account.getRole(), account.getAccountId());

        return AuthResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresInMs(jwtTokenProvider.getExpirationMs())
                .user(AccountResponse.fromEntity(account))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public AccountResponse getCurrentUser(String username) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông tin tài khoản: " + username));
        return AccountResponse.fromEntity(account);
    }
}
