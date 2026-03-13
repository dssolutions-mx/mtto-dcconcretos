# Vercel Firewall Setup Guide

Configure Vercel Firewall rules to protect the maintenance-dashboard. Rules take effect immediately and do not require redeployment.

**Path:** Vercel Dashboard → Your Project → **Firewall** (sidebar) → **Configure**

---

## 1. Rate Limiting (API Routes)

Protect backend endpoints from abuse and DoS.


| Field             | Value                 |
| ----------------- | --------------------- |
| **Rule name**     | `API Rate Limit`      |
| **If**            | Path matches `/api/`* |
| **Then**          | Rate Limit            |
| **Key**           | IP                    |
| **Time window**   | 60 seconds            |
| **Request limit** | 60                    |
| **Action**        | Deny (returns 429)    |


**Optional:** Enable **persistent action** (e.g. block for 5 minutes) so repeat offenders are blocked longer.

---

## 2. Stricter Rate Limit for Auth Routes

Auth endpoints (login, register, password reset) are common attack targets.


| Field             | Value                                                |
| ----------------- | ---------------------------------------------------- |
| **Rule name**     | `Auth Rate Limit`                                    |
| **If**            | Path matches `/api/auth/`* OR Path matches `/auth/*` |
| **Then**          | Rate Limit                                           |
| **Key**           | IP                                                   |
| **Time window**   | 60 seconds                                           |
| **Request limit** | 10                                                   |
| **Action**        | Deny (returns 429)                                   |


---

## 3. Block Suspicious User Agents (Optional)

Block known malicious bots. **Use Log first** to avoid blocking legitimate traffic.


| Field         | Value                                                                   |
| ------------- | ----------------------------------------------------------------------- |
| **Rule name** | `Block Bad Bots`                                                        |
| **If**        | User Agent contains `sqlmap` OR `nikto` OR `nmap` (common attack tools) |
| **Then**      | Deny                                                                    |


**Note:** Do not block generic `bot` or `curl`—many legitimate clients use them. Start with **Log** to observe, then enable **Deny** only if you see abuse.

---

## 4. Block Path Traversal Attempts

Block requests that try to escape the web root.


| Field         | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| **Rule name** | `Block Path Traversal`                                                 |
| **If**        | Path contains `../` OR Path contains `..%2f` OR Path contains `%2e%2e` |
| **Then**      | Deny                                                                   |


---

## 5. Block Common Attack Patterns in Query Strings

Block SQL injection and XSS attempts in URLs.


| Field         | Value                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| **Rule name** | `Block Malicious Query`                                                                                  |
| **If**        | Query String contains `' OR '1'='1` OR Query String contains `; DROP` OR Query String contains `<script` |
| **Then**      | Deny                                                                                                     |


**Note:** This is a basic filter. Adjust patterns based on your app; avoid blocking legitimate query params.

---

## 6. Block Empty or Invalid Host Headers

Prevent host-header attacks.


| Field         | Value                                                             |
| ------------- | ----------------------------------------------------------------- |
| **Rule name** | `Block Invalid Host`                                              |
| **If**        | Host header is empty OR Host header does not match your domain(s) |
| **Then**      | Deny                                                              |


**Note:** Requires defining your allowed host(s). Use if you have `ALLOWED_HOSTS` in env.

---

## 7. Log-Only Rules (Testing)

Before enforcing, test with **Log** to avoid blocking legitimate traffic:

1. Create the rule with **Then** = **Log**
2. Watch Firewall overview for 10+ minutes
3. If behavior looks correct, change **Then** to **Deny** or **Challenge**

---

## Rule Order

Rules run in order. Put **Deny** rules before **Rate Limit** rules if you want to block bad traffic before counting it. Use **Configure** to reorder.

---

## Persistent Actions

For **Deny**, **Challenge**, or **Rate Limit** actions, you can add a **persistent block**:

- **For:** 5 minutes, 1 hour, 24 hours, etc.
- Any client that triggers the rule is blocked for that duration
- Blocked requests do not count toward CDN/traffic usage

---

## Plan Limits


| Plan       | Custom Rules | Rate Limit Rules |
| ---------- | ------------ | ---------------- |
| Hobby      | 3            | 1                |
| Pro        | 40           | 40               |
| Enterprise | 1,000        | 1,000            |


---

## Recommended Minimum (Pro Plan)

1. **API Rate Limit** — 60 req/min per IP for `/api/`*
2. **Auth Rate Limit** — 10 req/min per IP for `/api/auth/`* and `/auth/*`
3. **Block Path Traversal** — Deny paths with `../`

Start with these three, then add more based on observed traffic.