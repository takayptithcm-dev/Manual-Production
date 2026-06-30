# Exhibition Booth Production Manual Generator

Đây là ứng dụng tạo Production Manual (bản vẽ kỹ thuật và bóc tách vật liệu) tự động cho các gian hàng triển lãm (Exhibition Booth) sử dụng AI rà soát và tạo danh sách vật tư (BOM - Bill of Materials).

## Các tính năng chính (Đã hoàn thiện & ghi nhớ)

1. **Giao diện đa bước (Multi-step Flow)**:
   - Tải lên hình ảnh Render (Perspective).
   - Tải lên bản vẽ kỹ thuật (Technical drawings).
   - Thiết lập môi trường (Trong nhà/Ngoài trời) để AI có ngữ cảnh tư vấn vật liệu.

2. **AI Tự động trích xuất thông tin (Gemini API Integration)**:
   - AI nhận diện hình ảnh và tự động bóc tách các hạng mục cần sản xuất.
   - Trích xuất chi tiết thành phần, kích thước sơ bộ, mô tả thi công và đề xuất vật liệu phù hợp với môi trường sử dụng.

3. **Chỉnh sửa Production Manual Trực tiếp**:
   - Giao diện trực quan cho phép xem và kéo thả các điểm đánh dấu (Annotation markers) trên hình render.
   - Danh sách vật liệu (BOM) có thể chỉnh sửa trực tiếp (Editable text) và tự động thay đổi kích thước ô text (Auto-resize text area) phù hợp với nội dung dài.
   - Thêm/Xóa các hạng mục, đề xuất chất liệu qua tính năng autocomplete.

4. **Xuất file báo cáo (Export)**:
   - **Lưu Project JSON**: Lưu trữ toàn bộ project hiện tại (Save Project) và mở lại sau (Load Project) giữ nguyên tọa độ marker, nội dung đã chỉnh sửa.
   - **Quản lý Thư viện vật liệu**: Hỗ trợ thêm, sửa, xóa, khôi phục thư viện và xuất/nhập (Export/Import) thư viện cấu hình riêng của user dưới dạng file JSON.
   - **Tải ảnh JPG**: Xuất hình ảnh bản vẽ kỹ thuật / đánh dấu.
   - **Tải Excel**: Xuất bảng báo giá BOM ra định dạng file Excel (XLSX) chuẩn chỉnh với format.
   - **Tải PDF**: Xuất toàn bộ Production manual ra file PDF chất lượng cao, tự động chuyển trang nếu phần hình ảnh dài.

5. **Chatbot hỗ trợ**:
   - Tích hợp Chatbot AI hỗ trợ trả lời các thông tin liên quan đến vật tư và quá trình lắp đặt.

## Phiên bản
- 1.0.0: Các tính năng cốt lõi và xuất file nâng cao.
