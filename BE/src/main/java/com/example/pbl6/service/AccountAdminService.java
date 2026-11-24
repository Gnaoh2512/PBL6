package com.example.pbl6.service;

import com.example.pbl6.dto.adminaccount.AccountCreateRequest;
import com.example.pbl6.dto.adminaccount.AccountUpdateRequest;
import com.example.pbl6.dto.adminaccount.CustomerServiceHistoryItemResponse;
import com.example.pbl6.entity.Account;
import com.example.pbl6.entity.AuditLog;

import java.util.List;

public interface AccountAdminService {
    List<Account> getAllAccounts();
    Account createAccount(AccountCreateRequest request);
    Account updateAccount(Integer accountId, AccountUpdateRequest request, String currentUsername);
    Account deactivateAccount(Integer accountId, String currentUsername);
    List<AuditLog> getAuditLogs();
    List<CustomerServiceHistoryItemResponse> getCustomerServiceHistory(Integer accountId);
}