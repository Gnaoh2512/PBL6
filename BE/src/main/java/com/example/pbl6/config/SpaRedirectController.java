// SPDX-License-Identifier: MIT
package com.example.pbl6.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Forward all non-API routes to the React app's index.html.
 * This enables client-side routing (React Router) for any path such as
 * "/services", "/rooms", "/admin/dashboard", etc.
 * The regex matches any path that does not contain a dot (.) which
 * typically indicates a static file extension, and also excludes the
 * "api" prefix used for backend endpoints.
 */
@Controller
public class SpaRedirectController {

    @RequestMapping(value = "/{path:^(?!api).*$}")
    public String redirect() {
        // Forward to the React entry point located in static resources
        return "forward:/index.html";
    }

    // Catch deeper nested paths (e.g., /admin/dashboard/settings)
    @RequestMapping(value = "/**/{path:^(?!api).*$}")
    public String redirectNested() {
        return "forward:/index.html";
    }
}
