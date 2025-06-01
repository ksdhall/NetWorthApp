# Asset Tracking App – Requirements

> **Purpose**: Replace current Google Sheets + Apps Script system with a dedicated web application for tracking identities, addresses, accounts, assets, expenses, investments, taxes, and net-worth projections.  
> **Audience**: Internal developer/AI builder.

---

## 1. User & Authentication

- **User Registration & Login**  
  - Email + Passkey (WebAuthn) as primary authentication.  
  - Fallback: Email OTP if passkey not set up.  
  - Profile fields: Display Name, Email, Preferred Language (EN/JP), Preferred Currency (INR/JPY).  

- **Roles & Permissions**  
  - **Owner**: Full read/write access to all modules.  
  - **Shared User**: Assigned by Owner per module (“View-Only” or “View & Edit”).  
  - **Admin** (optional): Manages global settings, user roles, tax-slab updates.

- **Data Isolation & Sharing**  
  - Each user sees only their own data unless explicitly shared.  
  - Owner can invite another user by email, assign per-module permission.

---

## 2. Core Modules & Data Models

### 2.1 Identity & Address

- **IdentityDocument**  
  - Fields: Document Type (Aadhar, PAN, Passport, DL, Other), Number, Issue Date, Expiry Date, Issuing Authority, IsPrimary, Upload Scan (PDF/JPG).

- **AddressHistory**  
  - Fields: Address Type (Permanent, Rented, Office, Other), Line 1, Line 2, City, State, Postal Code, Country, From Date, To Date (NULL = Current), Geotag (optional).

- **Enhancements**  
  - File-upload for scanned IDs.  
  - Google-Maps address autocomplete.  

### 2.2 Accounts & Assets

- **Account**  
  - Fields: Nickname, Bank Name, Branch, Account Number (encrypted), Account Type (Savings, Checking, NRI, Demat, Other), Currency (INR, JPY, USD, etc.), IFSC/SWIFT, Linked Address (FK), Linked Phone, Online Login (Username/Password encrypted, 2FA method), Category (Asset vs Liability), Notes.  

- **CreditCard** (either subtype of Account or separate)  
  - Fields: Nickname, Card Type (Visa/Mastercard/JCB/Amex/Other), Last 4 Digits, Issuing Bank, Credit Limit, Expiry Date, Billing Address (FK), Notes.

- **MutualFund**  
  - Fields: Fund Name, Folio Number, Purchase Date, Units Held, Average Cost/Unit, Current NAV (manual or via API), Category, Currency, Linked Account (FK), Notes.

- **FixedDeposit**  
  - Fields: Bank, Branch, FD Account #, Principal Amount, Interest Rate (% p.a.), Start Date, Maturity Date, Payout Frequency (Monthly/Quarterly/Annual/On Maturity), Currency, Linked Account, Notes.

- **PensionProfile** (PF / Japan Pension)  
  - Fields: Country (Japan/India/Other), Employer, Account #, Contribution To Date, Employee Share %, Employer Share %, Projected Payout, Notes.

- **FamilyMember**  
  - Fields: Full Name, Relationship (Spouse/Child/Parent/Sibling/Other), DOB, Email, Phone, Linked Account(s) (many-to-many), Permission (View/Edit), Notes.

### 2.3 Balances & Snapshots

- **BalanceEntry**  
  - Fields: Account ID (FK), Entry Date (YYYY-MM-01), Balance (Original Currency), Currency, Exchange Rate to Base (e.g. JPY or INR), Balance (in Base Currency, computed), Locked (boolean), Notes.

- **AssetCategory**  
  - Defines categories/hierarchy (e.g. “Cash & Bank,” “Investments → Mutual Funds,” “Liabilities → Credit Cards”).  
  - Fields: Name, Type (Asset vs Liability), Parent Category ID (nullable).

- **Growth Calculations**  
  - Compute account-level and category-level growth on-the-fly (no separate tables).  
  - Charts: Value Over Time (line), Category Breakdown (stacked area).

### 2.4 Dashboard & Projections

- **Net Worth Summary**  
  - Total Assets (sum of all Asset balances, base currency).  
  - Total Liabilities (sum of all Liability balances).  
  - Net Worth = Assets − Liabilities.  
  - Last Updated Date.  

- **Trend Charts**  
  - Net Worth Over Time.  
  - Category Breakdown Over Time.

- **Currency Toggle**  
  - Show values in INR, JPY, USD based on daily FX rates.

- **Savings Depletion Projection**  
  - Input: Total Recurring Expenses (from Master), Annual Growth Rate (2%, 4%, 6%, customizable).  
  - Output: Number of Months until Capital Depletion at each growth rate, table comparing rates side by side.

### 2.5 Expenses & Budgeting

- **ExpenseCategory**  
  - Fields: Name (e.g., Rent, Groceries, Utilities, Insurance), Type (Recurring, Variable, Optional), Parent Category (nullable).

- **RecurringExpense**  
  - Fields: Category ID, Amount, Frequency (Monthly/Quarterly/Annual), Start Date, End Date (nullable), Notes.

- **Transaction**  
  - Fields: Date, Amount, Type (Expense/Income/Transfer), Category ID (FK), Payment Method (Cash, Bank, Card, Wallet, Other), Linked Account ID, Description, Linked FamilyMember ID (nullable), Notes.

- **Budget vs Actual**  
  - For each Year-Month & Category:  
    - Allocated Amount (sum of RecurringExpense for that month).  
    - Spent Amount (sum of Transactions tagged to that category).  
    - Remaining = Allocated − Spent (computed).  
    - Flag if Remaining < 0.  
  - Visual: Bar/Pie chart per month showing Allocated vs Spent.

### 2.6 Investment & Income Projections

- **InterestProjection**  
  - Fields: Instrument Type (Savings/FD/MF/Pension/Other), Instrument ID (FK), Principal Amount, Annual Interest Rate, Projected Annual Income (principal × rate/100, computed), Notes.

- **Coverage Calculation**  
  - Compare Projected Passive Income vs Total Recurring Expenses.  
  - Show % of expenses that can be covered by passive income.

### 2.7 Tax Estimation

- **TaxProfile**  
  - Fields: Country (Japan/India/Other), Tax Year (e.g. 2023), Monthly Salary, Annual Bonus, Total Deductions, Other Income (Interest/Dividends), Estimated Tax (computed via rules), Tax Paid to Date, Notes.

- **TaxRule Engine**  
  - Store slab rates and deduction logic in a separate table or JSON config.  
  - Compute Gross Taxable Income = (12 × Monthly Salary) + Annual Bonus + Other Income − Deductions.  
  - Apply slab logic to get Estimated Tax.  
  - Compute Net Salary After Tax = Gross Taxable Income − Estimated Tax.

---

## 3. Functional Requirements (Summary)

1. **User & Auth**  
   - FR-01: Email + Passkey registration & login (WebAuthn).  
   - FR-02: Role-based permissions (Owner vs Shared View/Edit).  
   - FR-03: Invite & share per-module access with another user.  
   - FR-04: Password reset via OTP.

2. **Identity & Addresses**  
   - FR-10: CRUD identity documents (type, number, dates, upload scan).  
   - FR-11: CRUD address history (typed, geotag optional, current/previous).

3. **Accounts & Assets**  
   - FR-20: CRUD bank accounts (encrypted account #, linked address/phone).  
   - FR-21: CRUD credit cards (last 4, limit, expiry, billing address).  
   - FR-22: CRUD investments: Mutual Funds, FDs, Pension/Provident.  
   - FR-23: CRUD Family Members & link to accounts (with permissions).

4. **Balances & Snapshots**  
   - FR-30: Enter monthly balance per account (original + exchange rate).  
   - FR-31: Compute converted balance in base currency.  
   - FR-32: Lock or override any historical entry.  
   - FR-33: On-the-fly growth calculation (account & category).

5. **Dashboard & Projections**  
   - FR-40: Display Net Worth (Assets, Liabilities, Net).  
   - FR-41: Trend charts (net worth, category breakdown).  
   - FR-42: Currency toggle (INR/JPY/USD).  
   - FR-43: “How long savings last” projection widget.

6. **Expenses & Budgeting**  
   - FR-50: CRUD Expense Categories (hierarchical).  
   - FR-51: CRUD Recurring Expenses (amount, frequency, dates).  
   - FR-52: CRUD Transactions (date, amount, category, account).  
   - FR-53: Budget vs Actual dashboard (allocated vs spent per month).

7. **Investment & Income Projections**  
   - FR-60: CRUD Interest Projection per instrument (compute projected income).  
   - FR-61: Compute % of recurring expenses covered by projected income.

8. **Tax Estimation**  
   - FR-70: CRUD Tax Profile per year (salary, bonus, deductions).  
   - FR-71: Tax engine to compute estimated tax based on stored slab rules.  
   - FR-72: Show net salary after tax, tax paid vs projected graph.

9. **Sharing & Permissions**  
   - FR-80: Owner can grant “View-Only” or “View & Edit” to another user for any module.

---

## 4. Non-Functional Requirements

1. **Security**  
   - NFR-01: All sensitive fields (account numbers, login credentials) encrypted at rest.  
   - NFR-02: TLS/HTTPS everywhere.  
   - NFR-03: WebAuthn (passkey) + OTP fallback.  
   - NFR-04: Role-based access control; Shared users restricted.  
   - NFR-05: Audit logging (who changed what, when).

2. **Performance**  
   - NFR-10: API latency < 300 ms for common operations (net worth query).  
   - NFR-11: Index DB on date and foreign keys for fast reads.  
   - NFR-12: Cache dashboard metrics (e.g. Redis).

3. **Scalability & Reliability**  
   - NFR-20: Containerized (Docker) deployment.  
   - NFR-21: Daily DB backups (encrypted).  
   - NFR-22: 99.9% uptime target.  
   - NFR-23: Graceful degradation if external API (FX rates) is down.

4. **Usability & UX**  
   - NFR-30: Responsive design (desktop + mobile).  
   - NFR-31: Semi-formal, clean UI (e.g. React + Tailwind).  
   - NFR-32: Drag & drop dashboard widgets.  
   - NFR-33: Multi-language support (English, Japanese).  
   - NFR-34: Address autocomplete, file-upload previews.

5. **Maintainability & Extensibility**  
   - NFR-40: Modular code (Auth, Data, Reporting services).  
   - NFR-41: API docs with OpenAPI/Swagger.  
   - NFR-42: Automated tests (unit & integration).  
   - NFR-43: Versioned DB migrations (e.g. Alembic).

---

## 5. Database Schema (Simplified)

1. **User** `(user_id, email, passkey_public_key, display_name, preferred_language, preferred_currency, is_admin, timestamps…)`

2. **AddressHistory** `(address_id, user_id → User, type, line1, line2, city, state, postal_code, country, from_date, to_date, is_current, lat, lon, timestamps…)`

3. **IdentityDocument** `(identity_id, user_id → User, doc_type, doc_number, issue_date, expiry_date, issuing_authority, is_primary, scan_path, timestamps…)`

4. **AssetCategory** `(category_id, name, type (Asset/Liability), parent_category_id, timestamps…)`

5. **Account** `(account_id, user_id → User, nickname, bank_name, branch, account_number_encrypted, account_type, currency, ifsc_swift, linked_address_id, linked_phone, login_username_encrypted, login_password_encrypted, two_factor_method, category_id → AssetCategory, notes, timestamps…)`

6. **CreditCard** `(card_id, account_id → Account, user_id → User, card_type, last_four, credit_limit, expiry_date, billing_address_id → AddressHistory, notes, timestamps…)`  
   *(Or merged into Account with category = “Credit Card.”)*

7. **MutualFund** `(mf_id, user_id → User, fund_name, folio_number, purchase_date, units_held, avg_cost_per_unit, current_nav, category_id → AssetCategory, linked_account_id → Account, currency, timestamps…)`

8. **FixedDeposit** `(fd_id, user_id → User, bank_name, branch, fd_account_number, principal_amount, interest_rate, start_date, maturity_date, payout_frequency, category_id → AssetCategory, linked_account_id → Account, currency, timestamps…)`

9. **PensionProfile** `(pension_id, user_id → User, country, employer_name, account_number, contribution_to_date, employee_share_pct, employer_share_pct, projected_payout, category_id → AssetCategory, notes, timestamps…)`

10. **FamilyMember** `(member_id, user_id → User, full_name, relationship, date_of_birth, email, phone, timestamps…)`

11. **FamilyAccountLink** `(link_id, member_id → FamilyMember, account_id → Account, permission (View/Edit), timestamps…)`

12. **BalanceEntry** `(entry_id, account_id → Account, entry_date, balance_original, currency, exchange_rate, balance_base (computed), locked, notes, timestamps…)`

13. **ExpenseCategory** `(expense_cat_id, name, parent_cat_id → ExpenseCategory, type (Recurring/Variable/Optional), timestamps…)`

14. **RecurringExpense** `(rec_exp_id, user_id → User, expense_cat_id → ExpenseCategory, amount, frequency, start_date, end_date, notes, timestamps…)`

15. **Transaction** `(txn_id, user_id → User, date, amount, txn_type (Expense/Income/Transfer), expense_cat_id → ExpenseCategory, payment_method, account_id → Account, description, linked_member_id → FamilyMember, timestamps…)`

16. **TaxProfile** `(tax_id, user_id → User, country, tax_year, monthly_salary, annual_bonus, total_deductions, other_income, tax_paid_to_date, notes, timestamps…)`

17. **InterestProjection** `(proj_id, user_id → User, instrument_type, instrument_id (FK to FD/MF/Pension/Account), principal_amount, annual_interest_rate, projected_annual_income (computed), notes, timestamps…)`

---

## 6. Tech Stack Suggestions

- **Backend**:  
  - Python 3.x + FastAPI (or Node.js + Express)  
  - ORM: SQLAlchemy (Python) or Prisma (Node.js)  
  - Database: PostgreSQL (production), SQLite (local dev)  
  - Authentication: WebAuthn for passkeys, OTP fallback via email  
  - Caching: Redis (dashboard metrics)

- **Frontend**:  
  - React (Next.js optional) + Tailwind CSS + shadcn/ui  
  - Charting: Recharts or Chart.js (no custom colors by default)

- **Deployment**:  
  - Docker Compose (App + Postgres + Redis)  
  - CI/CD: GitHub Actions (run tests, lint, build, deploy)  
  - Hosting: Fly.io / Heroku / DigitalOcean / Vercel (for frontend)

- **External APIs**:  
  - FX Rates: ExchangeRate-API or OpenExchangeRates (daily).  
  - MF NAV (India): AMFI RTA API or scraping.  
  - Pension Data (optional): Government portal API or manual.

---

## 7. Example Feature Flow (Simplified)

1. **User signs up** (email & passkey) → lands on Dashboard (empty initially).  
2. **Add Identity & Address** → store ID docs, upload scans, set primary address.  
3. **Add Accounts** (Bank/Credit Card/FD/MF/Pension) → link to addresses, categories.  
4. **Enter Balance** (monthly) for each Account → app stores original + computed base balance.  
5. **Dashboard** auto-calculates Net Worth, trend charts.  
6. **Set Recurring Expenses** → monthly total appears in Dashboard.  
7. **Log Transactions (Expenses/Income)** → updates “Accrued vs Actual” charts.  
8. **Tax Profile** → rough tax displayed for Japan/India.  
9. **Invite Spouse** → share “View & Edit” permission on selected modules.  

---

> **End of Requirements**  
> You can copy this markdown document into a GitHub repository as `README.md` or `SPEC.md` and hand it to any AI tool or developer for implementation.
