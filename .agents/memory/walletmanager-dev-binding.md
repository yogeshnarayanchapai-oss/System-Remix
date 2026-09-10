---
name: Wallet Manager dev binding
description: Environment-specific startup constraint for the Wallet Manager preview server.
---

The Wallet Manager development server must bind its Node HTTP listener to an IPv4-compatible host (`0.0.0.0`) rather than IPv6 `::`.

**Why:** This environment can report `EAFNOSUPPORT` when the listener uses `::`, preventing the artifact workflow from opening its port even though the app code is otherwise healthy.

**How to apply:** If the Wallet Manager workflow fails at startup with `EAFNOSUPPORT` on `:::<port>`, check the host passed to `httpServer.listen` before changing application code or workflow configuration.