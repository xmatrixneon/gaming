/**
 * Game API Type Definitions
 *
 * TypeScript interfaces for all Game API requests and responses.
 * Provides type safety and better developer experience.
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

/**
 * Game API response wrapper (outer envelope)
 */
export interface GameApiResponse<T = unknown> {
  code: number; // 0 = success, non-zero = error
  msg: string; // Error message or success message
  payload?: T; // Response data (for successful requests)
}

/**
 * Game API request wrapper (outer envelope)
 */
export interface GameApiRequest {
  agency_uid: string; // Agency identification code
  timestamp: string; // Current timestamp in milliseconds
  payload: string; // AES-256-encrypted inner JSON
}

/**
 * Error response from Game API
 */
export interface GameApiError {
  code: number;
  msg: string;
}

// ============================================================================
// GAME LAUNCH (SEAMLESS MODE - /game/v1)
// ============================================================================

/**
 * Request to launch game in seamless mode
 */
export interface LaunchGameRequest {
  timestamp: string; // Current timestamp in milliseconds
  agency_uid: string; // Game agency identification code
  member_account: string; // Player account (4-20 chars, a-z and 0-9)
  game_uid: string; // Game UID
  credit_amount: string; // Player credit amount in INR (as string to preserve precision)
  currency_code: string; // Currency code (INR for this implementation)
  language: string; // Language code (e.g., "en")
  home_url?: string; // Back URL - must not contain "?"
  platform?: 1 | 2; // 1 = web (default), 2 = H5
  callback_url?: string; // Game bet data callback URL (optional, uses configured default)
}

/**
 * Response for game launch request
 */
export interface LaunchGameResponse {
  game_launch_url: string; // URL to launch the game
}

// ============================================================================
// GAME LAUNCH (TRANSFER MODE - /game/v2)
// ============================================================================

/**
 * Request to launch game in transfer mode
 */
export interface LaunchGameTransferRequest {
  timestamp: string; // Current timestamp in milliseconds
  agency_uid: string; // Game agency identification code
  member_account: string; // Player account name
  game_uid?: string; // Game UID (optional for balance query)
  credit_amount: string; // Transfer amount: >0 = deposit, <0 = withdraw, =0 = query
  currency_code: string; // Currency code (INR)
  language?: string; // Language code (optional)
  home_url?: string; // Back URL
  platform?: 1 | 2; // 1 = web (default), 2 = H5
  transfer_id: string; // Unique identifier per transaction
}

/**
 * Response for transfer mode game launch
 */
export interface LaunchGameTransferResponse {
  game_launch_url: string; // Game launch URL
  player_name: string; // Player account name
  currency: string; // Currency
  transfer_amount: string; // Transfer amount in INR
  before_amount: string; // Balance before transfer in INR
  after_amount: string; // Balance after transfer in INR
  transfer_id: string; // Operator's transfer ID
  transaction_id: string; // Unique transaction code from Game API
  transfer_status: 1 | 2; // 1 = success, 2 = failed
  timestamp: string; // Transfer timestamp
}

// ============================================================================
// BET INFORMATION CALLBACK (SEAMLESS MODE)
// ============================================================================

/**
 * Callback request from Game API for bet settlement
 * This is sent from Game API → Your Server
 */
export interface GameCallbackRequest {
  agency_uid: string; // Agency identification code
  timestamp: string; // UTC+0 timestamp
  payload: string; // AES-256-encrypted callback data
}

/**
 * Decrypted callback payload from Game API
 */
export interface GameCallbackPayload {
  serial_number: string; // UUID - idempotency key
  currency_code: string; // Currency code (INR)
  game_uid: string; // Game UID
  member_account: string; // Player account name
  win_amount: string; // Win amount in INR (negative = refund)
  bet_amount: string; // Bet amount in INR (negative = refund)
  timestamp: string; // Current timestamp in milliseconds
  game_round: string; // Game round ID
  data: string; // Sports event detail data (JSON string)
}

/**
 * Response to Game API callback
 * This is sent from Your Server → Game API
 */
export interface GameCallbackResponse {
  code: number; // 0 = success, 1 = failure (triggers retry)
  msg: string; // Result message
  payload: string; // AES-256-encrypted response data
}

/**
 * Encrypted callback response payload
 */
export interface GameCallbackResponsePayload {
  credit_amount: string; // Player balance after settlement
  timestamp: string; // Current timestamp in milliseconds
}

// ============================================================================
// TRANSACTION RECORDS (/game/transaction/list)
// ============================================================================

/**
 * Request to get transaction records
 */
export interface GetTransactionsRequest {
  timestamp: string; // Current timestamp in milliseconds
  agency_uid: string; // Agency identification code
  from_date: string; // Start date - UTC+0 timestamp in milliseconds
  to_date: string; // End date - UTC+0 timestamp in milliseconds (must be same day as from_date)
  page_no: number; // Page number
  page_size: number; // Page size (min: 1, max: 5000)
}

/**
 * Response for transaction records request
 */
export interface GetTransactionsResponse {
  total_count: number; // Total number of records
  current_page: number; // Current page number
  page_size: number; // Page size
  records: TransactionRecord[]; // Transaction records
}

/**
 * Individual transaction record
 */
export interface TransactionRecord {
  agency_uid: string; // Agency identification code
  member_account: string; // Player account name
  bet_amount: string; // Bet amount in INR
  win_amount: string; // Win amount in INR
  currency_code: string; // Currency code
  serial_number: string; // Unique transaction ID
  game_round: string; // Game round ID
  game_uid: string; // Game UID
  timestamp: string; // Transaction time UTC+0 (format: "YYYY-MM-DD HH:mm:ss")
}

// ============================================================================
// SUPPLIER LIST (/game/providers)
// ============================================================================

/**
 * Game provider information
 */
export interface GameProvider {
  code: string; // Provider code (e.g., "pg", "evolution")
  name: string; // Provider name
  currency: string; // Supported currency (comma-separated)
  lang: string; // Supported language (comma-separated)
  status: 0 | 1; // 0 = disabled, 1 = enabled
}

/**
 * Response for provider list request
 */
export interface GetProvidersResponse {
  code: number;
  msg: string;
  data: GameProvider[];
}

// ============================================================================
// GAME LIST (/game/list)
// ============================================================================

/**
 * Game information
 */
export interface GameInfo {
  game_uid: string; // Game UID
  game_name: string; // Game name
  game_type: string; // Game type (e.g., "slot", "live_casino")
  lang: string; // Supported language (comma-separated)
  status: 0 | 1; // 0 = disabled, 1 = enabled
  currency: string; // Supported currency (comma-separated)
  provider_code?: string; // Provider code (from query parameter)
  image_url?: string; // Game image URL (if available)
  description?: string; // Game description (if available)
}

/**
 * Response for game list request
 */
export interface GetGameListResponse {
  code: number;
  msg: string;
  data: GameInfo[];
}

// ============================================================================
// INTERNAL TYPES (FOR YOUR APPLICATION)
// ============================================================================

/**
 * Game session data stored in database
 */
export interface GameSessionData {
  provider: string; // Provider code
  providerGameId: string; // Game ID from provider
  providerSessionId?: string; // Session ID from provider
  gameApiSerial?: string; // Game API serial number
  gameRound?: string; // Game round ID
  status: "active" | "completed" | "cancelled";
  totalBet: number; // Total bet amount in paisa
  totalWin: number; // Total win amount in paisa
  gameData?: Record<string, unknown>; // Additional game data
}

/**
 * Bet data stored in database
 */
export interface BetData {
  amount: number; // Bet amount in paisa
  winAmount: number; // Win amount in paisa
  result: "pending" | "won" | "lost" | "void" | "cancelled";
  gameApiSerial?: string; // Game API serial number
  gameRound?: string; // Game round ID
  gameData?: Record<string, unknown>; // Additional game data
}

/**
 * Transaction metadata for Game API transactions
 */
export interface GameApiTransactionMetadata {
  gameApiSerial: string; // Game API serial number
  gameUid: string; // Game UID
  gameRound: string; // Game round ID
  providerCode: string; // Provider code
  betAmount?: number; // Bet amount in paisa
  winAmount?: number; // Win amount in paisa
}

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Game API error codes
 */
export enum GameApiErrorCode {
  SUCCESS = 0,
  AGENCY_NOT_EXIST = 10002,
  PAYLOAD_ERROR = 10004,
  SYSTEM_ERROR = 10005,
  GAME_NOT_EXIST = 10008,
  PLAYER_CURRENCY_MISMATCH = 10011,
  PLAYER_NAME_EXISTS = 10012,
  CURRENCY_NOT_SUPPORTED = 10013,
  PLAYER_NAME_INCORRECT = 10014,
  ACCOUNT_FORMAT_ERROR = 10015,
  ACCOUNT_FROZEN = 10016,
  PROVIDER_NOT_EXIST = 10017,
  LINE_CURRENCY_NOT_SUPPORTED = 10018,
  PROVIDER_CURRENCY_NOT_CONFIGURED = 10020,
  INCORRECT_PARAMETERS = 10022,
  PLAYER_NAME_TOO_SHORT = 10023,
  WALLET_MODE_MISMATCH = 10024,
  INSUFFICIENT_BALANCE = 10025,
  TRANSFER_FAILED = 10026,
  TRANSFER_ORDER_EXISTS = 10027,
  DATES_EMPTY = 10028,
  DATES_NOT_SAME_DAY = 10029,
  TOO_MANY_REQUESTS = 10030,
  QUERY_BEYOND_60_DAYS = 10031,
  END_DATE_BEFORE_START = 10032,
  HOME_URL_HAS_QUERY = 10033,
  SYSTEM_MAINTENANCE = 10034,
}

/**
 * Game API error message mapping
 */
export const GameApiErrorMessages: Record<GameApiErrorCode, string> = {
  [GameApiErrorCode.SUCCESS]: "Success",
  [GameApiErrorCode.AGENCY_NOT_EXIST]: "Agency does not exist",
  [GameApiErrorCode.PAYLOAD_ERROR]: "Payload error",
  [GameApiErrorCode.SYSTEM_ERROR]: "System error",
  [GameApiErrorCode.GAME_NOT_EXIST]: "Game does not exist",
  [GameApiErrorCode.PLAYER_CURRENCY_MISMATCH]: "Player currencies do not match",
  [GameApiErrorCode.PLAYER_NAME_EXISTS]: "Player name already exists",
  [GameApiErrorCode.CURRENCY_NOT_SUPPORTED]: "Currency is not supported",
  [GameApiErrorCode.PLAYER_NAME_INCORRECT]: "Player name is incorrect",
  [GameApiErrorCode.ACCOUNT_FORMAT_ERROR]: "Account limited to a-z and 0-9",
  [GameApiErrorCode.ACCOUNT_FROZEN]: "Account frozen - contact administrator",
  [GameApiErrorCode.PROVIDER_NOT_EXIST]: "Provider does not exist",
  [GameApiErrorCode.LINE_CURRENCY_NOT_SUPPORTED]: "Line does not support current currency",
  [GameApiErrorCode.PROVIDER_CURRENCY_NOT_CONFIGURED]: "Provider does not configure a currency",
  [GameApiErrorCode.INCORRECT_PARAMETERS]: "Incorrect parameters",
  [GameApiErrorCode.PLAYER_NAME_TOO_SHORT]: "Player name must be at least 3 characters",
  [GameApiErrorCode.WALLET_MODE_MISMATCH]: "Wallet mode does not match",
  [GameApiErrorCode.INSUFFICIENT_BALANCE]: "Insufficient wallet balance",
  [GameApiErrorCode.TRANSFER_FAILED]: "Transfer failed",
  [GameApiErrorCode.TRANSFER_ORDER_EXISTS]: "Transfer order already exists",
  [GameApiErrorCode.DATES_EMPTY]: "Start and end date cannot be empty",
  [GameApiErrorCode.DATES_NOT_SAME_DAY]: "Start and end dates must be the same day",
  [GameApiErrorCode.TOO_MANY_REQUESTS]: "Too many requests - try again later",
  [GameApiErrorCode.QUERY_BEYOND_60_DAYS]: "Only data within the last 60 days can be queried",
  [GameApiErrorCode.END_DATE_BEFORE_START]: "End date must be greater than start date",
  [GameApiErrorCode.HOME_URL_HAS_QUERY]: "home_url cannot contain '?'",
  [GameApiErrorCode.SYSTEM_MAINTENANCE]: "System scheduled maintenance",
};

/**
 * Gets error message for error code
 */
export function getGameApiErrorMessage(code: number): string {
  return GameApiErrorMessages[code as GameApiErrorCode] || "Unknown error";
}
