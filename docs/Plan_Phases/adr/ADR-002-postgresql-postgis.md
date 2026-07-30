# ADR-002 — PostgreSQL với PostGIS

**Status:** Accepted  
**Date:** 2026-07-29  
**Decision:** `ARCH-005`

## Bối cảnh

Sản phẩm cần lưu location, route geometry, bounding query, spatial index, khoảng cách và sampling theo tuyến. Nếu chỉ lưu latitude/longitude dạng số rời rạc, logic không gian sẽ phân tán vào application code và khó kiểm chứng.

## Quyết định

Dùng PostgreSQL làm database chính và bật PostGIS ngay từ môi trường reproducible đầu tiên. Spatial data dùng SRID được quy định trong schema/migration; public API chỉ trả provider-neutral GeoJSON/DTO đã validate.

## Phương án đã xem xét

- **PostgreSQL không PostGIS:** vận hành đơn giản hơn nhưng tăng custom geospatial logic và migration về sau.
- **Database geospatial riêng:** mạnh nhưng tạo thêm system of record và complexity không cần thiết cho MVP.
- **PostgreSQL + PostGIS:** được chọn để giữ một nguồn dữ liệu bền vững và dùng spatial index chuẩn.

## Trade-off và hệ quả

- Cần image/version tương thích PostGIS, migration test và restore test có extension.
- Spatial query phải có index/query-plan evidence để tránh full scan.
- Database type không được rò ra public API hoặc khóa adapter vào provider cụ thể.

## Security impact

Database chỉ ở private network, dùng role tách biệt cho Directus, migration và worker. Geometry/GPS tuân theo retention, ownership và log-redaction policy; query input phải giới hạn kích thước/toạ độ hợp lệ.

## Chi phí và vận hành

Không thêm service database mới nhưng tăng dung lượng geometry/index và yêu cầu backup/restore tương thích. Storage/query cost phải được đo bằng fixture route thực, không ước lượng cảm tính.

## Migration và rollback

Migration schema phải version hóa và có backup trước thay đổi. Bỏ PostGIS không phải rollback cấu hình đơn giản: phải export/convert geometry và thay toàn bộ query; do đó chỉ thực hiện qua ADR superseding và migration rehearsal.

## Evidence cần có

Phase 2/4 phải chứng minh extension được pin, migration chạy lại được, restore thành công và spatial index được sử dụng trên golden dataset.
