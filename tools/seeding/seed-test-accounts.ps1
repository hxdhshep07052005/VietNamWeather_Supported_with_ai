# Seed Test Accounts Script for VietnamWeather AI
param(
    [string]$DirectusUrl = "http://127.0.0.1:8055",
    [string]$AdminEmail = "bootstrap@example.com",
    [string]$AdminPassword = "P85hSc9wup1LtcL9d14BZz5b80sqz8wBCAKbevE5S5E"
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

Write-Host "=== ĐANG KHỞI TẠO TÀI KHOẢN THỬ NGHIỆM VIETNAMWEATHER AI ===" -ForegroundColor Cyan

# 1. Login Directus Admin
Write-Host "1. Đăng nhập Directus Admin..." -ForegroundColor Yellow
$loginRes = Invoke-RestMethod -Method Post -Uri "$DirectusUrl/auth/login" -ContentType 'application/json' -Body (@{
    email = $AdminEmail
    password = $AdminPassword
    mode = 'json'
} | ConvertTo-Json)

$adminToken = $loginRes.data.access_token
if (-not $adminToken) { throw "Không thể đăng nhập Directus Admin." }
$headers = @{ Authorization = "Bearer $adminToken" }

# 2. Get Roles
$rolesRes = Invoke-RestMethod -Method Get -Uri "$DirectusUrl/roles" -Headers $headers
$travelerRole = ($rolesRes.data | Where-Object name -eq 'Registered Traveler').id
$adminRole = ($rolesRes.data | Where-Object name -eq 'Administrator').id
$analystRole = ($rolesRes.data | Where-Object name -eq 'Risk Analyst').id
$opsRole = ($rolesRes.data | Where-Object name -eq 'Weather Operations').id

# 3. List of Test Accounts to Seed
$testAccounts = @(
    @{
        email = "free.traveler@vietforecast.vn"
        password = "Traveler@123456"
        role = $travelerRole
        first_name = "Khách"
        last_name = "Miễn Phí"
        title = "Tài khoản Gói Free (10 lượt tìm, 3 lượt lộ trình, 3 tin AI)"
    },
    @{
        email = "pro.traveler@vietforecast.vn"
        password = "ProTraveler@123456"
        role = $travelerRole
        first_name = "Khách"
        last_name = "Pro Gold"
        title = "Tài khoản Gói Pro (200 lượt tìm, 30 lộ trình, Radar & Heatmap mở)"
    },
    @{
        email = "vip.traveler@vietforecast.vn"
        password = "VipTraveler@123456"
        role = $travelerRole
        first_name = "Khách VIP"
        last_name = "Đã lưu tuyến"
        title = "Tài khoản VIP Pro (Có sẵn 5 địa điểm yêu thích & 2 lộ trình)"
    },
    @{
        email = "admin@vietforecast.vn"
        password = "Admin@123456"
        role = $adminRole
        first_name = "Quản Trị"
        last_name = "Hệ Thống"
        title = "Tài khoản Quản trị viên Directus Admin Studio"
    },
    @{
        email = "analyst@vietforecast.vn"
        password = "Analyst@123456"
        role = $analystRole
        first_name = "Chuyên Viên"
        last_name = "Phân Tích Rủi Ro"
        title = "Tài khoản Chuyên viên phân tích rủi ro khí tượng Directus"
    }
)

# 4. Get Existing Users
$existingUsers = (Invoke-RestMethod -Method Get -Uri "$DirectusUrl/users?limit=100" -Headers $headers).data

foreach ($acc in $testAccounts) {
    $existing = $existingUsers | Where-Object { $_.email -eq $acc.email }
    if ($existing) {
        Write-Host "Updating account: $($acc.email)..." -ForegroundColor Gray
        $updateBody = @{
            password = $acc.password
            role = $acc.role
            first_name = $acc.first_name
            last_name = $acc.last_name
            status = 'active'
        } | ConvertTo-Json
        Invoke-RestMethod -Method Patch -Uri "$DirectusUrl/users/$($existing.id)" -Headers $headers -ContentType 'application/json' -Body $updateBody | Out-Null
        Write-Host " -> Cập nhật thành công: $($acc.email)" -ForegroundColor Green
    } else {
        Write-Host "Creating account: $($acc.email)..." -ForegroundColor Yellow
        $createBody = @{
            email = $acc.email
            password = $acc.password
            role = $acc.role
            first_name = $acc.first_name
            last_name = $acc.last_name
            status = 'active'
        } | ConvertTo-Json
        $created = Invoke-RestMethod -Method Post -Uri "$DirectusUrl/users" -Headers $headers -ContentType 'application/json' -Body $createBody
        Write-Host " -> Tạo mới thành công: $($acc.email) (ID: $($created.data.id))" -ForegroundColor Green
    }
}

Write-Host "`n=== SEED DỮ LIỆU TÀI KHOẢN HOÀN TẤT ===" -ForegroundColor Cyan
