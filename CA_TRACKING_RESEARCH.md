# Current Account (CA) Tracking System - Research & Design

## Current State Analysis

### Existing Financial Tracking
Your system already tracks:
- **Daily Sales**: Cash/UPI inflows (dailySummaries table)
- **Debt Movements**: CC drawdowns/repayments (debtAccountMovements table)
- **Expenses**: Shop expenses (expenses table)
- **Supplier Payments**: Vendor transactions (supplier_transactions table)

### What's Missing
**No unified Current Account ledger** that shows:
- Consolidated CA balance over time
- All inflows in one place (sales + loan drawdowns + deposits)
- All outflows in one place (supplier payments + debt repayments + expenses)
- CC→CA and CA→CC transfer linking for reconciliation

---

## CA Transaction Types (Complete Flow)

### INFLOWS (Cash In)
1. **From Sales** (dailySummaries.totalSalesCash + totalSalesUpi)
2. **From CC Drawdown** (CC_TO_CA_TRANSFER)
3. **From External Deposits** (direct deposits/loans into CA)
4. **From Loan Repayment Reversals** (partial refunds)

### OUTFLOWS (Cash Out)
1. **To Suppliers** (supplier_transactions type=PAYMENT)
2. **To CC Repayment** (CA_TO_CC_TRANSFER)
3. **For Expenses** (expenses table)
4. **For Bank Fees/Interest** (direct costs)
5. **For Loan/CC Payments** (debt_payments when source != direct CASH)

### TRANSFERS (Internal Movement)
1. **CC → CA**: When you drawdown CC and transfer to current account
2. **CA → CC**: When you put extra CA cash back to CC

---

## Proposed Solution: CA Account Ledger

### 1. New Table: `current_account_movements`
Track every transaction that flows through the CA:

```sql
CREATE TABLE IF NOT EXISTS current_account_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  movement_date date NOT NULL,
  
  -- Movement categorization
  movement_type VARCHAR NOT NULL,
  -- Enum: 'SALES_INFLOW', 'CC_DRAWDOWN_INFLOW', 'SUPPLIER_PAYMENT_OUTFLOW', 
  --       'CC_REPAYMENT_OUTFLOW', 'EXPENSE_OUTFLOW', 'TRANSFER_TO_CC', 'TRANSFER_FROM_CC'
  
  amount numeric(18, 2) NOT NULL,
  
  -- Direction: +1 for inflow, -1 for outflow
  direction integer NOT NULL,
  
  -- Reference linking to source transactions
  source_type VARCHAR,  -- 'SALES', 'DEBT_DRAWDOWN', 'SUPPLIER_PAYMENT', 'EXPENSE', 'DEBT_REPAYMENT'
  source_id uuid,       -- References debtAccountMovements, supplier_transactions, expenses, etc.
  
  -- For transfers specifically
  linked_debt_account_id uuid REFERENCES debt_accounts(id),
  linked_debt_movement_id uuid REFERENCES debt_account_movements(id),
  
  description text,
  notes text,
  
  -- Running balance snapshot (for easy querying)
  balance_after numeric(18, 2),
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX current_account_movements_shop_date_idx 
  ON current_account_movements(shop_id, movement_date);
CREATE INDEX current_account_movements_shop_type_idx 
  ON current_account_movements(shop_id, movement_type);
```

### 2. New Table: `current_account_accounts`
Store CA bank account details and metadata:

```sql
CREATE TABLE IF NOT EXISTS current_account_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  
  account_name VARCHAR(160) NOT NULL,           -- e.g., "SBI Current 2098"
  account_number VARCHAR(50),
  bank_name VARCHAR(160),
  ifsc_code VARCHAR(20),
  
  opening_balance numeric(18, 2) DEFAULT 0,    -- Balance on start date
  start_date date,
  
  current_balance numeric(18, 2) DEFAULT 0,    -- Auto-calculated from movements
  last_reconciled_date date,
  last_reconciled_balance numeric(18, 2),
  
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 3. Modify: `debtAccountMovements`
We already have transfer sources, but we need to track the CA side:

**Already done:**
- `source` field supports CC_TO_CA_TRANSFER and CA_TO_CC_TRANSFER

**Action:**
- When recording debt movement with transfer source, auto-create inverse CA_movement
- Add `linked_ca_movement_id` field for reconciliation

---

## Implementation Flow

### When CC Drawdown with CC_TO_CA_TRANSFER:
```
1. User records in Debt Engine: 50,000 CC drawdown (source: CC_TO_CA_TRANSFER)
2. System creates:
   - debtAccountMovement (50,000 DRAWDOWN to CC)
   - currentAccountMovement (50,000 inflow, type: CC_DRAWDOWN_INFLOW)
   - Link both via IDs
3. CA balance increases by 50,000
```

### When CA_TO_CC_TRANSFER (putting cash back):
```
1. User records in Debt Engine: 30,000 CC repayment (source: CA_TO_CC_TRANSFER)
2. System creates:
   - debtAccountMovement (30,000 REPAYMENT to CC)
   - currentAccountMovement (30,000 outflow, type: CC_REPAYMENT_OUTFLOW)
   - Link both via IDs
3. CA balance decreases by 30,000
```

### When Supplier Payment from CA:
```
1. User records supplier payment: 20,000
2. System creates:
   - supplierTransaction (payment)
   - currentAccountMovement (20,000 outflow, type: SUPPLIER_PAYMENT_OUTFLOW)
3. CA balance decreases by 20,000
```

### When Daily Sales (automatic daily):
```
1. dailySummaries created with sales: 100,000 CASH + 50,000 UPI = 150,000
2. System creates:
   - currentAccountMovement (150,000 inflow, type: SALES_INFLOW)
3. CA balance increases by 150,000
```

---

## CA Dashboard/Report Query

### Running Balance at Any Date
```sql
SELECT 
  movement_date,
  movement_type,
  amount,
  balance_after,
  description
FROM current_account_movements
WHERE shop_id = ? AND movement_date BETWEEN ? AND ?
ORDER BY movement_date, created_at;
```

### CA Summary
```sql
SELECT 
  DATE_TRUNC('month', movement_date) as month,
  SUM(CASE WHEN direction = 1 THEN amount ELSE 0 END) as total_inflow,
  SUM(CASE WHEN direction = -1 THEN amount ELSE 0 END) as total_outflow,
  SUM(amount * direction) as net_change
FROM current_account_movements
WHERE shop_id = ?
GROUP BY DATE_TRUNC('month', movement_date);
```

### Transfer Reconciliation
```sql
-- Find all movements linked to debt transfers
SELECT 
  cam.movement_date,
  dam.movement_type as debt_type,
  dam.amount,
  cam.movement_type as ca_type,
  CASE WHEN cam.direction = 1 THEN 'Inflow' ELSE 'Outflow' END as ca_direction
FROM current_account_movements cam
JOIN debt_account_movements dam ON cam.linked_debt_movement_id = dam.id
WHERE cam.shop_id = ? AND cam.source_type IN ('CC_DRAWDOWN_INFLOW', 'CC_REPAYMENT_OUTFLOW');
```

---

## Benefits of This Approach

✅ **Complete visibility** of where cash comes from and goes to
✅ **Reconciliation ready** - link every CA entry to its source
✅ **Running balance** - track CA health over time
✅ **Audit trail** - every transaction is logged
✅ **Transfer matching** - CC transfers are visibly linked
✅ **Integrates with existing debt system** - uses linkedCurrentAccountName and transfer sources
✅ **Easy monthly/daily reports** - group transactions by type or date

---

## Integration with Your Existing System

| Component | Current | Proposed Change |
|-----------|---------|-----------------|
| Debt Engine | ✅ Has CC_TO_CA_TRANSFER, CA_TO_CC_TRANSFER sources | Add auto CA movement recording |
| Supplier Wall | ✅ Tracks supplier payments | Add CA outflow recording on payment |
| Daily Parta | ✅ Tracks sales | Add CA inflow recording daily |
| Expenses | ✅ Tracks shop expenses | Add CA outflow recording |
| **NEW** | ❌ No CA tracking | Create current_account_movements table |

---

## Recommended First Step

1. **Create migration** for `current_account_movements` and `current_account_accounts` tables
2. **Add UI** in Debt Engine to show CA balance and recent movements
3. **Auto-create CA entries** when debt transfers use CC_TO_CA_TRANSFER or CA_TO_CC_TRANSFER
4. **Create CA dashboard** showing balance, inflows, outflows, and reconciliation status

