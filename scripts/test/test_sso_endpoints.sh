#!/data/data/com.termux/files/usr/bin/bash
set -e

BASE_URL="${BASE_URL:-https://sso.orlandmanagement.com}"
COOKIE_JAR="${COOKIE_JAR:-./tmp_sso_cookie.txt}"
TEST_EMAIL="${TEST_EMAIL:-}"
TEST_PHONE="${TEST_PHONE:-}"
OTP_CODE="${OTP_CODE:-}"
CHALLENGE_ID="${CHALLENGE_ID:-}"

echo "========================================"
echo "SSO Endpoint Test"
echo "BASE_URL=$BASE_URL"
echo "COOKIE_JAR=$COOKIE_JAR"
echo "========================================"

need_cmd(){
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing command: $1"
    exit 1
  }
}

need_cmd curl
need_cmd sed
need_cmd grep

rm -f "$COOKIE_JAR"

pretty(){
  echo "$1" | sed 's/\\n/\n/g'
}

call_post(){
  local path="$1"
  local json="$2"

  echo ""
  echo "POST $path"
  echo "Payload: $json"
  curl -sS -X POST \
    -H "content-type: application/json" \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR" \
    "$BASE_URL$path" \
    --data "$json"
}

call_get(){
  local path="$1"

  echo ""
  echo "GET $path"
  curl -sS \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR" \
    "$BASE_URL$path"
}

extract_json_value(){
  local input="$1"
  local key="$2"
  echo "$input" | sed -n "s/.*\"$key\":\"\([^\"]*\)\".*/\1/p" | head -n 1
}

extract_json_number(){
  local input="$1"
  local key="$2"
  echo "$input" | sed -n "s/.*\"$key\":\([0-9][0-9]*\).*/\1/p" | head -n 1
}

STEP_1_REQUEST_LOGIN(){
  echo ""
  echo "========== STEP 1: request_login_challenge =========="

  local payload=""
  if [ -n "$TEST_EMAIL" ]; then
    payload="{\"email\":\"$TEST_EMAIL\"}"
  elif [ -n "$TEST_PHONE" ]; then
    payload="{\"phone\":\"$TEST_PHONE\"}"
  else
    echo "Set TEST_EMAIL or TEST_PHONE first."
    echo "Example:"
    echo "  TEST_EMAIL=admin@example.com bash scripts/test/test_sso_endpoints.sh"
    exit 1
  fi

  local res
  res="$(call_post "/functions/api/sso/request_login_challenge" "$payload")"
  pretty "$res"

  local status
  status="$(extract_json_value "$res" "status")"
  if [ "$status" != "ok" ]; then
    echo ""
    echo "STEP 1 FAILED"
    exit 1
  fi

  local got_challenge
  got_challenge="$(extract_json_value "$res" "challenge_id")"

  local otp_debug
  otp_debug="$(extract_json_value "$res" "otp_debug")"

  if [ -z "$CHALLENGE_ID" ]; then
    CHALLENGE_ID="$got_challenge"
  fi

  if [ -z "$OTP_CODE" ]; then
    OTP_CODE="$otp_debug"
  fi

  echo ""
  echo "Captured CHALLENGE_ID=$CHALLENGE_ID"
  echo "Captured OTP_CODE=$OTP_CODE"
}

STEP_2_VERIFY_LOGIN(){
  echo ""
  echo "========== STEP 2: verify_login_challenge =========="

  if [ -z "$CHALLENGE_ID" ]; then
    echo "CHALLENGE_ID is empty."
    exit 1
  fi

  if [ -z "$OTP_CODE" ]; then
    echo "OTP_CODE is empty."
    exit 1
  fi

  local payload
  payload="{\"challenge_id\":\"$CHALLENGE_ID\",\"otp_code\":\"$OTP_CODE\"}"

  local res
  res="$(call_post "/functions/api/sso/verify_login_challenge" "$payload")"
  pretty "$res"

  local status
  status="$(extract_json_value "$res" "status")"
  if [ "$status" != "ok" ]; then
    echo ""
    echo "STEP 2 FAILED"
    exit 1
  fi
}

STEP_3_SESSION_CHECK(){
  echo ""
  echo "========== STEP 3: session_check =========="

  local res
  res="$(call_get "/functions/api/sso/session_check")"
  pretty "$res"

  local status
  status="$(extract_json_value "$res" "status")"
  if [ "$status" != "ok" ]; then
    echo ""
    echo "STEP 3 FAILED"
    exit 1
  fi
}

STEP_4_RESOLVE_REDIRECT(){
  echo ""
  echo "========== STEP 4: resolve_redirect =========="

  local res
  res="$(call_get "/functions/api/sso/resolve_redirect")"
  pretty "$res"

  local status
  status="$(extract_json_value "$res" "status")"
  if [ "$status" != "ok" ]; then
    echo ""
    echo "STEP 4 FAILED"
    exit 1
  fi
}

STEP_5_DEVICE_CHALLENGE(){
  echo ""
  echo "========== STEP 5: request_device_challenge =========="

  local res
  res="$(call_post "/functions/api/sso/request_device_challenge" "{}")"
  pretty "$res"

  local status
  status="$(extract_json_value "$res" "status")"
  if [ "$status" != "ok" ]; then
    echo ""
    echo "STEP 5 FAILED"
    exit 1
  fi
}

STEP_6_TRUSTED_DEVICES(){
  echo ""
  echo "========== STEP 6: trusted_devices_get =========="

  local res
  res="$(call_get "/functions/api/sso/trusted_devices_get")"
  pretty "$res"

  local status
  status="$(extract_json_value "$res" "status")"
  if [ "$status" != "ok" ]; then
    echo ""
    echo "STEP 6 FAILED"
    exit 1
  fi
}

STEP_7_LOGOUT(){
  echo ""
  echo "========== STEP 7: logout =========="

  local res
  res="$(call_post "/functions/api/sso/logout" "{}")"
  pretty "$res"

  local status
  status="$(extract_json_value "$res" "status")"
  if [ "$status" != "ok" ]; then
    echo ""
    echo "STEP 7 FAILED"
    exit 1
  fi
}

STEP_8_SESSION_AFTER_LOGOUT(){
  echo ""
  echo "========== STEP 8: session_check after logout =========="

  local res
  res="$(call_get "/functions/api/sso/session_check")"
  pretty "$res"

  local status
  status="$(extract_json_value "$res" "status")"
  if [ "$status" = "ok" ]; then
    echo ""
    echo "STEP 8 FAILED: session still valid after logout"
    exit 1
  fi
}

STEP_1_REQUEST_LOGIN
STEP_2_VERIFY_LOGIN
STEP_3_SESSION_CHECK
STEP_4_RESOLVE_REDIRECT
STEP_5_DEVICE_CHALLENGE
STEP_6_TRUSTED_DEVICES
STEP_7_LOGOUT
STEP_8_SESSION_AFTER_LOGOUT

echo ""
echo "========================================"
echo "ALL SSO TEST STEPS FINISHED"
echo "========================================"
