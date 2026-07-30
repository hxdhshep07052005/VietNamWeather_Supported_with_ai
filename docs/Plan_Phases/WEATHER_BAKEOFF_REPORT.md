# Weather Provider Bake-off Report

## 1. Status

| Field | Value |
|---|---|
| Execution time | 2026-07-30 02:00 ICT / 2026-07-29 19:00 UTC |
| State | SELECTED BASELINE / CAPABILITY-BOUNDED TO LIVE ACCOUNT |
| Test fixture | Initial Hanoi probe plus 30-location Vietnam fixture |
| Provider requests sent | 66 |
| Secrets in report | None |
| Winner | WeatherAPI.com |

Initial capability probing was followed by the reproducible 30-location suite in [VIETNAM_PROVIDER_FIXTURE_REPORT.md](VIETNAM_PROVIDER_FIXTURE_REPORT.md). WeatherAPI is selected only for capability actually observed on the current account; this is not a claim of meteorological accuracy or guaranteed 7-day availability.

## 2. Probe method

- Credential được đọc từ local ignored environment file; không in request URL hoặc key.
- WeatherAPI gọi forecast endpoint với yêu cầu 7 ngày, metric fields và alerts.
- OpenWeather gọi One Call 4.0 current endpoint.
- OpenWeather Current 2.5 được gọi để phân biệt invalid key với missing One Call 4.0 subscription.
- Hai thử nghiệm wrapper trước đó lỗi parameter binding trên Windows PowerShell 5.1 trước HTTP transport, không được tính là provider request hay provider failure.

Reproducible command:

```powershell
powershell -ExecutionPolicy Bypass -File tools/provider-bakeoff/run-weather-capability-probe.ps1 -Latitude 21.0278 -Longitude 105.8342 -WeatherApiDays 7
```

## 3. Observed results

| Probe | HTTP | Observed latency | Result |
|---|---:|---:|---|
| WeatherAPI forecast requested for 7 days | 200 | 491 ms | Key hợp lệ; trả current data, alerts property, 3 forecast days và 24 hourly records cho ngày đầu |
| OpenWeather One Call 4.0 current | 401 | 195 ms | Provider xác nhận One Call 4.0 cần subscription riêng cho key/account hiện tại |
| OpenWeather Current Weather 2.5 | 200 | 59 ms | Key hợp lệ; trả location, temperature, wind và visibility |

Observed latency chỉ là một lần gọi và không được dùng như p95/SLO evidence.

### Reproducibility re-run

Runner được chạy lại lúc `2026-07-29T19:53:51Z` với cùng tọa độ và cùng request shape:

| Probe | HTTP | Observed latency | Re-run result |
|---|---:|---:|---|
| WeatherAPI forecast requested for 7 days | 200 | 491 ms | Vẫn chỉ trả 3 forecast days; location label lần này là `Hao Nam` |
| OpenWeather One Call 4.0 current | 401 | 182 ms | Vẫn yêu cầu One Call by Call subscription riêng |
| OpenWeather Current Weather 2.5 | 200 | 54 ms | Vẫn trả current fields và location `Hà Nội` |

Hai lần gọi vẫn không đủ để tính p50/p95. Location label thay đổi từ `Hanoi` sang `Hao Nam` cho cùng tọa độ cho thấy khác biệt granularity/reverse-location labeling; backend không được dùng provider label làm location identity authoritative.

## 4. Data-quality notes

- WeatherAPI trả location `Hanoi`, country `Vietnam` và timezone ID `Asia/Bangkok`. Offset UTC+7 phù hợp khu vực nhưng không trùng product canonical timezone `Asia/Ho_Chi_Minh`; backend phải normalize timezone bằng config/reference data, không tin trực tiếp provider string cho quota/billing logic.
- Re-run trả location label `Hao Nam` cho cùng tọa độ. Location ID/catalog phải đến từ geocoding/reference source đã chọn; weather provider label chỉ là metadata hiển thị đã normalize.
- WeatherAPI chỉ trả 3 ngày dù request 7 ngày. Capability hiện tại chưa chứng minh phủ 72 rolling hours đầy đủ và không cho phép bật trần entitlement 7 ngày; `ARCH-013` giới hạn output theo coverage thật.
- OpenWeather Current 2.5 chứng minh key hợp lệ, nhưng không thay thế bằng chứng One Call 4.0. Không được dùng kết quả 2.5 để tuyên bố 4.0 pass.
- Không đánh giá alert coverage, forecast completeness theo lead time, Vietnam-wide coverage hoặc commercial storage terms từ probe này.

## 5. Full Vietnam fixture result

The accepted suite used 30 locations resolved from live Geoapify results across North, Central and South Vietnam:

| Metric | Result |
|---|---|
| Successful current + forecast responses | 30/30 |
| Requested days | 7 |
| Returned days | Exactly 3 at every location |
| Latency | p50 86 ms; p95 310 ms |
| Provider timezone labels | 19 `Asia/Ho_Chi_Minh`, 9 `Asia/Bangkok`, 2 `Asia/Phnom_Penh` |

Thirty WeatherAPI requests from a packaging-failed fixture execution and 30 from the accepted execution are included in request accounting, but only the accepted run contributes metrics. Together with the two WeatherAPI calls and four OpenWeather calls from the initial/reproducibility probes, 66 weather-provider requests were sent.

## 6. Final provider decision

WeatherAPI is the initial primary point-weather adapter under `ARCH-013` and `ADR-011`:

- Current plus the account's actual 3-day forecast capability may be exposed.
- `DATA-004` is a maximum horizon. Risk/route evaluation uses the intersection of configured maximum and provider-valid coverage; it never assumes 72 rolling hours merely because 3 calendar days were returned.
- Day 4–7 outlook remains capability-disabled until account-level evidence proves it is available.
- OpenWeather Current 2.5 is not a silent production fallback. One Call 4.0 remains deferred because the current account lacks its subscription.
- No missing day, alert, value or timestamp is extrapolated or fabricated.

## 7. Security follow-up

Hai credential đã được nhập trực tiếp trong chat nên phải rotate/revoke sau bake-off. Key thay thế tiếp tục chỉ nằm trong ignored local secret file và tuyệt đối không được đưa vào frontend, Git, screenshot hoặc evidence report.
