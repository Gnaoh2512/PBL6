package com.example.pbl6.service;

import com.example.pbl6.dto.adminaccount.AccountCreateRequest;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.AuditLog;
import com.example.pbl6.repository.AccountRepository;
import com.example.pbl6.repository.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountAdminServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AccountAdminServiceImpl accountAdminService;

    private Account mockAccount;

    @BeforeEach
    void setUp() {
        mockAccount = Account.builder()
                .accountId(1)
                .username("admin")
                .fullName("Admin User")
                .email("admin@hotel.com")
                .role("ADMIN")
                .status("ACTIVE")
                .build();
    }

    @Test
    void getAllAccounts_Success() {
        when(accountRepository.findAll()).thenReturn(List.of(mockAccount));

        List<Account> accounts = accountAdminService.getAllAccounts();

        assertNotNull(accounts);
        assertEquals(1, accounts.size());
        assertEquals("admin", accounts.get(0).getUsername());
    }

    @Test
    void createAccount_Success() {
        AccountCreateRequest request = new AccountCreateRequest();
        request.setUsername("receptionist1");
        request.setPassword("password123");
        request.setFullName("Receptionist One");
        request.setEmail("rec1@hotel.com");
        request.setRole("RECEPTIONIST");

        when(accountRepository.existsByUsername("receptionist1")).thenReturn(false);
        when(accountRepository.existsByEmail("rec1@hotel.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encodedPassword");
        when(accountRepository.save(any(Account.class))).thenAnswer(invocation -> {
            Account acc = invocation.getArgument(0);
            acc.setAccountId(2);
            return acc;
        });

        Account result = accountAdminService.createAccount(request);

        assertNotNull(result);
        assertEquals("receptionist1", result.getUsername());
        assertEquals("RECEPTIONIST", result.getRole());
        verify(accountRepository, times(1)).save(any(Account.class));
    }

    @Test
    void createAccount_DuplicateUsername_ThrowsException() {
        AccountCreateRequest request = new AccountCreateRequest();
        request.setUsername("admin");
        request.setPassword("password123");

        when(accountRepository.existsByUsername("admin")).thenReturn(true);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                accountAdminService.createAccount(request));

        assertTrue(exception.getMessage().contains("Username already exists"));
        verify(accountRepository, never()).save(any(Account.class));
    }

    @Test
    void getAuditLogs_Success() {
        AuditLog log = AuditLog.builder().logId(100L).moduleName("ACCOUNT").build();
        when(auditLogRepository.findAll()).thenReturn(List.of(log));

        List<AuditLog> logs = accountAdminService.getAuditLogs();

        assertNotNull(logs);
        assertEquals(1, logs.size());
        assertEquals("ACCOUNT", logs.get(0).getModuleName());
    }
}