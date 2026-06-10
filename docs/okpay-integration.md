# OKPay Integration Guide

## Overview

OKPay provides UPI payment processing for Indian users. This integration supports:
- **UPI (Web)**: Redirect-based checkout
- **UPI_INTENT (Native)**: Deep link to UPI apps
- **Bank Transfer**: Withdrawals to Indian bank accounts

## Configuration

### Environment Variables

```bash
OKPAY_MODE=sandbox              # sandbox | production
OKPAY_HOST=https://okpay.com    # Production host
OKPAY_MCH_ID=your_merchant_id   # From OKPay dashboard
OKPAY_KEY=your_secret_key       # From OKPay dashboard
OKPAY_CALLBACK_URL=https://yourdomain.com/api/webhook/okpay
```

### Sandbox Testing

Use sandbox credentials from OKPay documentation:
- **mchId**: 1000
- **key**: eb6080dbc8dc429ab86a1cd1c337975d
- **host**: sandbox.wpay.one

**Behavior**:
- Deposits auto-success in ~10 seconds
- Withdrawals succeed if order ID ends with even digit

## API Usage

### Deposit Example

```typescript
import { okpayGateway } from '@/lib/okpay-gateway';

const response = await okpayGateway.createDeposit({
  out_trade_no: 'unique_order_id',
  pay_type: 'UPI',           // or 'UPI_INTENT' for native
  money: '100',              // Amount in rupees
  returnUrl: 'https://example.com/success',
  phone: '9876543210',       // Required for UPI_INTENT
});

// Returns payment URL for user to complete payment
console.log(response.data.url);
```

### Withdrawal Example

```typescript
const response = await okpayGateway.createWithdrawal({
  out_trade_no: 'unique_order_id',
  pay_type: 'BANK',
  account: '1234567890',      // Bank account number
  userName: 'John Doe',       // Account holder name
  money: '100',              // Amount in rupees
  reserve1: 'IFSC0000000',  // IFSC code
});

// Returns transaction ID for tracking
console.log(response.data.transaction_Id);
```

## Webhooks

### Deposit Webhook

**Endpoint**: `/api/webhook/okpay/deposit`
**Method**: POST
**Format**: application/x-www-form-urlencoded

**Callback Parameters**:
- `mchId`: Merchant ID
- `out_trade_no`: Your order number
- `transaction_Id`: OKPay transaction ID
- `status`: Payment status (0=pending, 1=success, 2=failed)
- `money`: Amount in rupees
- `sign`: MD5 signature

**Response**: Must return plain text `success` (not JSON!)

### Withdrawal Webhook

**Endpoint**: `/api/webhook/okpay/withdrawal`
**Method**: POST
**Format**: application/x-www-form-urlencoded

Same parameters as deposit webhook.

## Error Codes

| Code | Description | Action |
|------|-------------|--------|
| 0 | Success | Proceed |
| 5 | Invalid signature | Check signing logic |
| 9 | Insufficient balance | Add OKPay funds |
| 16 | IP not whitelisted | Contact OKPay support |
| 17 | Bank doesn't exist | Check IFSC code |

See full error code reference in [design documentation](../superpowers/specs/2025-06-18-okpay-india-integration-design.md).

## Troubleshooting

### Common Issues

**Problem**: Webhook returns FAILED
- Check signature verification
- Verify callback URL is accessible
- Check OKPay dashboard for IP whitelist status

**Problem**: Deposit not credited
- Verify status in callback (should be "1" for success)
- Check wallet service logs
- Verify deposit record status

**Problem**: Amount mismatch
- Remember: OKPay uses rupees, system uses paisa
- Gateway handles conversion automatically
- Check database stores paisa (₹100 = 10000)

**Problem**: Invalid signature errors
- Ensure parameters are sorted alphabetically
- Verify URL encoding is applied before signing
- Check that sign parameter is excluded from signature calculation
- Confirm signature is converted to lowercase

## Amount Conversion

The OKPay gateway handles conversion between OKPay format (rupees) and system format (paisa):

```typescript
// OKPay format: rupees
okpayGateway.inrToPaisa(100);  // Returns "10000" (paisa)

// System format: paisa
okpayGateway.paisaToINR("10000");  // Returns 100 (rupees)
```

**Examples**:
- User deposits ₹100 → OKPay receives `money=100` → Gateway stores as `10000` paisa → Balance: +10000 paisa
- User withdraws ₹100 → System debits `10000` paisa → OKPay receives `money=100` → Bank transfer: ₹100

## Production Checklist

Before deploying to production:

- [ ] Update `OKPAY_MODE=production` in environment variables
- [ ] Add production merchant credentials
- [ ] Whitelist production server IP with OKPay support
- [ ] Test production deposit flow
- [ ] Test production withdrawal flow
- [ ] Monitor transaction success rates
- [ ] Set up alerting for webhook failures
- [ ] Verify callback URL is publicly accessible via HTTPS

## Testing

### Unit Tests

```bash
# Run OKPay gateway tests
npx vitest lib/__tests__/okpay-gateway.test.ts

# Run webhook tests
npx vitest app/api/webhook/okpay/__tests__/
```

### Manual Testing

1. Start development server: `npm run dev`
2. Login to the application
3. Navigate to deposit page
4. Select "OKPay UPI" or "OKPay UPI Intent" as payment method
5. Enter amount and submit
6. Wait ~10 seconds for sandbox auto-success
7. Verify balance is credited
8. Test withdrawal flow similarly

## Security Considerations

### Signature Verification

All callbacks must verify OKPay signatures. The gateway handles this automatically:

```typescript
if (!okpayGateway.verifyCallbackSignature(payload)) {
  return new NextResponse('FAILED', { status: 400 });
}
```

### IP Whitelisting

Production environments require IP whitelisting. Contact OKPay support with your server IP addresses.

### Data Protection

- Never log full OKPay secret key
- Mask sensitive data in logs (account numbers, IFSC)
- Store only transaction reference in database
- Use HTTPS for all production endpoints

## Architecture

The OKPay integration follows the same pattern as VeloPay:

```
Transaction Router
    ↓
OKPay Gateway (lib/okpay-gateway.ts)
    ↓
OKPay API (sandbox.wpay.one | okpay.com)
    ↓
Webhook Handlers (/api/webhook/okpay/*)
    ↓
Wallet Service (balance updates)
```

## Support

For issues or questions:
- OKPay Documentation: [Postman Documenter](https://documenter.getpostman.com/view/38952432/2sAXxS8BN2)
- Design Document: [OKPay Integration Design](../superpowers/specs/2025-06-18-okpay-india-integration-design.md)
- Implementation Plan: [OKPay Implementation Plan](../superpowers/plans/2025-06-18-okpay-india-integration.md)
