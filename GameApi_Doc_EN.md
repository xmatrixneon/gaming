# GameAPI Documentation

## Credentials

```
agency_uid : 8dee1e401b87408cca3ca813c2250cb4
aes_key    : 68b074393ec7c5a975856a90bd6fdf47
server_url : https://jsgame.live
```

---

## Quick Start

### 1. Get Game URL (Seamless)

**Request**
```
POST https://{SERVER-URL}/game/v1
Content-Type: application/json
```
```json
{
  "agency_uid": "8dee1e401b87408cca3ca813c2250cb4",
  "timestamp": "1631459081871",
  "payload": "(AES256EncryptionResult)"
}
```

**Response**
```json
{
  "code": 0,
  "msg": "",
  "payload": { "game_launch_url": "https://game_url" }
}
```

---

### 2. Retrieve Bet Information (Seamless Callback)

Your platform implements this endpoint to receive bet data.

**Request** (from game server → your server)
```
POST https://{callback_url}
Content-Type: application/json
```
```json
{
  "agency_uid": "8dee1e401b87408cca3ca813c2250cb4",
  "payload": "/aIRsjJmK5CYVZLuFS4l5C27vm8Br8...",
  "timestamp": "1705474368229"
}
```

**Response** (your server → game server)
```json
{
  "code": 0,
  "msg": "",
  "payload": "m8Br86TSic3fFelsNLxL8eRGXmeuQML..."
}
```

---

### 3. Get Game URL (Transfer)

**Request**
```
POST https://{SERVER-URL}/game/v2
Content-Type: application/json
```
```json
{
  "agency_uid": "8dee1e401b87408cca3ca813c2250cb4",
  "timestamp": "1631459081871",
  "payload": "(AES256EncryptionResult)"
}
```

**Response**
```json
{
  "code": 0,
  "msg": "",
  "payload": { "game_launch_url": "https://game_url" }
}
```

---

### 4. Get Transaction Records

**Request**
```
POST https://{SERVER-URL}/game/transaction/list
Content-Type: application/json
```
```json
{
  "agency_uid": "8dee1e401b87408cca3ca813c2250cb4",
  "timestamp": "1631459081871",
  "payload": "(AES256EncryptionResult)"
}
```

**Response**
```json
{
  "code": 0,
  "msg": "",
  "payload": { "records": [], "total_page": 100 }
}
```

---

## API Reference

### 1. Get Game URL (Seamless) — `/game/v1`

**Method:** `POST`

#### Outer Envelope Parameters

| Parameter  | Type   | Required | Description                        |
|------------|--------|----------|------------------------------------|
| agency_uid | String | Yes      | Agent identification code          |
| timestamp  | String | Yes      | Current timestamp (milliseconds)   |
| payload    | String | Yes      | AES-256-encrypted inner JSON       |

#### Payload (inner, encrypted) Parameters

| Parameter      | Type   | Required | Description                                              |
|----------------|--------|----------|----------------------------------------------------------|
| timestamp      | String | Yes      | Current timestamp (milliseconds)                         |
| agency_uid     | String | Yes      | Game agency identification code                          |
| member_account | String | Yes      | Player account (4–20 chars, a-z and 0-9, custom prefix)  |
| game_uid       | String | Yes      | Game UID                                                 |
| credit_amount  | String | Yes      | Player credit amount (Yuan)                              |
| currency_code  | String | Yes      | Currency code (e.g. `USD`)                               |
| language       | String | Yes      | Language code. Default: `en`                             |
| home_url       | String | No       | Back URL — **must not contain `?`**                      |
| platform       | Int    | No       | `1` = web (default), `2` = H5                            |
| callback_url   | String | No       | Game bet data callback URL                               |

#### Response

| Parameter        | Type   | Description   |
|------------------|--------|---------------|
| code             | Int    | Result code   |
| msg              | String | Result message|
| payload          | JSON   | Result data   |
| └ game_launch_url| String | Game URL      |

---

### 2. Retrieve Bet Information (Seamless Callback)

Your server implements this endpoint. The game server POSTs here on every bet/win.

**Method:** `POST https://{callback_url}`

#### Request Parameters

| Parameter  | Type   | Required | Description                      |
|------------|--------|----------|----------------------------------|
| agency_uid | String | Yes      | Agent identification code        |
| timestamp  | String | Yes      | UTC+0, format: `yyyy-MM-dd HH:mm:ss` |
| payload    | String | Yes      | AES-256-encrypted inner JSON     |

#### Payload (inner, encrypted) Parameters

| Parameter      | Type        | Required | Description                                              |
|----------------|-------------|----------|----------------------------------------------------------|
| serial_number  | String      | Yes      | UUID — idempotency key. Same UUID = return `code=0` + current balance, no re-settlement |
| currency_code  | String      | Yes      | Currency code (e.g. `USD`)                               |
| game_uid       | String      | Yes      | Game UID                                                 |
| member_account | String      | Yes      | Player account name                                      |
| win_amount     | String      | Yes      | Win amount (Yuan). Negative = refund                     |
| bet_amount     | String      | Yes      | Bet amount (Yuan). Negative = refund                     |
| timestamp      | String      | Yes      | Current timestamp (milliseconds)                         |
| game_round     | String      | Yes      | Game round ID                                            |
| data           | JSON String | Yes      | Sports event detail data                                 |

#### Response

| Parameter | Type   | Required | Description                                                                                       |
|-----------|--------|----------|---------------------------------------------------------------------------------------------------|
| code      | Int    | Yes      | `0` = success, `1` = failure (triggers retry). Balance must be returned regardless of success/failure. `code=0` + `credit_amount >= 0` = bet accepted. |
| msg       | String | Yes      | Result message                                                                                    |
| payload   | String | Yes      | AES-256-encrypted response JSON                                                                   |

#### Response Payload (inner, encrypted) Parameters

| Parameter     | Type   | Required | Description                                                    |
|---------------|--------|----------|----------------------------------------------------------------|
| credit_amount | String | Yes      | Player balance after settlement: `prev - bet_amount + win_amount` |
| timestamp     | String | Yes      | Current timestamp (milliseconds)                               |

---

### 3. Get Game URL (Transfer) — `/game/v2`

Supports deposit, withdrawal, and balance query in one call.

**Method:** `POST`

#### Payload (inner, encrypted) Parameters

| Parameter      | Type   | Required | Description                                              |
|----------------|--------|----------|----------------------------------------------------------|
| timestamp      | String | Yes      | Current timestamp (milliseconds)                         |
| agency_uid     | String | Yes      | Game agency identification code                          |
| member_account | String | Yes      | Player account name                                      |
| game_uid       | String | No       | Game UID                                                 |
| credit_amount  | String | Yes      | Transfer amount: `> 0` = deposit, `< 0` = withdraw, `= 0` = query |
| currency_code  | String | Yes      | Currency (see appendix)                                  |
| language       | String | No       | Language (see appendix)                                  |
| home_url       | String | No       | Back URL                                                 |
| platform       | Int    | No       | `1` = web (default), `2` = H5                            |
| transfer_id    | String | Yes      | Unique identifier per transaction                        |

#### Response Payload Parameters

| Parameter       | Type   | Required | Description                                     |
|-----------------|--------|----------|-------------------------------------------------|
| game_launch_url | String | Yes      | Game launch URL                                 |
| player_name     | String | Yes      | Player account name                             |
| currency        | String | Yes      | Currency                                        |
| transfer_amount | String | Yes      | Transfer amount (Yuan)                          |
| before_amount   | String | Yes      | Balance before transfer (Yuan)                  |
| after_amount    | String | Yes      | Balance after transfer (Yuan)                   |
| transfer_id     | String | Yes      | Operator's transfer ID                          |
| transaction_id  | String | Yes      | Unique transaction code                         |
| transfer_status | Int    | Yes      | `1` = success, `2` = failed                     |
| timestamp       | Long   | Yes      | Transfer timestamp                              |

---

### 4. Get Transaction Records — `/game/transaction/list`

Returns paginated bet records within a specific time period.

**Method:** `POST`

#### Payload (inner, encrypted) Parameters

| Parameter  | Type   | Required | Description                                          |
|------------|--------|----------|------------------------------------------------------|
| timestamp  | String | Yes      | Current timestamp (milliseconds)                     |
| agency_uid | String | Yes      | Agent identification code                            |
| from_date  | Long   | Yes      | Start date — UTC+0 timestamp in milliseconds         |
| to_date    | Long   | Yes      | End date — UTC+0 timestamp in milliseconds. **Must be same day as `from_date`** |
| page_no    | Int    | Yes      | Page number                                          |
| page_size  | Int    | Yes      | Page size (min: 1, max: 5000)                        |

#### Response Payload Parameters

| Parameter    | Type       | Description    |
|--------------|------------|----------------|
| total_count  | Int        | Total records  |
| current_page | Int        | Current page   |
| page_size    | Int        | Page size      |
| records      | JSON Array | Record list    |

#### Record Fields

| Parameter      | Type   | Description                              |
|----------------|--------|------------------------------------------|
| agency_uid     | String | Agent identification code                |
| member_account | String | Player account name                      |
| bet_amount     | String | Bet amount (Yuan)                        |
| win_amount     | String | Win amount (Yuan)                        |
| currency_code  | String | Currency code                            |
| serial_number  | String | Unique transaction ID                    |
| game_round     | String | Game round ID                            |
| game_uid       | String | Game UID                                 |
| timestamp      | String | Transaction time UTC+0 (`2024-08-19 00:00:00`) |

---

### 5. Get Supplier List — `/game/providers`

**Method:** `GET`

#### Query Parameters

| Parameter  | Type   | Required | Description             |
|------------|--------|----------|-------------------------|
| agency_uid | String | Yes      | Agent identification code |
| currency   | String | No       | Filter by currency      |
| lang       | String | No       | Filter by language      |
| code       | String | No       | Filter by supplier code |

#### Response

```json
{
  "code": 0,
  "msg": "",
  "data": [{ "code": "pg", "name": "PG Soft", ... }]
}
```

| Field  | Type   | Description                    |
|--------|--------|--------------------------------|
| code   | String | Supplier code                  |
| name   | String | Supplier name                  |
| currency | String | Supported currency           |
| lang   | String | Supported language             |
| status | Int    | `0` = disabled, `1` = enabled  |

---

### 6. Get Game List — `/game/list`

**Method:** `GET`

#### Query Parameters

| Parameter  | Type   | Required | Description             |
|------------|--------|----------|-------------------------|
| agency_uid | String | Yes      | Agent identification code |
| currency   | String | No       | Filter by currency      |
| lang       | String | No       | Filter by language      |
| code       | String | Yes      | Supplier code           |

#### Response

```json
{
  "code": 0,
  "msg": "Success",
  "data": [{ "game_name": "Mahjong Ways", ... }]
}
```

| Field     | Type   | Description                   |
|-----------|--------|-------------------------------|
| game_uid  | String | Game UID                      |
| game_name | String | Game name                     |
| game_type | String | Game type                     |
| lang      | String | Language                      |
| status    | Int    | `0` = disabled, `1` = enabled |
| currency  | String | Currency                      |

---

## AES-256 Encryption Reference

All payload fields use **AES-256-ECB + PKCS7 padding + Base64 encoding**.

### Java (BouncyCastle)

```java
import java.security.Security;
import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import org.bouncycastle.jce.provider.BouncyCastleProvider;

public class Encrypt {
    public static final String ALGORITHM = "AES/ECB/PKCS7Padding";

    public static byte[] Aes256Encode(String str, byte[] key) {
        Security.addProvider(new BouncyCastleProvider());
        Cipher cipher = Cipher.getInstance(ALGORITHM, "BC");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"));
        return cipher.doFinal(str.getBytes("UTF-8"));
    }

    public static String encrypt(String strToEncrypt, String key) {
        return Base64.getEncoder().encodeToString(Aes256Encode(strToEncrypt, key.getBytes()));
    }

    public static String decrypt(String strToDecrypt, String key) {
        Cipher cipher = Cipher.getInstance(ALGORITHM, "BC");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key.getBytes(), "AES"));
        byte[] decoded = cipher.doFinal(Base64.getDecoder().decode(strToDecrypt));
        return new String(decoded, "UTF-8");
    }
}
```

### PHP

```php
// Encrypt
echo base64_encode(openssl_encrypt(
    '{"agency_uid":"...","timestamp":1711524622000}',
    'AES-256-ECB',
    '055cd814c358c01ae65da946635633ff',
    OPENSSL_RAW_DATA
));

// Decrypt
echo openssl_decrypt(
    base64_decode('6PVSxlZ1nWt98AO4kX/3fh...'),
    'AES-256-ECB',
    '055cd814c358c01ae65da946635633ff',
    OPENSSL_RAW_DATA
);
```

### JavaScript (CryptoJS)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
<script>
function encrypt(plaintext, keyStr) {
    const key = CryptoJS.enc.Utf8.parse(keyStr);
    const ciphertext = CryptoJS.AES.encrypt(plaintext, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    return ciphertext.toString(); // Base64
}

function decrypt(base64Ciphertext, keyStr) {
    const key = CryptoJS.enc.Utf8.parse(keyStr);
    const decrypted = CryptoJS.AES.decrypt(base64Ciphertext, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}
</script>
```

### Node.js (built-in `crypto`)

```ts
import * as crypto from "crypto";

export function aesEncrypt(plaintext: string, key: string): string {
    const cipher = crypto.createCipheriv("aes-256-ecb", Buffer.from(key, "utf8"), null);
    return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("base64");
}

export function aesDecrypt(base64: string, key: string): string {
    const decipher = crypto.createDecipheriv("aes-256-ecb", Buffer.from(key, "utf8"), null);
    return Buffer.concat([decipher.update(Buffer.from(base64, "base64")), decipher.final()]).toString("utf8");
}
```

---

## Error Codes

| Code  | Description                                      |
|-------|--------------------------------------------------|
| 0     | Success                                          |
| 10002 | Agency not exist                                 |
| 10004 | Payload error                                    |
| 10005 | System error                                     |
| 10008 | Game does not exist                              |
| 10011 | Player currencies do not match                   |
| 10012 | Player name already exists — change player name  |
| 10013 | Currency is not supported                        |
| 10014 | PlayerName is incorrect                          |
| 10015 | Account limited to a-z and 0-9                   |
| 10016 | Account frozen — contact administrator           |
| 10017 | Manufacturer does not exist                      |
| 10018 | Line does not support current currency           |
| 10020 | Carrier does not configure a currency            |
| 10022 | Incorrect parameters                             |
| 10023 | Player name must be at least 3 characters        |
| 10024 | Wallet mode does not match                       |
| 10025 | Insufficient wallet balance                      |
| 10026 | Transfer failed                                  |
| 10027 | Transfer order already exists                    |
| 10028 | Start and end date cannot be empty               |
| 10029 | Start and end dates must be the same day         |
| 10030 | Too many requests — try again later              |
| 10031 | Only data within the last 60 days can be queried |
| 10032 | End date must be greater than start date         |
| 10033 | home_url cannot contain `?`                      |
| 10034 | System scheduled maintenance                     |

---

## Appendix

- **Game list, language codes, currency codes:**
  https://drive.google.com/drive/folders/12FAKtvy2TrWso5CuGAMHoPVWZtwGrCuZ
