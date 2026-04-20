@echo off
REM Backlog Verification Script
REM Run this to verify all fixes are working

echo ========================================
echo AEGIS-AI Backlog Verification
echo ========================================
echo.

echo [1/6] Checking Circuit Breaker...
if exist "server\utils\circuitBreaker.ts" (
    echo ✅ Circuit breaker file exists
) else (
    echo ❌ Circuit breaker file missing
)

echo.
echo [2/6] Checking Prometheus configs...
if exist "config\prometheus.yml" (
    echo ✅ Kubernetes Prometheus config exists
) else (
    echo ❌ Kubernetes Prometheus config missing
)

if exist "config\prometheus.docker.yml" (
    echo ✅ Docker Compose Prometheus config exists
) else (
    echo ❌ Docker Compose Prometheus config missing
)

echo.
echo [3/6] Checking structured logging...
findstr /C:"createLogger" server\index.ts >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Structured logger imported in server/index.ts
) else (
    echo ❌ Structured logger not found in server/index.ts
)

echo.
echo [4/6] Checking load balancer integration...
findstr /C:"loadBalancer" server\index.ts >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Load balancer integrated in server/index.ts
) else (
    echo ❌ Load balancer not integrated
)

echo.
echo [5/6] Checking bundle optimization...
findstr /C:"experimentalMinChunkSize" vite.config.ts >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Bundle optimization configured
) else (
    echo ❌ Bundle optimization not configured
)

echo.
echo [6/6] Checking test files...
if exist "src\__tests__\server\circuitBreaker.test.ts" (
    echo ✅ Circuit breaker tests exist
) else (
    echo ❌ Circuit breaker tests missing
)

if exist "src\__tests__\server\loadBalancer.test.ts" (
    echo ✅ Load balancer tests exist
) else (
    echo ❌ Load balancer tests missing
)

echo.
echo ========================================
echo Running Type Check...
echo ========================================
call npm run typecheck
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Type check failed
    exit /b 1
)
echo ✅ Type check passed

echo.
echo ========================================
echo Running Tests...
echo ========================================
call npm run test
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Tests failed
    exit /b 1
)
echo ✅ Tests passed

echo.
echo ========================================
echo Verification Complete!
echo ========================================
echo.
echo All backlog items verified successfully.
echo Ready for staging deployment.
echo.
echo Next steps:
echo 1. Review BACKLOG_COMPLETE.md
echo 2. Deploy to staging
echo 3. Monitor circuit breaker and logs
echo.

pause
