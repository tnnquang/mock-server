---
description: Quy trình làm việc chuẩn cho dự án Mock Server
---

# Quy trình làm việc (Strict Workflow)

Để đảm bảo tính nhất quán và không làm ảnh hưởng đến môi trường của USER, Antigravity phải tuân thủ các quy tắc sau:

## 1. Quản lý Port & Process

- **Cố định Port:** Luôn sử dụng port `3000` cho server trừ khi USER yêu cầu khác.
- **Dọn dẹp:** Trước khi khởi động server mới, PHẢI kiểm tra và kill process đang chiếm port 3000.
- **Lệnh chuẩn:** Sử dụng Powershell để kill port: `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force`.
- **Terminal:** PHẢI chạy lệnh trực tiếp trên terminal của project đang mở. KHÔNG ĐƯỢC PHÉP chạy trên background terminal (tránh sử dụng các lệnh trả về CommandId để chạy ngầm nếu không thực sự cần thiết, đảm bảo USER thấy được log real-time).

## 2. Chất lượng Code & Build

- **Kiểm tra TypeScript:** Mọi thay đổi code PHẢI được kiểm chứng bằng lệnh `npx tsc`. Không được để file có lỗi đỏ trong tab Problems.
- **Fix Lint/Types:** Ưu tiên fix các lỗi type không rõ ràng (`any`, missing module types) ngay lập tức.

## 3. Quy trình thực hiện Task

- **B1: Phân tích:** Đọc kỹ yêu cầu, liệt kê các file sẽ ảnh hưởng.
- **B2: Viết code:** Thực hiện thay đổi CONTIGUOUS khi có thể.
- **B3: Build:** Chạy `npx tsc` để verify.
- **B4: Khởi động & Test:** Chạy server và cung cấp lệnh `curl` cụ thể để USER có thể copy-paste kiểm chứng kết quả.

## 4. Quản lý File & Path

- **Đường dẫn:** Luôn sử dụng đường dẫn tuyệt đối khi dùng tool của agent.
- **Mock Data:** Mọi file tạm (temp file) cho inline-type phải được dọn dẹp hoặc quản lý tập trung ở thư mục Temp của OS.

## 5. Giao tiếp

- **Ngôn ngữ:** Sử dụng tiếng Việt thân thiện, rõ ràng (theo style của USER).
- **Trạng thái:** Luôn báo cáo "Đã làm gì", "Còn lỗi gì", "Kế hoạch tiếp theo" một cách ngắn gọn.
