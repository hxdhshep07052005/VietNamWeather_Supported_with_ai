# ADR-003 — Next.js, TypeScript và PWA

**Status:** Accepted  
**Date:** 2026-07-29  
**Decision:** `ARCH-006`

## Bối cảnh

Sản phẩm cần landing/legal page có SEO, ứng dụng bản đồ mobile-first sau đăng nhập, i18n Việt–Anh, browser geolocation và khả năng install. Frontend chỉ được render dữ liệu từ Application API, không sở hữu business/security logic.

## Quyết định

Dùng Next.js + TypeScript. Public marketing/legal pages dùng SSR/SSG khi có lợi; authenticated product là client-rich routes. Bổ sung PWA shell cho installability và active GPS follow khi trang còn hoạt động.

## Phương án đã xem xét

- **SPA thuần:** đơn giản cho map nhưng kém hơn cho SEO/public content và initial rendering.
- **Native app ngay từ MVP:** hỗ trợ background GPS tốt hơn nhưng vượt quá delivery/cost envelope.
- **Next.js hybrid + PWA:** được chọn để dùng một codebase và vẫn giữ đường nâng cấp native về sau.

## Trade-off và hệ quả

- Phải kiểm tra SSR/client boundary, hydration, bundle size và service-worker caching.
- PWA không cam kết tracking khi browser đóng/tab bị suspend/màn hình khóa.
- Map/weather animation phải có reduced-motion và static fallback.

## Security impact

Không chứa Directus/provider secret, internal collection name, JWT/refresh token hoặc risk/quota rule trong bundle. Service worker không cache private API response ngoài allowlist/versioned policy; CSP và dependency scan là bắt buộc.

## Chi phí và vận hành

Một frontend giảm chi phí duy trì so với web + native, nhưng SSR có server compute và map bundle có bandwidth cost. Phase 9 phải đo Web Vitals/bundle thay vì giả định framework tự đạt performance.

## Migration và rollback

PWA có thể tắt bằng cách thu hồi service worker/manifest theo release procedure mà không đổi `/api/v1`. Nếu chuyển framework hoặc native app, OpenAPI/public DTO và i18n message codes vẫn là compatibility boundary.

## Evidence cần có

Phase 9 phải chứng minh không leak secret/internal schema trong build, Web Vitals đạt budget, geolocation permission states đúng và cache private data tuân policy.
