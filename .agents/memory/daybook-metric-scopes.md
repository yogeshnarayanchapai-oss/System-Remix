---
name: Daybook metric scopes
description: Scope distinction for Daybook report values
---

Daybook's Received, Payment, Transfers, and Net Balance are scoped to the selected date. NPR Exact R/P is the all-party outstanding balance across the full party ledger.

**Why:** A date's activity can differ from the current amount owed by parties; combining them produces misleading receivable/payable values.

**How to apply:** Keep date filters on activity queries and use the unfiltered party ledger for Exact R/P. Present the latter as a rounded whole-number NPR value.