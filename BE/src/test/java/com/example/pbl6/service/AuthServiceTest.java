package com.example.pbl6.service;

import com.example.pbl6.dto.auth.AccountResponse;
import com.example.pbl6.dto.auth.AuthResponse;
import com.example.pbl6.dto.auth.LoginRequest;
import com.example.pbl6.dto.auth.RegisterRequest;
import com.example.pbl6.entity.Account;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @InjectMocks
    private AuthServiceImpl authService;

    private Account mockAccount;

    @BeforeEach
    void setUp() {
        mockAccount = Account.builder()
                .accountId(1)
                .username("testuser")
                .passwordHash("encoded_secret_hash")
                .fullName("Test User")
                .email("test@example.com")
                .role("CUSTOMER")
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    void register_Success() {
        RegisterRequest request = RegisterRequest.builder()
                .username("newuser")
                .password("password123")
                .fullName("New User")
                .email("new@example.com")
                .build();

        when(accountRepository.existsByUsername("newuser")).thenReturn(false);
        when(accountRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encodedPassword");
        when(accountRepository.save(any(Account.class))).thenAnswer(invocation -> {
            Account acc = invocation.getArgument(0);
            acc.setAccountId(2);
            return acc;
        });

        AccountResponse response = authService.register(request);

        assertNotNull(response);
        assertEquals("newuser", response.getUsername());
        assertEquals("CUSTOMER", response.getRole());
        assertEquals("ACTIVE", response.getStatus());
        verify(accountRepository, times(1)).save(any(Account.class));
    }

    @Test
    void register_DuplicateUsername_ThrowsException() {
        RegisterRequest request = RegisterRequest.builder()
                .username("testuser")
                .password("password123")
                .fullName("Test")
                .build();

        when(accountRepository.existsByUsername("testuser")).thenReturn(true);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            authService.register(request);
        });

        assertTrue(exception.getMessage().contains("Tên đăng nhập 'testuser' đã được sử dụng"));
        verify(accountRepository, never()).save(any(Account.class));
    }

    @Test
    void login_Success() {
        LoginRequest request = LoginRequest.builder()
                .username("testuser")
                .password("password123")
                .build();

        when(accountRepository.findByUsername("testuser")).thenReturn(Optional.of(mockAccount));
        when(passwordEncoder.matches("password123", "encoded_secret_hash")).thenReturn(true);
        when(jwtTokenProvider.generateToken(anyString(), anyString(), any())).thenReturn("mocked.jwt.token");
        when(jwtTokenProvider.getExpirationMs()).thenReturn(86400000L);

        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("mocked.jwt.token", response.getAccessToken());
        assertEquals("Bearer", response.getTokenType());
        assertEquals("testuser", response.getUser().getUsername());
        verify(accountRepository, times(1)).save(mockAccount);
    }

    @Test
    void login_WrongPassword_ThrowsException() {
        LoginRequest request = LoginRequest.builder()
                .username("testuser")
                .password("wrongpassword")
                .build();

        when(accountRepository.findByUsername("testuser")).thenReturn(Optional.of(mockAccount));
        when(passwordEncoder.matches("wrongpassword", "encoded_secret_hash")).thenReturn(false);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            authService.login(request);
        });

        assertTrue(exception.getMessage().contains("Tên đăng nhập hoặc mật khẩu không chính xác"));
    }

    @Test
    void login_LockedAccount_ThrowsException() {
        mockAccount.setStatus("LOCKED");
        LoginRequest request = LoginRequest.builder()
                .username("testuser")
                .password("password123")
                .build();

        when(accountRepository.findByUsername("testuser")).thenReturn(Optional.of(mockAccount));
        when(passwordEncoder.matches("password123", "encoded_secret_hash")).thenReturn(true);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> {
            authService.login(request);
        });

        assertTrue(exception.getMessage().contains("Tài khoản của bạn đã bị khóa"));
    }
}
