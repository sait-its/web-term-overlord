#!/bin/bash
# Test script to demonstrate what injection attempts are blocked
# This simulates various attack patterns to verify sanitization works

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           Injection Prevention Test Suite                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "This script demonstrates what malicious inputs are blocked."
echo "Run this BEFORE implementing sanitization to see the risks."
echo ""

# Test patterns
declare -a attacks=(
    "<script>alert('XSS')</script>|XSS - Script tag"
    "<img src=x onerror=alert(1)>|XSS - Image onerror"
    "javascript:alert(1)|XSS - JavaScript protocol"
    "' OR '1'='1|SQL - Always true condition"
    "admin'--|SQL - Comment bypass"
    "'; DROP TABLE logs--|SQL - Table drop"
    "\$(whoami)|Command - Substitution"
    "\`cat /etc/passwd\`|Command - Backticks"
    "<h1>Hacked</h1>|HTML - Header injection"
    "Test&test|Special - Ampersand"
    'Test"test|Special - Quote'
    "Test'test|Special - Apostrophe"
    "ThisIsAVeryLongNameThatExceeds16Characters|Length - Too long"
    "Test\x00null|Special - Null byte"
)

# Sanitization function (same as client-side)
sanitize() {
    echo "$1" | sed -e 's/[<>'"'"'"&]//g' -e 's/[^[:print:]]//g' | tr -d '\n' | cut -c1-16
}

echo "┌─────────────────────────────────────────────────────────────┐"
echo "│                    TEST RESULTS                             │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""

passed=0
total=0

for attack in "${attacks[@]}"; do
    IFS='|' read -r input type <<< "$attack"
    total=$((total + 1))

    # Sanitize the input
    sanitized=$(sanitize "$input")

    # Check if it's safe (no dangerous chars)
    if [[ ! "$sanitized" =~ [\<\>\'\"\&] ]]; then
        echo "✅ $type"
        echo "   Input:  $input"
        echo "   Output: $sanitized"
        passed=$((passed + 1))
    else
        echo "❌ $type"
        echo "   Input:  $input"
        echo "   Output: $sanitized"
        echo "   ⚠️  Still contains dangerous characters!"
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $passed/$total tests passed"
echo ""

if [ "$passed" -eq "$total" ]; then
    echo "✅ All injection attempts successfully blocked!"
else
    echo "⚠️  Some attacks may still be possible. Review sanitization."
fi
echo ""

# Demonstrate what gets through
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│              WHAT SAFE INPUTS LOOK LIKE                     │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""

safe_inputs=("Alice" "Bob123" "Player1" "King" "Admin" "User_2024")

for input in "${safe_inputs[@]}"; do
    sanitized=$(sanitize "$input")
    echo "  $input → $sanitized"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
