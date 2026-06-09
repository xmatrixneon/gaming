/**
 * VeloPay Payment Gateway Service
 *
 * Indian UPI-focused payment gateway integration:
 * - Deposits (payin) via H5 payment link or UPI QR
 * - Withdrawals (payout) to bank accounts via UPI/IMPS
 * - MD5 signature verification for security
 *
 * Documentation: https://1k5lw3f9bz.apifox.cn/llms.txt
 */

import { createHash } from "crypto";

// ============================================================================
// CONFIGURATION
// ============================================================================

const VELOPAY_CONFIG = {
  gatewayUrl: process.env.VELOPAY_GATEWAY_URL || "https://velopay.ptasm.online",
  merchantNo: process.env.VELOPAY_MERCHANT_NO || "201",
  secretKey: process.env.VELOPAY_SECRET_KEY || "1f23c2295a08e214304bf09463d0fbcb",
  callbackUrl: process.env.VELOPAY_CALLBACK_URL || "https://clausbet.com/api/webhook/velopay",
  currency: "INR",
  // Callback IP for whitelisting
  callbackIp: "13.201.70.222",
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface VelopayDepositRequest {
  txn_id: string;
  amount: string; // Amount in paisa (100 INR = 10000)
  type: 1 | 2; // 1 = H5 payment link, 2 = UPI account
  callback?: string;
  currency?: string;
}

export interface VelopayDepositResponse {
  status: "SUCCESS" | "FAILED";
  message: string;
  merchant_no: string;
  txn_id: string;
  id: string;
  amount: string;
  pay_link?: string;
  upi_account?: string;
}

export interface VelopayWithdrawalRequest {
  txn_id: string;
  amount: string; // Amount in paisa
  type: string;
  ifsc: string; // 11-digit IFSC code
  card_num: string; // Account number or UPI ID
  name: string;
  email?: string;
  mobile?: string;
  callback?: string;
  currency?: string;
}

export interface VelopayWithdrawalResponse {
  status: "PENDING" | "FAILED";
  message: string;
  merchant_no: string;
  txn_id: string;
  id: string;
  amount: string;
}

export interface VelopayCallbackPayload {
  status: "SUCCESS" | "FAILED";
  txn_id: string;
  merchant_no: string;
  message: string;
  id: string;
  amount: string;
  utr?: string;
  sign: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class VelopayGateway {
  private readonly config = VELOPAY_CONFIG;

  /**
   * Generate MD5 signature for VeloPay API requests
   *
   * Process:
   * 1. Sort parameters alphabetically by key
   * 2. Join with & in format: key1=value1&key2=value2
   * 3. Append &key={secretKey}
   * 4. Generate MD5 hash (32 characters)
   *
   * @param params - Request parameters (without sign)
   * @returns MD5 signature string
   */
  generateSignature(params: Record<string, any>): string {
    // Remove sign from params if present
    const { sign, ...paramsToSign } = params;

    // Filter out null/undefined values
    const filteredParams = Object.entries(paramsToSign)
      .filter(([_, value]) => value !== null && value !== undefined && value !== "")
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    // Sort keys alphabetically (case-sensitive)
    const sortedKeys = Object.keys(filteredParams).sort();

    // Build signature string: key1=value1&key2=value2&key={secret}
    const signatureString = sortedKeys
      .map((key) => `${key}=${filteredParams[key]}`)
      .join("&") + `&key=${this.config.secretKey}`;

    // Generate MD5 hash
    return createHash("md5").update(signatureString).digest("hex");
  }

  /**
   * Verify callback signature
   *
   * @param payload - Callback payload with sign
   * @returns True if signature is valid
   */
  verifyCallbackSignature(payload: VelopayCallbackPayload): boolean {
    const { sign: receivedSign, ...paramsToVerify } = payload;
    const calculatedSign = this.generateSignature(paramsToVerify);
    return receivedSign === calculatedSign;
  }

  /**
   * Create deposit request (payin)
   *
   * @param depositRequest - Deposit parameters
   * @returns Deposit response with payment link or UPI account
   */
  async createDeposit(
    depositRequest: VelopayDepositRequest
  ): Promise<VelopayDepositResponse> {
    const params = {
      merchant_no: this.config.merchantNo,
      txn_id: depositRequest.txn_id,
      amount: depositRequest.amount,
      type: depositRequest.type,
      callback: depositRequest.callback || `${this.config.callbackUrl}/deposit`,
      currency: depositRequest.currency || this.config.currency,
    };

    const sign = this.generateSignature(params);

    try {
      const response = await fetch(
        `${this.config.gatewayUrl}/api/payin/request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...params, sign }),
        }
      );

      const data: VelopayDepositResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          `VeloPay deposit failed: ${data.message || response.statusText}`
        );
      }

      return data;
    } catch (error) {
      console.error("[VELOPAY] Deposit request failed:", error);
      throw error;
    }
  }

  /**
   * Create withdrawal request (payout)
   *
   * @param withdrawalRequest - Withdrawal parameters
   * @returns Withdrawal response
   */
  async createWithdrawal(
    withdrawalRequest: VelopayWithdrawalRequest
  ): Promise<VelopayWithdrawalResponse> {
    const params = {
      merchant_no: this.config.merchantNo,
      txn_id: withdrawalRequest.txn_id,
      amount: withdrawalRequest.amount,
      type: withdrawalRequest.type,
      ifsc: withdrawalRequest.ifsc,
      card_num: withdrawalRequest.card_num,
      name: withdrawalRequest.name,
      email: withdrawalRequest.email,
      mobile: withdrawalRequest.mobile,
      callback:
        withdrawalRequest.callback ||
        `${this.config.callbackUrl}/withdrawal`,
      currency: withdrawalRequest.currency || this.config.currency,
    };

    const sign = this.generateSignature(params);

    try {
      const response = await fetch(
        `${this.config.gatewayUrl}/api/payout/request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...params, sign }),
        }
      );

      const data: VelopayWithdrawalResponse = await response.json();

      if (!response.ok || data.status === "FAILED") {
        throw new Error(
          `VeloPay withdrawal failed: ${data.message || response.statusText}`
        );
      }

      return data;
    } catch (error) {
      console.error("[VELOPAY] Withdrawal request failed:", error);
      throw error;
    }
  }

  /**
   * Query transaction status
   *
   * @param txn_id - Merchant transaction ID
   * @returns Transaction status
   */
  async queryTransactionStatus(txn_id: string): Promise<any> {
    // VeloPay has separate query endpoints for deposits and withdrawals
    // This would be implemented based on the query API documentation
    const params = {
      merchant_no: this.config.merchantNo,
      txn_id,
    };

    const sign = this.generateSignature(params);

    try {
      const response = await fetch(
        `${this.config.gatewayUrl}/api/payin/query`, // or payout/query
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...params, sign }),
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("[VELOPAY] Query transaction failed:", error);
      throw error;
    }
  }

  /**
   * Convert amount from INR to paisa (VeloPay format)
   * @param amountInINR - Amount in INR (e.g., 100)
   * @returns Amount in paisa (e.g., 10000)
   */
  inrToPaisa(amountInINR: number | string): string {
    const amount = typeof amountInINR === "string"
      ? parseFloat(amountInINR)
      : amountInINR;
    return Math.round(amount * 100).toString();
  }

  /**
   * Convert amount from paisa to INR
   * @param amountInPaisa - Amount in paisa (e.g., 10000)
   * @returns Amount in INR (e.g., 100)
   */
  paisaToINR(amountInPaisa: number | string): number {
    const amount = typeof amountInPaisa === "string"
      ? parseInt(amountInPaisa, 10)
      : amountInPaisa;
    return amount / 100;
  }

  /**
   * Validate IFSC code format
   * IFSC codes are 11 characters: 4 letters (bank code) + 0 + 6 characters (branch code)
   */
  validateIFSC(ifsc: string): boolean {
    const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscPattern.test(ifsc);
  }

  /**
   * Validate UPI ID format
   * UPI IDs are in format: username@bank
   */
  validateUPIId(upiId: string): boolean {
    const upiPattern = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{3,64}$/;
    return upiPattern.test(upiId);
  }

  /**
   * Validate Indian phone number
   * Indian phone numbers: +91 followed by 10 digits
   */
  validatePhone(phone: string): boolean {
    const phonePattern = /^[+]?91?[6-9]\d{9}$/;
    return phonePattern.test(phone.replace(/\s/g, ""));
  }

  /**
   * Get gateway configuration (for debugging)
   */
  getConfig() {
    return {
      gatewayUrl: this.config.gatewayUrl,
      merchantNo: this.config.merchantNo,
      currency: this.config.currency,
      callbackIp: this.config.callbackIp,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const velopayGateway = new VelopayGateway();
