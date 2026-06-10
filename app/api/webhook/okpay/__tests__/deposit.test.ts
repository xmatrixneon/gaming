import { POST } from '../deposit/route';
import { okpayGateway } from '@/lib/okpay-gateway';
import { db } from '@/drizzle';
import { walletService } from '@/lib/wallet-service';

// Mock dependencies
vi.mock('@/lib/okpay-gateway');
vi.mock('@/drizzle');
vi.mock('@/lib/wallet-service');

describe('OKPay Deposit Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject request with invalid signature', async () => {
    (okpayGateway.verifyCallbackSignature as any).mockReturnValue(false);

    const request = new Request('https://example.com/api/webhook/okpay/deposit', {
      method: 'POST',
      body: new URLSearchParams({
        mchId: '1000',
        out_trade_no: '12345',
        transaction_Id: 'abc',
        status: '1',
        money: '100',
        sign: 'invalid',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('FAILED');
  });

  it('should process successful deposit', async () => {
    (okpayGateway.verifyCallbackSignature as any).mockReturnValue(true);
    (okpayGateway.inrToPaisa as any).mockReturnValue('10000');
    (walletService.updateBalanceAtomic as any).mockResolvedValue({
      success: true,
      transactionId: 'txn_123',
    });

    // Mock the Drizzle ORM chain properly
    const mockFrom = vi.fn();
    const mockWhere = vi.fn();
    const mockLimit = vi.fn();

    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([
      {
        id: '12345',
        status: 'pending',
        userId: 'user_123',
        amount: '10000',
        transactionId: 'txn_456',
      },
    ]);

    (db.select as any).mockReturnValue({ from: mockFrom });
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    });

    const request = new Request('https://example.com/api/webhook/okpay/deposit', {
      method: 'POST',
      body: new URLSearchParams({
        mchId: '1000',
        out_trade_no: '12345',
        transaction_Id: 'abc',
        status: '1',
        money: '100',
        sign: 'valid',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('success');
    expect(walletService.updateBalanceAtomic).toHaveBeenCalled();
  });

  it('should return plain text success (not JSON)', async () => {
    (okpayGateway.verifyCallbackSignature as any).mockReturnValue(true);
    (okpayGateway.inrToPaisa as any).mockReturnValue('10000');
    (walletService.updateBalanceAtomic as any).mockResolvedValue({
      success: true,
      transactionId: 'txn_123',
    });

    // Mock the Drizzle ORM chain properly
    const mockFrom = vi.fn();
    const mockWhere = vi.fn();
    const mockLimit = vi.fn();

    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([{ id: '12345', status: 'pending' }]);

    (db.select as any).mockReturnValue({ from: mockFrom });
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    });

    const request = new Request('https://example.com/api/webhook/okpay/deposit', {
      method: 'POST',
      body: new URLSearchParams({
        mchId: '1000',
        out_trade_no: '12345',
        transaction_Id: 'abc',
        status: '1',
        money: '100',
        sign: 'valid',
      }),
    });

    const response = await POST(request);
    const text = await response.text();

    expect(text).toBe('success');
    expect(text).not.toBe('{"status":"success"}');
    expect(response.headers.get('content-type')).not.toContain('application/json');
  });
});
