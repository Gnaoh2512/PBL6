package com.example.pbl6.service;

import com.example.pbl6.dto.auth.AccountResponse;
import com.example.pbl6.dto.auth.AuthResponse;
import com.example.pbl6.dto.auth.LoginRequest;
import com.example.pbl6.dto.auth.RegisterRequest;

public interface AuthService {

    AccountResponse register(RegisterRequest request);

    AuthResponse login(LoginRequest request);

    AccountResponse getCurrentUser(String username);
}
