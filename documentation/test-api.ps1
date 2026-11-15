# Smart Inventory API - full test script
# Run (server must be running in another window):
#   powershell -ExecutionPolicy Bypass -File .\test-api.ps1

$base = "http://127.0.0.1:5000/api"
$adminEmail = "admin@test.com"
$adminPassword = "password123"
$tag = Get-Random -Maximum 99999

$script:pass = 0
$script:fail = 0

function Call($Method, $Path, $Token, $Body) {
    $h = @{}
    if ($Token) { $h["Authorization"] = "Bearer $Token" }
    $p = @{ Method = $Method; Uri = "$base$Path"; Headers = $h; UseBasicParsing = $true }
    if ($Body) {
        $p.ContentType = "application/json"
        $p.Body = ($Body | ConvertTo-Json -Depth 6)
    }
    try {
        $resp = Invoke-WebRequest @p
        return @{ Status = [int]$resp.StatusCode; Data = ($resp.Content | ConvertFrom-Json) }
    }
    catch {
        $r = $_.Exception.Response
        $status = 0
        $data = $null
        if ($r) {
            $status = [int]$r.StatusCode
            $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
            $txt = $sr.ReadToEnd()
            try { $data = $txt | ConvertFrom-Json } catch { }
        }
        return @{ Status = $status; Data = $data }
    }
}

function Check($Name, $Condition) {
    if ($Condition) { Write-Host "  PASS  $Name" -ForegroundColor Green; $script:pass++ }
    else { Write-Host "  FAIL  $Name" -ForegroundColor Red; $script:fail++ }
}

function Section($Title) { Write-Host ""; Write-Host "== $Title" -ForegroundColor Cyan }

# ------------------------------------------------------------------ health
Section "Health"
$r = Call "GET" "/health" $null $null
Check "GET /health returns 200" ($r.Status -eq 200)
if ($r.Status -ne 200) { Write-Host "Server is not running. Start it with: node server.js" -ForegroundColor Yellow; return }

# ------------------------------------------------------------------ auth
Section "Auth"
$r = Call "POST" "/auth/register" $null @{ name = "Admin"; email = $adminEmail; password = $adminPassword }
if ($r.Status -ne 201) {
    $r = Call "POST" "/auth/login" $null @{ email = $adminEmail; password = $adminPassword }
}
Check "Admin can register or login" ($r.Status -in 200, 201 -and $r.Data.user.role -eq "admin")
$adminToken = $r.Data.token
if (-not $adminToken) { Write-Host "Cannot get admin token. Is $adminEmail registered with a different password?" -ForegroundColor Yellow; return }

$r = Call "POST" "/auth/register" $null @{ name = "Evil"; email = "evil$tag@test.com"; password = "password123"; role = "admin" }
Check "Public register ignores role=admin (becomes staff)" ($r.Status -eq 201 -and $r.Data.user.role -eq "staff")

$r = Call "POST" "/auth/login" $null @{ email = $adminEmail; password = "wrong-password" }
Check "Wrong password returns 401" ($r.Status -eq 401)

$r = Call "POST" "/auth/register" $null @{ name = "Short"; email = "short$tag@test.com"; password = "123" }
Check "Short password rejected (400)" ($r.Status -eq 400)

$r = Call "GET" "/auth/me" $adminToken $null
Check "GET /auth/me works" ($r.Status -eq 200 -and $r.Data.data.email -eq $adminEmail)

$r = Call "POST" "/auth/users" $adminToken @{ name = "Manager"; email = "manager$tag@test.com"; password = "password123"; role = "manager" }
Check "Admin creates manager" ($r.Status -eq 201 -and $r.Data.data.role -eq "manager")
$r = Call "POST" "/auth/users" $adminToken @{ name = "Staff"; email = "staff$tag@test.com"; password = "password123"; role = "staff" }
Check "Admin creates staff" ($r.Status -eq 201 -and $r.Data.data.role -eq "staff")
$staffId = $r.Data.data._id

$r = Call "POST" "/auth/login" $null @{ email = "manager$tag@test.com"; password = "password123" }
$mgrToken = $r.Data.token
$r = Call "POST" "/auth/login" $null @{ email = "staff$tag@test.com"; password = "password123" }
$staffToken = $r.Data.token
Check "Manager and staff can login" ($mgrToken -and $staffToken)

$r = Call "GET" "/auth/users" $mgrToken $null
Check "Manager cannot list users (403)" ($r.Status -eq 403)

# ------------------------------------------------------------------ access control
Section "Access control"
$r = Call "GET" "/products" $null $null
Check "No token -> 401 on /products" ($r.Status -eq 401)
$r = Call "GET" "/reports/sales" $null $null
Check "No token -> 401 on /reports/sales" ($r.Status -eq 401)
$r = Call "GET" "/products" "not.a.real.token" $null
Check "Garbage token -> 401" ($r.Status -eq 401)

# ------------------------------------------------------------------ products
Section "Products and categories"
$r = Call "POST" "/products/categories" $mgrToken @{ name = "Test Category $tag" }
Check "Manager creates category" ($r.Status -eq 201)
$catId = $r.Data.data._id

$r = Call "POST" "/products" $staffToken @{ name = "Nope"; price = 10 }
Check "Staff cannot create product (403)" ($r.Status -eq 403)

$r = Call "POST" "/products" $mgrToken @{ name = "Test Widget $tag"; price = 100; costPrice = 60; quantity = 20; minStock = 5; category = $catId }
Check "Manager creates product" ($r.Status -eq 201 -and $r.Data.data.quantity -eq 20)
Check "SKU auto-generated" ($r.Data.data.sku -like "SKU-*")
$prodId = $r.Data.data._id

$r = Call "POST" "/products" $mgrToken @{ name = "Zero Stock $tag"; price = 5; quantity = 0; minStock = 0 }
Check "Product with quantity 0 and minStock 0 is allowed" ($r.Status -eq 201)

$r = Call "POST" "/products" $mgrToken @{ name = "Bad price" }
Check "Missing price rejected (400)" ($r.Status -eq 400)

$r = Call "GET" "/products?search=Widget%20$tag" $mgrToken $null
Check "Search finds the product" ($r.Status -eq 200 -and $r.Data.pagination.total -ge 1)
Check "Manager sees costPrice" ($r.Data.data[0].costPrice -eq 60)

$r = Call "GET" "/products/$prodId" $staffToken $null
Check "Staff can read product" ($r.Status -eq 200)
Check "Staff does NOT see costPrice" ($r.Data.data.PSObject.Properties.Name -notcontains "costPrice")

$r = Call "PUT" "/products/$prodId" $mgrToken @{ quantity = 9999 }
Check "Editing quantity via PUT is blocked (400)" ($r.Status -eq 400)

$r = Call "PUT" "/products/$prodId" $mgrToken @{ price = 120 }
Check "Manager updates price" ($r.Status -eq 200 -and $r.Data.data.price -eq 120)
$r = Call "PUT" "/products/$prodId" $mgrToken @{ price = 100 }

# ------------------------------------------------------------------ inventory
Section "Inventory"
$r = Call "POST" "/inventory/in" $staffToken @{ productId = $prodId; quantity = 10; reason = "Delivery" }
Check "Staff stock-in +10 -> 30" ($r.Status -eq 200 -and $r.Data.data.product.quantity -eq 30)

$r = Call "POST" "/inventory/in" $staffToken @{ productId = $prodId; quantity = -5 }
Check "Negative quantity rejected (400)" ($r.Status -eq 400)
$r = Call "POST" "/inventory/in" $staffToken @{ productId = $prodId; quantity = "abc" }
Check "Non-numeric quantity rejected (400)" ($r.Status -eq 400)
$r = Call "POST" "/inventory/in" $staffToken @{ productId = $prodId; quantity = 1.5 }
Check "Fractional quantity rejected (400)" ($r.Status -eq 400)

$r = Call "POST" "/inventory/out" $staffToken @{ productId = $prodId; quantity = 1 }
Check "Staff cannot stock-out (403)" ($r.Status -eq 403)

$r = Call "POST" "/inventory/out" $mgrToken @{ productId = $prodId; quantity = 1000 }
Check "Cannot remove more than available (400)" ($r.Status -eq 400)

$r = Call "POST" "/inventory/out" $mgrToken @{ productId = $prodId; quantity = 10; reason = "Damaged" }
Check "Manager stock-out -10 -> 20" ($r.Status -eq 200 -and $r.Data.data.product.quantity -eq 20)

$r = Call "POST" "/inventory/adjust" $mgrToken @{ productId = $prodId; newQuantity = 18 }
Check "Adjust without reason rejected (400)" ($r.Status -eq 400)
$r = Call "POST" "/inventory/adjust" $mgrToken @{ productId = $prodId; newQuantity = 18; reason = "Stock take" }
Check "Adjust to 18" ($r.Status -eq 200 -and $r.Data.data.product.quantity -eq 18)

$r = Call "GET" "/inventory/history?product=$prodId" $mgrToken $null
Check "History has IN, OUT, ADJUSTMENT entries (>= 4)" ($r.Status -eq 200 -and $r.Data.pagination.total -ge 4)
Check "History records who did it" ($r.Data.data[0].performedBy.name)

# ------------------------------------------------------------------ customers
Section "Customers"
$r = Call "POST" "/customers" $staffToken @{ name = "Test Customer $tag"; phone = "9999999999"; email = "cust$tag@test.com" }
Check "Staff creates customer" ($r.Status -eq 201)
$custId = $r.Data.data._id
$r = Call "POST" "/customers" $staffToken @{ name = "Dup"; email = "cust$tag@test.com" }
Check "Duplicate customer email rejected (409)" ($r.Status -eq 409)
$r = Call "GET" "/customers?search=Test%20Customer%20$tag" $staffToken $null
Check "Customer search works" ($r.Status -eq 200 -and $r.Data.pagination.total -ge 1)

# ------------------------------------------------------------------ orders
Section "Orders"
$r = Call "POST" "/orders" $staffToken @{ customer = $custId; items = @(@{ productId = $prodId; quantity = 4 }); taxRate = 10; discount = 20 }
Check "Staff creates order (201)" ($r.Status -eq 201)
# subtotal 400 - discount 20 = 380, tax 10% = 38, total 418
Check "Total is calculated by server (418)" ($r.Data.data.total -eq 418)
$orderId = $r.Data.data._id

$r = Call "GET" "/products/$prodId" $mgrToken $null
Check "Stock reduced 18 -> 14" ($r.Data.data.quantity -eq 14)

$r = Call "POST" "/orders" $staffToken @{ items = @(@{ productId = $prodId; quantity = 999 }) }
Check "Overselling blocked (400)" ($r.Status -eq 400)
$r = Call "GET" "/products/$prodId" $mgrToken $null
Check "Stock unchanged after failed order (14)" ($r.Data.data.quantity -eq 14)

$r = Call "POST" "/orders" $staffToken @{ items = @() }
Check "Empty order rejected (400)" ($r.Status -eq 400)

$r = Call "GET" "/orders/$orderId" $staffToken $null
Check "Staff can read own order" ($r.Status -eq 200)
$r = Call "GET" "/orders/$orderId/invoice" $staffToken $null
Check "Invoice generated" ($r.Status -eq 200 -and $r.Data.data.invoiceNumber -like "INV-*")

$r = Call "GET" "/customers/$custId" $staffToken $null
Check "Customer stats show 1 order, 418 spent" ($r.Data.data.stats.totalOrders -eq 1 -and $r.Data.data.stats.totalSpent -eq 418)

$r = Call "PATCH" "/orders/$orderId/cancel" $staffToken $null
Check "Staff cannot cancel order (403)" ($r.Status -eq 403)
$r = Call "PATCH" "/orders/$orderId/cancel" $mgrToken $null
Check "Manager cancels order (200)" ($r.Status -eq 200)
$r = Call "GET" "/products/$prodId" $mgrToken $null
Check "Stock restored 14 -> 18" ($r.Data.data.quantity -eq 18)
$r = Call "PATCH" "/orders/$orderId/cancel" $mgrToken $null
Check "Cancelling twice is rejected (400)" ($r.Status -eq 400)

$r = Call "DELETE" "/customers/$custId" $mgrToken $null
Check "Customer with orders cannot be deleted (409)" ($r.Status -eq 409)

# ------------------------------------------------------------------ low stock, dashboard, reports
Section "Low stock, dashboard, reports"
$null = Call "POST" "/inventory/adjust" $mgrToken @{ productId = $prodId; newQuantity = 3; reason = "Test low stock" }
$r = Call "GET" "/inventory/low-stock" $mgrToken $null
$found = @($r.Data.data | Where-Object { $_._id -eq $prodId }).Count
Check "Product appears in low-stock list" ($r.Status -eq 200 -and $found -eq 1)

$r = Call "GET" "/dashboard" $adminToken $null
Check "Admin dashboard works" ($r.Status -eq 200 -and $r.Data.data.totals.products -ge 1)
Check "Dashboard has 7 days of sales data" ($r.Data.data.salesLast7Days.Count -eq 7)
Check "Admin sees inventory value" ($null -ne $r.Data.data.totals.inventoryCostValue)
$r = Call "GET" "/dashboard" $staffToken $null
Check "Staff dashboard hides inventory value" ($r.Status -eq 200 -and $r.Data.data.totals.PSObject.Properties.Name -notcontains "inventoryCostValue")

foreach ($rep in "inventory", "sales", "top-products", "stock-movement", "customers") {
    $r = Call "GET" "/reports/$rep" $mgrToken $null
    Check "Manager can open /reports/$rep" ($r.Status -eq 200)
}
$r = Call "GET" "/reports/sales" $staffToken $null
Check "Staff cannot open reports (403)" ($r.Status -eq 403)
$r = Call "GET" "/reports/sales?from=not-a-date" $mgrToken $null
Check "Invalid date rejected (400)" ($r.Status -eq 400)

# ------------------------------------------------------------------ user management
Section "User management"
$r = Call "PUT" "/auth/users/$staffId" $adminToken @{ isActive = $false }
Check "Admin deactivates staff user" ($r.Status -eq 200 -and $r.Data.data.isActive -eq $false)
$r = Call "GET" "/products" $staffToken $null
Check "Deactivated user's token stops working immediately (401)" ($r.Status -eq 401)

$me = Call "GET" "/auth/me" $adminToken $null
$r = Call "PUT" "/auth/users/$($me.Data.data._id)" $adminToken @{ role = "staff" }
Check "Admin cannot demote self (400)" ($r.Status -eq 400)

$r = Call "DELETE" "/products/$prodId" $mgrToken $null
Check "Manager cannot delete product (403)" ($r.Status -eq 403)
$r = Call "DELETE" "/products/$prodId" $adminToken $null
Check "Admin deactivates product" ($r.Status -eq 200)

# ------------------------------------------------------------------ summary
Write-Host ""
$total = $script:pass + $script:fail
$color = "Green"
if ($script:fail -gt 0) { $color = "Red" }
Write-Host "RESULT: $($script:pass) / $total checks passed" -ForegroundColor $color
if ($script:fail -gt 0) { Write-Host "Check the server window for error details on the FAIL lines." -ForegroundColor Yellow }
