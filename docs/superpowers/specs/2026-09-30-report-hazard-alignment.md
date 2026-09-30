# Đặc tả sửa hazard theo report/main_vi.pdf

## Mục tiêu và phạm vi đã được người dùng duyệt

Thay các điểm gán sẵn và công thức continuous do assistant thêm bằng mô hình discrete của báo cáo. Weather Forecast, Map và Route phải hiển thị đánh giá backend nhất quán. Không sửa PDF để hợp thức hóa code. Không tự tạo ngưỡng, hệ số, dữ liệu thời tiết hoặc bằng chứng thực nghiệm. Không commit, reset hay ghi đè các thay đổi không liên quan của người dùng.

## Nguồn và quyết định đối chiếu

- Báo cáo mục 2.2.3, trang in 28–29 (PDF 30–31): công thức (2.4), (2.5), (2.6).
- Mục 3.5.2, trang in 52–53 (PDF 54–55): công thức (3.13), Bảng 3.1 theo phương tiện.
- Mục 3.5.3, trang in 53: công thức (3.14), chuẩn hóa thời gian/cự ly bằng giá trị lớn nhất trong tập phương án.
- Bảng 5.1, trang in 72: các giá trị 0.14/0.18/0.22 không thể suy ra bằng cách chia trung bình các severity hợp lệ 1–3 cho 3. Không tái tạo các số này bằng fallback hoặc hiệu chỉnh tùy tiện.
- Report có trung bình theo chiều dài tại (2.6) và trung bình các điểm tại 3.5.3. Theo thiết kế người dùng đã duyệt, triển khai trung bình theo chiều dài (2.6), chia 3 để chuẩn hóa; ghi rõ khác biệt này trong tài liệu kiểm chứng.

## Hazard và trạng thái dữ liệu

Sáu chiều: rain, wind, temperature, visibility, storm, official alert.

- Unknown có mã 0; Low = 1, Caution = 2, High = 3. Không tạo thêm một cấp an toàn có điểm 0.
- Dữ liệu hợp lệ: cấp checkpoint là MAX các cấp hazard đã đánh giá.
- Mã Unknown không phải điểm rủi ro bằng không. Không đưa Unknown vào trung bình như một quan trắc an toàn.
- Thiếu dữ liệu cần thiết, ngoài coverage, dữ liệu hết hạn, lỗi truy vấn hoặc không có ruleset hợp lệ: trả Unknown và lý do. Giữ bằng chứng hazard đã biết nhưng không khẳng định đánh giá đầy đủ.
- Không suy ra “không có cảnh báo” từ việc chưa tích hợp nguồn cảnh báo. Không suy ra dông trực tiếp/dông xa khi provider không phân biệt được.
- Hiển thị điểm Unknown là null/“Chưa đủ dữ liệu”, không 0/100, 15/100 hay Low.

## Ma trận phương tiện — Bảng 3.1

| Chiều | Xe máy Caution | Xe máy High | Ô tô Caution | Ô tô High |
|---|---|---|---|---|
| Mưa mm/h | 10 ≤ r < 25 | r ≥ 25 | 15 ≤ r < 35 | r ≥ 35 |
| Gió giật km/h | 25 ≤ w < 40 | w ≥ 40 | 45 ≤ w < 60 | w ≥ 60 |
| Tầm nhìn m | 1000 ≤ v < 2000 | v < 1000 | 500 ≤ v < 1000 | v < 500 |
| Nhiệt độ °C | 36–38 hoặc 10–13 | >38 hoặc <10 | 38–40 hoặc 5–8 | >40 hoặc <5 |
| Dông | Dông xa hoặc mây vũ tích | Dông trực tiếp hoặc mưa đá | Như xe máy | Như xe máy |
| Cảnh báo | Cấp thiên tai 1–2 | Cấp 3 trở lên | Như xe máy | Như xe máy |

Các khoảng nhiệt độ ghi bằng dấu gạch trong bảng được hiểu bao gồm hai đầu mút; High xét trước Caution. Low là phần còn lại khi dữ liệu đầy đủ và không kích hoạt Caution/High. Do đó tầm nhìn ô tô ≥1000 m là Low theo Bảng 3.1, không phải ≥2000 m như assistant từng chép sai. Các ngưỡng phải nằm trong cấu hình versioned, không sao chép thành luật riêng trong frontend. Không thay Bảng 3.1 bằng quy tắc giảm đồng loạt 30% vì con số đó không tái tạo đúng bảng.

## Tính tuyến

Với các điểm đã sắp theo khoảng cách tích lũy d[i], severity s[i]:

```
delta[i] = d[i+1] - d[i]
weightedSeverity = sum(delta[i] * (s[i] + s[i+1]) / 2) / sum(delta[i])
normalizedScore = weightedSeverity / 3
displayScore = round(normalizedScore * 100)
routeLevel = levelOf(max(s[i]))
```

- Chỉ tính điểm toàn tuyến khi các đoạn đều có dữ liệu đủ điều kiện.
- Khoảng cách không hợp lệ, tổng chiều dài bằng 0 hoặc thiếu hai điểm phân biệt: không chia cho 0, không gán điểm an toàn; trả trạng thái không thể đánh giá.
- Sampling gồm điểm đầu/cuối, khoảng cách giữa điểm ≤5 km và thời gian ≤15 phút theo report. Không dùng 5 checkpoint hiển thị thay cho toàn bộ mẫu tính toán.
- Weather matching dùng tọa độ và ETA thực sự, giới hạn không gian 15 km theo report; không gắn cứng fresh hoặc condition clear.
- Không ép Weather-safer thành Low/0.14 hoặc tự sửa cự ly để tạo Shortest. Các phương án dùng cùng quy tắc, thời tiết và phiên bản luật.
- Balanced score: 0.5 × normalizedRisk + 0.3 × duration/maxDuration + 0.2 × distance/maxDistance. Không dùng tỷ số so với tuyến nhanh nhất. Chỉ xếp hạng các phương án đủ dữ liệu; không gọi đây là đảm bảo an toàn tuyệt đối.

## Weather Forecast / Map / Hazard matrix

- Bỏ bộ tính continuous và điểm vùng 12/14/22 trong luồng sản phẩm.
- Không tính hazard bằng thời tiết sinh từ tên tỉnh, region baseline hoặc timeline giả lập.
- Backend trả level, mã severity, score nullable, freshness/coverage, nguồn và phiên bản luật, evidence từng chiều. Frontend chỉ định dạng, không có engine riêng.
- Điểm tại một địa điểm/thời điểm hợp lệ nếu hiển thị /100 là severity/3 ×100: khoảng 33/67/100. Không cố làm các thành phố cùng cấp có điểm khác nhau.
- Report không định nghĩa phương tiện mặc định cho điểm thành phố. Không tự mặc định car/motorcycle; khi chưa có ngữ cảnh phương tiện, hiển thị chưa chọn phương tiện/chưa có đánh giá theo phương tiện.
- Số checkpoint nguy hiểm phải đếm từ dữ liệu. Bảng 5.1 mô tả checkpoint nguy hiểm, không chứng minh “4/6” là bốn loại hazard. Không giữ các nhãn tĩnh 0/6, 2/6, 4/6.
- Không có dữ liệu thật thì hiển thị unavailable/Unknown, không âm thầm dùng dữ liệu mô phỏng. Dữ liệu demo nếu giữ cho test phải tách khỏi luồng sản phẩm.

## Giới hạn cần công khai

Report và tài liệu Phase có ngưỡng/freshness khác nhau; không coi hai bộ tài liệu tương đương. Report mô tả Fresh ≤60 phút current, Aging tới 180 phút và Stale >180 phút; forecast fresh ≤24 giờ. Đặc tả không tự phát minh điểm phạt cho Aging. Trước triển khai cần xác định contract freshness hiện có và ghi rõ việc giữ nhãn giảm độ tin cậy; dữ liệu không đủ điều kiện không được khuyến nghị là an toàn.

Provider chỉ có mã thunderstorm chung hoặc thiếu official alerts có thể khiến đánh giá sáu chiều chưa đầy đủ. Không giả lập các nguồn này để tránh UI Unknown. Điều này là giới hạn dữ liệu, không phải lỗi cần che bằng số mặc định.

## Kiểm thử nghiệm thu

1. Đúng tại và sát mọi biên Bảng 3.1, đúng đơn vị gió giật/tầm nhìn/lượng mưa theo khoảng giờ.
2. Hazard 1,2,1,3,1,1 → checkpoint High (3), không cộng thành 9.
3. Các điểm d=[0,10000,30000,40000], s=[1,1,2,3] → weightedSeverity=1.625, score=13/24, UI=54; level vẫn High.
4. Toàn bộ Low → score=1/3, không thể là 0.14; toàn High →1.
5. Unknown, stale, lỗi DB/provider, thiếu ruleset và thiếu cảnh báo không biến thành Low.
6. Đổi tên alternative không đổi điểm; cùng geometry/weather cho cùng risk.
7. ETA khác phải chọn đúng dữ liệu forecast, ngoài 15 km không nhận bừa observation gần nhất.
8. UI phản ánh loading/error/Unknown, không fallback điểm hay hazard tĩnh.
9. Build lại các package trước Node tests (tests import dist); không dùng test trên dist cũ làm bằng chứng source mới đúng.
10. Chạy unit/integration có dependency giả lập rõ ràng, typecheck, frontend tests; báo riêng phần chưa kiểm chứng với DB/provider thật.

## Trạng thái

Đặc tả đã được ghi lại từ thiết kế hội thoại được duyệt, bổ sung các đính chính đối chiếu PDF. Chờ người dùng duyệt bản file trước khi lập kế hoạch thực thi chi tiết và thay đổi code sản phẩm.
