# Hackathon Finance App

Ứng dụng quản lý tài chính cá nhân gồm backend Node.js/Express và mobile app Expo React Native. App hỗ trợ đăng ký, đăng nhập bằng OTP qua email, ghi nhận thu chi, thống kê chi tiêu, quản lý ngân sách, subscription/trả góp và phân tích hóa đơn bằng Gemini AI.

## Tính năng chính

- Đăng ký tài khoản và đăng nhập passwordless bằng OTP email.
- Lưu session cục bộ trên app bằng AsyncStorage.
- Tạo, xem, cập nhật, xóa giao dịch thu/chi.
- Lọc giao dịch và thống kê theo tháng/năm.
- Quản lý ngân sách theo danh mục.
- Quản lý subscription và các khoản trả góp theo tháng.
- Scan/parse hóa đơn từ text hoặc ảnh bằng Gemini.
- Tạo gợi ý tiết kiệm dựa trên danh mục chi tiêu cao.
- Lưu dữ liệu local bằng các file JSON trong thư mục `database/`.

## Công nghệ sử dụng

### Backend

- Node.js + Express 5
- Google GenAI SDK
- Nodemailer Gmail SMTP
- File-based JSON database
- CORS, body-parser, dotenv

### Mobile app

- Expo SDK 54
- React Native 0.81
- Expo Router
- TypeScript
- AsyncStorage
- Expo Camera, Image Picker, Speech Recognition
- Be Vietnam Pro fonts

## Cấu trúc thư mục

```text
.
|-- server.js                 # Express API server
|-- lib/
|   |-- database.js           # File-based JSON database layer
|   |-- emailService.js       # Gửi OTP qua Gmail
|   `-- auth.js
|-- client/                   # Expo React Native app
|   |-- app/                  # Expo Router screens
|   |-- components/           # UI components
|   |-- hooks/                # API/database hooks
|   |-- lib/                  # Auth client service
|   |-- services/             # Gemini client service
|   |-- constants/            # Theme/fonts
|   `-- assets/               # Images, fonts, SVG
`-- database/                 # Tự động tạo khi server ghi dữ liệu
```

## Yêu cầu

- Node.js 18 trở lên
- npm
- Expo CLI hoặc dùng `npx expo`
- Tài khoản Gmail có App Password để gửi OTP
- Gemini API key

## Cài đặt

### 1. Cài dependencies backend

```bash
npm install
```

### 2. Cài dependencies mobile app

```bash
cd client
npm install
```

### 3. Tạo file `.env` ở thư mục gốc

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
GMAIL_SENDER_NAME=Hackathon App
```

### 4. Tạo file `.env` trong `client/`

```env
EXPO_PUBLIC_SERVER_HOST=localhost
EXPO_PUBLIC_SERVER_PORT=3000
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

Nếu chạy app trên điện thoại thật, thay `EXPO_PUBLIC_SERVER_HOST` bằng IPv4 của máy đang chạy backend. Backend sẽ in danh sách network interfaces khi khởi động.

## Chạy project

### Chạy backend

Ở thư mục gốc:

```bash
node server.js
```

Server mặc định chạy tại:

```text
http://localhost:3000
```

Kiểm tra server:

```bash
curl http://localhost:3000/ping
```

### Chạy mobile app

Ở thư mục `client/`:

```bash
npm start
```

Sau đó mở bằng Expo Go, Android emulator, iOS simulator hoặc web.

```bash
npm run android
npm run ios
npm run web
```

## API chính

### Auth

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/auth/signup` | Đăng ký user mới |
| `POST` | `/auth/request-otp` | Gửi OTP đến email |
| `POST` | `/auth/verify-otp` | Xác thực OTP và tạo session |
| `POST` | `/auth/signout` | Đăng xuất |
| `POST` | `/auth/verify` | Kiểm tra session |
| `GET` | `/auth/profile` | Lấy profile |
| `PUT` | `/auth/profile` | Cập nhật profile |

### Transactions

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/transactions` | Tạo giao dịch |
| `GET` | `/transactions` | Lấy danh sách giao dịch |
| `GET` | `/transactions/stats` | Lấy thống kê thu/chi |
| `GET` | `/transactions/:id` | Lấy chi tiết giao dịch |
| `PUT` | `/transactions/:id` | Cập nhật giao dịch |
| `DELETE` | `/transactions/:id` | Xóa giao dịch |

### Subscriptions

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/subscriptions` | Tạo subscription/trả góp |
| `GET` | `/subscriptions` | Lấy danh sách subscription |
| `GET` | `/subscriptions/:id` | Lấy chi tiết subscription |
| `PUT` | `/subscriptions/:id` | Cập nhật subscription |
| `POST` | `/subscriptions/:id/pay` | Ghi nhận thanh toán tháng tiếp theo |
| `DELETE` | `/subscriptions/:id` | Xóa subscription |
| `POST` | `/subscriptions/parse` | Parse subscription từ text bằng AI |

### AI và tiện ích

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/ping` | Kiểm tra kết nối |
| `POST` | `/parse-test` | Test request body |
| `POST` | `/parse` | Parse hóa đơn/giao dịch/subscription từ text hoặc ảnh |
| `POST` | `/insight` | Tạo insight tiết kiệm bằng Gemini |
| `GET` | `/budgets` | Lấy ngân sách theo danh mục |
| `PUT` | `/budgets` | Cập nhật ngân sách theo danh mục |

Những endpoint cần đăng nhập sử dụng header:

```http
Authorization: Bearer <sessionId>
```

## Lưu trữ dữ liệu

Backend sẽ tự động tạo thư mục `database/` và các file JSON khi có dữ liệu:

- `users.json`
- `sessions.json`
- `transactions.json`
- `subscriptions.json`
- `otps.json`

Đây là cách lưu trữ phù hợp cho demo/hackathon. Khi đưa lên production nên thay bằng database thật như PostgreSQL, MySQL, MongoDB hoặc Supabase.

## Ghi chú khi chạy trên thiết bị thật

- Backend đang bind `0.0.0.0`, nên có thể truy cập từ máy khác trong cùng mạng LAN.
- Điện thoại và máy tính cần chung Wi-Fi.
- Đặt `EXPO_PUBLIC_SERVER_HOST` thành IPv4 của máy tính, ví dụ `192.168.1.10`.
- Nếu dùng Android emulator và host là `localhost`, app sẽ tự map sang `10.0.2.2`.

## Scripts

### Backend

Hiện tại backend chưa có script `start`, chạy trực tiếp bằng:

```bash
node server.js
```

### Client

```bash
npm start        # Expo dev server
npm run android  # Chạy Android
npm run ios      # Chạy iOS
npm run web      # Chạy web
npm run lint     # Kiểm tra lint
```

## Bảo mật

- Không commit file `.env`.
- Dùng Gmail App Password thay vì mật khẩu Gmail thật.
- OTP hết hạn sau 10 phút.
- Session mặc định hết hạn sau 7 ngày.
- Khi lên production, nên thêm HTTPS, rate limit, validation đầy đủ và database có backup.
