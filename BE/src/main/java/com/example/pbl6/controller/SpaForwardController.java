package com.example.pbl6.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    @GetMapping(value = {
        "/login",
        "/register",
        "/booking",
        "/services",
        "/guest",
        "/guest/**",
        "/staff",
        "/staff/**",
        "/admin",
        "/admin/**"
    })
    public String forwardSpaRoutes() {
        return "forward:/index.html";
    }
}
