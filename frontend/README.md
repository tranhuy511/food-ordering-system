# Foodie Frontend

Giao diện web khách hàng cho Food Ordering System (NestJS microservices).

## Chức năng

- Đăng ký tài khoản qua `POST /users`.
- Đăng nhập qua `POST /auth/login`; access token được lưu trong `localStorage`.
- Đọc danh sách nhà hàng từ `GET /restaurants`.
- Catalog món demo ở frontend, thêm/xóa/tăng giảm giỏ hàng.
- Tạo đơn hàng qua `POST /orders`.
- Thanh toán online qua `POST /payments`, hoặc chọn tiền mặt.
- Xem danh sách/chi tiết đơn qua `GET /orders`, `GET /orders/:id`.
- Thử thanh toán lại khi `paymentStatus = failed`.
- Hủy đơn qua `PATCH /orders/:id/cancel` khi trạng thái còn `pending`.

## Yêu cầu

- Node.js 20+
- Backend Food Ordering System chạy qua Nginx tại `http://localhost:8081`.
- Các route Nginx cần proxy: `/auth`, `/users`, `/restaurants`, `/orders`, `/payments`.

## Chạy trên Windows PowerShell

Mở terminal mới tại thư mục frontend:

```powershell
cd "D:\visual studio code\dự án\food-ordering-system\frontend"
npm install
npm run dev
```

Mở `http://localhost:5173`.

Vite dev server tự proxy các route API kể trên về `http://localhost:8081`. Có thể đổi đích proxy bằng biến `VITE_API_PROXY_TARGET`.

## Build

```powershell
npm run build
npm run preview
```

## Giới hạn tích hợp hiện tại

Backend hiện có API nhà hàng và đơn hàng, nhưng chưa có API danh mục món ăn/sản phẩm. Vì vậy `src/menu.js` cung cấp dữ liệu món mẫu cố định cho giao diện. Khi đặt hàng, frontend gửi các trường `productId`, `productName`, `unitPrice`, `quantity` lên Order Service; backend lưu chi tiết món theo dữ liệu request. Không có kiểm tra giá/tồn kho từ Product Service trong phiên bản này.

Thanh toán online là luồng mô phỏng hiện tại của Payment Service (`MOCK_PAYMENT_RESULT`), chưa phải cổng thanh toán thật.

## Khu vực quản trị Admin

- Tab **Quản trị** chỉ hiển thị với tài khoản có `role: "admin"` trong thông tin đăng nhập.
- Dashboard tải danh sách nhà hàng bằng `GET /restaurants`, tìm kiếm và lọc theo trạng thái.
- Admin có thể chuyển trạng thái bằng `PATCH /restaurants/:id/status` với các giá trị `pending`, `active`, `inactive`.
- Backend Restaurant Service bảo vệ thao tác cập nhật trạng thái bằng `JwtAuthGuard` và `RolesGuard` (`admin`). Frontend ẩn tab chỉ là trải nghiệm UI; quyền thực tế vẫn do backend quyết định.

### Giới hạn API hiện tại

- Backend chưa có endpoint lấy toàn bộ đơn hàng dành cho Admin; `GET /orders` hiện trả về đơn hàng của người dùng đang đăng nhập. Vì vậy giao diện không giả lập dashboard doanh thu hoặc danh sách đơn toàn hệ thống.
- Backend chưa có Product/Menu API; món ăn vẫn là dữ liệu demo trong `src/menu.js`.
- Quản lý trạng thái nhà hàng đã kết nối API thật; CRUD món ăn, quản trị người dùng và quản lý đơn toàn hệ thống chưa được triển khai.
