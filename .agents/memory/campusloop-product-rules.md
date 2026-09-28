---
name: CampusLoop product rules
description: Durable behavior decisions for the CampusLoop exchange workflow.
---

CampusLoop treats an accepted request as a reserved unit of inventory, while the public impact page counts only completed reuse transactions and their recorded listing type.

**Why:** A request should not overbook a limited resource, and impact numbers must describe completed activity rather than interest or estimates.

**How to apply:** Preserve these semantics when changing request transitions, listing quantities, dashboards, or impact reporting.