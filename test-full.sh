#!/bin/bash
# ============================================================
# FreshGuard — Comprehensive Strict E2E Test Suite
# Tests every API endpoint, DB operation, auth flow, edge case
# ============================================================
set -euo pipefail

BASE="https://fresh-guard-main.up.railway.app"
COOKIE_JAR_ADMIN="/tmp/fg_admin_cookies.txt"
COOKIE_JAR_USER="/tmp/fg_user_cookies.txt"
COOKIE_JAR_ANON="/tmp/fg_anon_cookies.txt"
PASS=0; FAIL=0; TOTAL=0

rm -f "$COOKIE_JAR_ADMIN" "$COOKIE_JAR_USER" "$COOKIE_JAR_ANON"

# ---------- helpers ----------
assert() {
  TOTAL=$((TOTAL+1))
  local label="$1"; local expected="$2"; local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ PASS [$TOTAL] $label"
    PASS=$((PASS+1))
  else
    echo "  ❌ FAIL [$TOTAL] $label  (expected=$expected  actual=$actual)"
    FAIL=$((FAIL+1))
  fi
}

assert_contains() {
  TOTAL=$((TOTAL+1))
  local label="$1"; local needle="$2"; local haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  ✅ PASS [$TOTAL] $label"
    PASS=$((PASS+1))
  else
    echo "  ❌ FAIL [$TOTAL] $label  (expected to contain '$needle')"
    FAIL=$((FAIL+1))
  fi
}

assert_not_contains() {
  TOTAL=$((TOTAL+1))
  local label="$1"; local needle="$2"; local haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  ❌ FAIL [$TOTAL] $label  (should NOT contain '$needle')"
    FAIL=$((FAIL+1))
  else
    echo "  ✅ PASS [$TOTAL] $label"
    PASS=$((PASS+1))
  fi
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

# ============================================================
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   FreshGuard Full Test Suite — $(date)   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo "Target: $BASE"
echo ""

# ============================================================
echo "═══ 1. HEALTH & STATIC SERVING ═══"
# ============================================================

CODE=$(http_code "$BASE/health")
assert "GET /health returns 200" "200" "$CODE"

BODY=$(curl -s "$BASE/health")
assert_contains "/health has status ok" '"status":"ok"' "$BODY"
assert_contains "/health has timestamp" '"timestamp"' "$BODY"

CODE=$(http_code "$BASE")
assert "GET / serves SPA HTML (200)" "200" "$CODE"

HTML=$(curl -s "$BASE")
assert_contains "SPA contains root div" 'id="root"' "$HTML"
assert_contains "SPA contains script tag" '<script' "$HTML"

CODE=$(http_code "$BASE/nonexistent-page")
assert "GET /nonexistent-page returns 200 (SPA catch-all)" "200" "$CODE"

echo ""

# ============================================================
echo "═══ 2. AUTH: UNAUTHENTICATED ACCESS ═══"
# ============================================================

CODE=$(http_code "$BASE/api/auth/me")
assert "GET /api/auth/me unauthenticated => 401" "401" "$CODE"

CODE=$(http_code -c "$COOKIE_JAR_ANON" -b "$COOKIE_JAR_ANON" "$BASE/api/purchases")
assert "GET /api/purchases unauthenticated => 401" "401" "$CODE"

CODE=$(http_code -X POST -H "Content-Type: application/json" -d '{"productIds":[1]}' "$BASE/api/purchases")
assert "POST /api/purchases unauthenticated => 401" "401" "$CODE"

echo ""

# ============================================================
echo "═══ 3. AUTH: ADMIN LOGIN ═══"
# ============================================================

# Wrong credentials
CODE=$(http_code -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin@gmail.com","password":"wrong","role":"admin"}' \
  "$BASE/api/auth/login")
assert "Admin login wrong password => 401" "401" "$CODE"

CODE=$(http_code -X POST -H "Content-Type: application/json" \
  -d '{"username":"wrong@gmail.com","password":"admin","role":"admin"}' \
  "$BASE/api/auth/login")
assert "Admin login wrong username => 401" "401" "$CODE"

# Correct credentials
RESP=$(curl -s -c "$COOKIE_JAR_ADMIN" -b "$COOKIE_JAR_ADMIN" \
  -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin@gmail.com","password":"admin","role":"admin"}' \
  "$BASE/api/auth/login")
assert_contains "Admin login returns role=admin" '"role":"admin"' "$RESP"
assert_contains "Admin login returns username" '"admin@gmail.com"' "$RESP"

# Verify session persists
ME=$(curl -s -b "$COOKIE_JAR_ADMIN" "$BASE/api/auth/me")
assert_contains "GET /api/auth/me after admin login" '"role":"admin"' "$ME"

echo ""

# ============================================================
echo "═══ 4. AUTH: USER LOGIN ═══"
# ============================================================

# Missing customId
CODE=$(http_code -X POST -H "Content-Type: application/json" \
  -d '{"role":"user"}' "$BASE/api/auth/login")
assert "User login without customId => 400" "400" "$CODE"

# Valid user login
RESP=$(curl -s -c "$COOKIE_JAR_USER" -b "$COOKIE_JAR_USER" \
  -X POST -H "Content-Type: application/json" \
  -d '{"customId":"testuser_e2e_001","role":"user"}' \
  "$BASE/api/auth/login")
assert_contains "User login returns role=user" '"role":"user"' "$RESP"
assert_contains "User login returns customId" '"testuser_e2e_001"' "$RESP"
USER_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "UNKNOWN")

# Auto-create: login again with same ID
RESP2=$(curl -s -c "$COOKIE_JAR_USER" -b "$COOKIE_JAR_USER" \
  -X POST -H "Content-Type: application/json" \
  -d '{"customId":"testuser_e2e_001","role":"user"}' \
  "$BASE/api/auth/login")
USER_ID2=$(echo "$RESP2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "UNKNOWN2")
assert "Re-login returns same user ID (idempotent)" "$USER_ID" "$USER_ID2"

ME=$(curl -s -b "$COOKIE_JAR_USER" "$BASE/api/auth/me")
assert_contains "GET /api/auth/me after user login" '"role":"user"' "$ME"

echo ""

# ============================================================
echo "═══ 5. PRODUCTS: LIST (public) ═══"
# ============================================================

PRODUCTS=$(curl -s "$BASE/api/products")
assert_contains "GET /api/products returns array" '[' "$PRODUCTS"

PROD_COUNT=$(echo "$PRODUCTS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
TOTAL=$((TOTAL+1))
if [ "$PROD_COUNT" -ge 1 ]; then
  echo "  ✅ PASS [$TOTAL] Products list has >= 1 items (found $PROD_COUNT)"
  PASS=$((PASS+1))
else
  echo "  ❌ FAIL [$TOTAL] Products list empty"
  FAIL=$((FAIL+1))
fi

# Check seed products exist
assert_contains "Seed product: Fresh Milk exists" 'Fresh Milk' "$PRODUCTS"
assert_contains "Seed product: Organic Bread exists" 'Organic Bread' "$PRODUCTS"
assert_contains "Seed product: Expired Yogurt exists" 'Expired Yogurt' "$PRODUCTS"

# Check product fields
FIRST_PROD=$(echo "$PRODUCTS" | python3 -c "import sys,json; p=json.load(sys.stdin)[0]; [print(k) for k in p.keys()]" 2>/dev/null || echo "")
assert_contains "Product has 'id' field" 'id' "$FIRST_PROD"
assert_contains "Product has 'name' field" 'name' "$FIRST_PROD"
assert_contains "Product has 'price' field" 'price' "$FIRST_PROD"
assert_contains "Product has 'manufacturingDate'" 'manufacturingDate' "$FIRST_PROD"
assert_contains "Product has 'expiryDate'" 'expiryDate' "$FIRST_PROD"
assert_contains "Product has 'nutritionalInfo'" 'nutritionalInfo' "$FIRST_PROD"
assert_contains "Product has 'ingredients'" 'ingredients' "$FIRST_PROD"
assert_contains "Product has 'qrCodeId'" 'qrCodeId' "$FIRST_PROD"

echo ""

# ============================================================
echo "═══ 6. PRODUCTS: GET BY ID ═══"
# ============================================================

FIRST_ID=$(echo "$PRODUCTS" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null || echo "1")
CODE=$(http_code "$BASE/api/products/$FIRST_ID")
assert "GET /api/products/:id valid => 200" "200" "$CODE"

CODE=$(http_code "$BASE/api/products/999999")
assert "GET /api/products/:id invalid => 404" "404" "$CODE"

echo ""

# ============================================================
echo "═══ 7. PRODUCTS: GET BY QR CODE ═══"
# ============================================================

CODE=$(http_code "$BASE/api/products/qr/prod_milk_001")
assert "GET /api/products/qr/prod_milk_001 => 200" "200" "$CODE"

MILK=$(curl -s "$BASE/api/products/qr/prod_milk_001")
assert_contains "QR lookup returns Fresh Milk" 'Fresh Milk' "$MILK"

CODE=$(http_code "$BASE/api/products/qr/prod_bread_002")
assert "GET /api/products/qr/prod_bread_002 => 200" "200" "$CODE"

CODE=$(http_code "$BASE/api/products/qr/prod_yogurt_003")
assert "GET /api/products/qr/prod_yogurt_003 => 200" "200" "$CODE"

CODE=$(http_code "$BASE/api/products/qr/nonexistent_qr_xyz")
assert "GET /api/products/qr/nonexistent => 404" "404" "$CODE"

echo ""

# ============================================================
echo "═══ 8. PRODUCTS: ADMIN CRUD ═══"
# ============================================================

# User cannot create product
CODE=$(http_code -b "$COOKIE_JAR_USER" -X POST -H "Content-Type: application/json" \
  -d '{"name":"Hack","price":100,"manufacturingDate":"2024-01-01","expiryDate":"2025-01-01","nutritionalInfo":"x","ingredients":["a"],"qrCodeId":"hack_001"}' \
  "$BASE/api/products")
assert "POST /api/products as user => 403" "403" "$CODE"

# Unauthenticated cannot create
CODE=$(http_code -X POST -H "Content-Type: application/json" \
  -d '{"name":"Hack","price":100,"manufacturingDate":"2024-01-01","expiryDate":"2025-01-01","nutritionalInfo":"x","ingredients":["a"],"qrCodeId":"hack_002"}' \
  "$BASE/api/products")
assert "POST /api/products unauthenticated => 401" "401" "$CODE"

# Admin creates product
QR_ID="test_prod_$(date +%s)"
CREATE_RESP=$(curl -s -b "$COOKIE_JAR_ADMIN" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Apple Juice\",\"price\":350,\"manufacturingDate\":\"2024-06-01\",\"expiryDate\":\"2027-12-31\",\"nutritionalInfo\":{\"calories\":120},\"ingredients\":[\"Apple\",\"Water\",\"Sugar\"],\"qrCodeId\":\"$QR_ID\"}" \
  "$BASE/api/products")

CODE=$(echo "$CREATE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','MISSING'))" 2>/dev/null || echo "ERROR")
TOTAL=$((TOTAL+1))
if [ "$CODE" != "MISSING" ] && [ "$CODE" != "ERROR" ]; then
  echo "  ✅ PASS [$TOTAL] Admin created product (id=$CODE)"
  PASS=$((PASS+1))
  NEW_PROD_ID="$CODE"
else
  echo "  ❌ FAIL [$TOTAL] Admin create product failed: $CREATE_RESP"
  FAIL=$((FAIL+1))
  NEW_PROD_ID=""
fi

assert_contains "Created product has correct name" 'Test Apple Juice' "$CREATE_RESP"
assert_contains "Created product has correct price" '350' "$CREATE_RESP"
assert_contains "Created product has ingredients" 'Apple' "$CREATE_RESP"

# Verify via QR lookup
CODE=$(http_code "$BASE/api/products/qr/$QR_ID")
assert "New product findable by QR => 200" "200" "$CODE"

# Admin updates product
if [ -n "$NEW_PROD_ID" ]; then
  UP_RESP=$(curl -s -b "$COOKIE_JAR_ADMIN" \
    -X PUT -H "Content-Type: application/json" \
    -d '{"name":"Test Apple Juice UPDATED","price":400}' \
    "$BASE/api/products/$NEW_PROD_ID")
  assert_contains "Updated product name" 'UPDATED' "$UP_RESP"
  assert_contains "Updated product price" '400' "$UP_RESP"
fi

# User cannot delete
if [ -n "$NEW_PROD_ID" ]; then
  CODE=$(http_code -b "$COOKIE_JAR_USER" -X DELETE "$BASE/api/products/$NEW_PROD_ID")
  assert "DELETE /api/products as user => 403" "403" "$CODE"
fi

# Admin deletes product
if [ -n "$NEW_PROD_ID" ]; then
  CODE=$(http_code -b "$COOKIE_JAR_ADMIN" -X DELETE "$BASE/api/products/$NEW_PROD_ID")
  assert "DELETE /api/products as admin => 204" "204" "$CODE"

  CODE=$(http_code "$BASE/api/products/$NEW_PROD_ID")
  assert "Deleted product is gone => 404" "404" "$CODE"
fi

echo ""

# ============================================================
echo "═══ 9. PRODUCTS: VALIDATION ═══"
# ============================================================

# Missing name
CODE=$(http_code -b "$COOKIE_JAR_ADMIN" -X POST -H "Content-Type: application/json" \
  -d '{"price":100,"manufacturingDate":"2024-01-01","expiryDate":"2025-01-01","nutritionalInfo":"x","ingredients":["a"],"qrCodeId":"val_001"}' \
  "$BASE/api/products")
assert "Create product missing name => 400" "400" "$CODE"

# Invalid date format
CODE=$(http_code -b "$COOKIE_JAR_ADMIN" -X POST -H "Content-Type: application/json" \
  -d '{"name":"Bad","price":100,"manufacturingDate":"not-a-date","expiryDate":"2025-01-01","nutritionalInfo":"x","ingredients":["a"],"qrCodeId":"val_002"}' \
  "$BASE/api/products")
assert "Create product invalid date => 400" "400" "$CODE"

# Duplicate QR code
CODE=$(http_code -b "$COOKIE_JAR_ADMIN" -X POST -H "Content-Type: application/json" \
  -d '{"name":"Dup","price":100,"manufacturingDate":"2024-01-01","expiryDate":"2025-01-01","nutritionalInfo":"x","ingredients":["a"],"qrCodeId":"prod_milk_001"}' \
  "$BASE/api/products")
assert "Create product duplicate QR => 409 (conflict)" "409" "$CODE"

echo ""

# ============================================================
echo "═══ 10. PURCHASES: FULL FLOW ═══"
# ============================================================

# Get initial purchase count
PURCH_BEFORE=$(curl -s -b "$COOKIE_JAR_USER" "$BASE/api/purchases")
COUNT_BEFORE=$(echo "$PURCH_BEFORE" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

# Get product IDs for checkout
MILK_ID=$(echo "$PRODUCTS" | python3 -c "import sys,json; ps=json.load(sys.stdin); print([p['id'] for p in ps if 'Milk' in p['name']][0])" 2>/dev/null || echo "1")
BREAD_ID=$(echo "$PRODUCTS" | python3 -c "import sys,json; ps=json.load(sys.stdin); print([p['id'] for p in ps if 'Bread' in p['name']][0])" 2>/dev/null || echo "2")

# Create purchases (checkout)
CHECKOUT_RESP=$(curl -s -b "$COOKIE_JAR_USER" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"productIds\":[$MILK_ID,$BREAD_ID]}" \
  "$BASE/api/purchases")
assert_contains "Checkout response has message" 'Purchases recorded' "$CHECKOUT_RESP"

# Verify purchases increased
PURCH_AFTER=$(curl -s -b "$COOKIE_JAR_USER" "$BASE/api/purchases")
COUNT_AFTER=$(echo "$PURCH_AFTER" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
EXPECTED=$((COUNT_BEFORE + 2))
assert "Purchase count increased by 2" "$EXPECTED" "$COUNT_AFTER"

# Check purchase response shape
PURCH_KEYS=$(echo "$PURCH_AFTER" | python3 -c "import sys,json; p=json.load(sys.stdin)[0]; print(' '.join(sorted(p.keys())))" 2>/dev/null || echo "")
assert_contains "Purchase has 'product' key" 'product' "$PURCH_KEYS"
assert_contains "Purchase has 'purchase' key" 'purchase' "$PURCH_KEYS"

# Check product inside purchase
PURCH_PROD=$(echo "$PURCH_AFTER" | python3 -c "import sys,json; p=json.load(sys.stdin)[0]['product']; print(' '.join(sorted(p.keys())))" 2>/dev/null || echo "")
assert_contains "Purchase.product has 'name'" 'name' "$PURCH_PROD"
assert_contains "Purchase.product has 'price'" 'price' "$PURCH_PROD"
assert_contains "Purchase.product has 'expiryDate'" 'expiryDate' "$PURCH_PROD"

# Check purchase metadata
PURCH_META=$(echo "$PURCH_AFTER" | python3 -c "import sys,json; p=json.load(sys.stdin)[0]['purchase']; print(' '.join(sorted(p.keys())))" 2>/dev/null || echo "")
assert_contains "Purchase.purchase has 'purchasedAt'" 'purchasedAt' "$PURCH_META"
assert_contains "Purchase.purchase has 'userId'" 'userId' "$PURCH_META"
assert_contains "Purchase.purchase has 'productId'" 'productId' "$PURCH_META"

echo ""

# ============================================================
echo "═══ 11. PURCHASES: EMPTY CART ═══"
# ============================================================

CODE=$(http_code -b "$COOKIE_JAR_USER" -X POST -H "Content-Type: application/json" \
  -d '{"productIds":[]}' "$BASE/api/purchases")
assert "Checkout empty cart => 201 (no-op)" "201" "$CODE"

echo ""

# ============================================================
echo "═══ 12. AUTH: LOGOUT ═══"
# ============================================================

CODE=$(http_code -b "$COOKIE_JAR_USER" -X POST "$BASE/api/auth/logout")
assert "POST /api/auth/logout => 200" "200" "$CODE"

CODE=$(http_code -b "$COOKIE_JAR_USER" "$BASE/api/auth/me")
assert "GET /api/auth/me after logout => 401" "401" "$CODE"

CODE=$(http_code -b "$COOKIE_JAR_USER" "$BASE/api/purchases")
assert "GET /api/purchases after logout => 401" "401" "$CODE"

echo ""

# ============================================================
echo "═══ 13. AUTH: ADMIN LOGOUT ═══"
# ============================================================

CODE=$(http_code -b "$COOKIE_JAR_ADMIN" -X POST "$BASE/api/auth/logout")
assert "Admin logout => 200" "200" "$CODE"

CODE=$(http_code -b "$COOKIE_JAR_ADMIN" "$BASE/api/auth/me")
assert "Admin /me after logout => 401" "401" "$CODE"

# Admin-only action after logout
CODE=$(http_code -b "$COOKIE_JAR_ADMIN" -X POST -H "Content-Type: application/json" \
  -d '{"name":"X","price":1,"manufacturingDate":"2024-01-01","expiryDate":"2025-01-01","nutritionalInfo":"x","ingredients":["a"],"qrCodeId":"post_logout"}' \
  "$BASE/api/products")
assert "Admin create after logout => 401" "401" "$CODE"

echo ""

# ============================================================
echo "═══ 14. EDGE CASES & ROBUSTNESS ═══"
# ============================================================

# Malformed JSON
CODE=$(http_code -X POST -H "Content-Type: application/json" -d 'not json' "$BASE/api/auth/login")
assert "Malformed JSON to login => 400" "400" "$CODE"

# Wrong content type
CODE=$(http_code -X POST -H "Content-Type: text/plain" -d 'hello' "$BASE/api/auth/login")
assert "Wrong content-type => 400" "400" "$CODE"

# Large payload
LARGE=$(python3 -c "print('{\"customId\":\"' + 'a'*10000 + '\",\"role\":\"user\"}')")
CODE=$(http_code -X POST -H "Content-Type: application/json" -d "$LARGE" "$BASE/api/auth/login")
TOTAL=$((TOTAL+1))
if [ "$CODE" = "200" ] || [ "$CODE" = "400" ] || [ "$CODE" = "413" ]; then
  echo "  ✅ PASS [$TOTAL] Large payload handled gracefully ($CODE)"
  PASS=$((PASS+1))
else
  echo "  ❌ FAIL [$TOTAL] Large payload unexpected code: $CODE"
  FAIL=$((FAIL+1))
fi

# OPTIONS preflight
CODE=$(http_code -X OPTIONS "$BASE/api/auth/login")
TOTAL=$((TOTAL+1))
if [ "$CODE" = "200" ] || [ "$CODE" = "204" ]; then
  echo "  ✅ PASS [$TOTAL] OPTIONS preflight handled ($CODE)"
  PASS=$((PASS+1))
else
  echo "  ❌ FAIL [$TOTAL] OPTIONS preflight unexpected: $CODE"
  FAIL=$((FAIL+1))
fi

echo ""

# ============================================================
echo "═══ 15. RESPONSE TIME CHECKS ═══"
# ============================================================

for ENDPOINT in "/health" "/api/products" "/api/products/qr/prod_milk_001"; do
  TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE$ENDPOINT")
  MS=$(echo "$TIME" | python3 -c "import sys; print(int(float(sys.stdin.read().strip())*1000))")
  TOTAL=$((TOTAL+1))
  if [ "$MS" -lt 5000 ]; then
    echo "  ✅ PASS [$TOTAL] $ENDPOINT responded in ${MS}ms (< 5s)"
    PASS=$((PASS+1))
  else
    echo "  ❌ FAIL [$TOTAL] $ENDPOINT too slow: ${MS}ms"
    FAIL=$((FAIL+1))
  fi
done

echo ""

# ============================================================
echo "═══ 16. CONCURRENT REQUESTS STRESS TEST ═══"
# ============================================================

echo "  Firing 20 concurrent requests to /api/products..."
FAIL_COUNT=0
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}" "$BASE/api/products" &
done > /tmp/fg_stress_results.txt 2>&1
wait

# Re-check after stress
CODE=$(http_code "$BASE/api/products")
assert "Server stable after concurrent requests" "200" "$CODE"

echo ""

# ============================================================
# SUMMARY
# ============================================================
echo "╔══════════════════════════════════════════════════════╗"
echo "║                  TEST RESULTS                       ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  Total: %-4d  Passed: %-4d  Failed: %-4d           ║\n" "$TOTAL" "$PASS" "$FAIL"
echo "╠══════════════════════════════════════════════════════╣"
if [ "$FAIL" -eq 0 ]; then
  echo "║  🎉  ALL TESTS PASSED!                              ║"
else
  echo "║  ⚠️   SOME TESTS FAILED — review output above       ║"
fi
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# cleanup
rm -f "$COOKIE_JAR_ADMIN" "$COOKIE_JAR_USER" "$COOKIE_JAR_ANON"
exit $FAIL
