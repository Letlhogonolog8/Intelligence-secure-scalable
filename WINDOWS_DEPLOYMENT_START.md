# 🪟 AEGIS-AI: Windows Quick Start Guide

**For Windows PowerShell / Command Prompt users**

---

## ⚡ Quick Start (Right Now!)

### Step 1: Run Pre-Deployment Check

**PowerShell** (recommended):
```powershell
# Just run the script directly (Windows PowerShell doesn't need chmod)
.\scripts\pre-deployment-checklist.sh
```

**Command Prompt**:
```cmd
# Use bash.exe from Git Bash or WSL
bash scripts/pre-deployment-checklist.sh
```

### Step 2: Start Docker Compose

**PowerShell** (run from project root):
```powershell
docker-compose -f docker-compose.yml up --build
```

**Command Prompt**:
```cmd
docker-compose -f docker-compose.yml up --build
```

---

## 📋 Windows-Compatible Commands

### Navigation (Windows PowerShell)

```powershell
# Change directory
cd "c:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable"

# List files
Get-ChildItem

# See Docker files
Get-ChildItem Dockerfile*

# See scripts
Get-ChildItem scripts\
```

### Docker Commands (Works on All Windows Shells)

```powershell
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Remove all (including volumes)
docker-compose down -v

# Check status
docker-compose ps

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Build & Push Images (Windows PowerShell)

```powershell
# List build scripts
Get-ChildItem scripts\docker-build.sh

# On Windows, use bash to run the script
bash scripts/docker-build.sh --version 1.0.0

# Or run each step manually
docker build -f Dockerfile.backend -t aegis-ai/backend:1.0.0 .
docker build -f Dockerfile.frontend -t aegis-ai/frontend:1.0.0 .
```

---

## 🚀 Start the Application (NOW)

### Option A: Simple Start (Recommended for First Time)

**PowerShell**:
```powershell
# Navigate to project
cd "c:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable"

# Start everything
docker-compose up --build

# Wait for output like:
# aegis-frontend-dev  | Port 8080 is in use
# aegis-backend-dev   | Server running on port 3001
```

### Option B: Start in Background

**PowerShell**:
```powershell
# Start in background
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop later
docker-compose down
```

---

## 🌐 Access Your Application

Once running, access:

- **Frontend**: http://localhost:8080
- **Backend**: http://localhost:3001/api/health
- **Docker Desktop**: Open "Dashboard" to see containers

---

## 🔍 Test Services

**PowerShell**:
```powershell
# Test frontend
curl http://localhost:8080

# Test backend
curl http://localhost:3001/api/health

# Expected output for backend:
# { "status": "ok", "timestamp": "2026-02-22T..." }
```

**Command Prompt**:
```cmd
# Test frontend
curl http://localhost:8080

# Test backend  
curl http://localhost:3001/api/health
```

---

## 🛠️ Troubleshooting (Windows)

### Docker not found
```powershell
# Verify Docker is installed
docker --version

# Install from: https://www.docker.com/products/docker-desktop
```

### Port already in use
```powershell
# Check what's using port 8080
netstat -ano | findstr :8080

# Or use different ports
docker-compose.override.yml:
# ports:
#   - "9080:8080"  # Use 9080 instead
```

### PowerShell script execution error
```powershell
# Set execution policy (one-time setup)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or use bash instead
bash scripts/docker-build.sh --version 1.0.0
```

### Docker build fails
```powershell
# Clean and rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up --build
```

### View Docker logs
```powershell
# See all Docker logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# Logs for specific service
docker-compose logs -f backend
```

---

## 📝 Windows vs Linux/Mac Commands

| Task | Windows PowerShell | Linux/Mac |
|------|-------------------|-----------|
| Make script executable | Not needed | `chmod +x script.sh` |
| Run bash script | `bash script.sh` | `./script.sh` |
| Environment variables | `$env:VAR=value` | `export VAR=value` |
| View Docker logs | `docker-compose logs` | `docker-compose logs` |
| List files | `Get-ChildItem` | `ls` |
| Change directory | `cd path` | `cd path` |
| View file | `Get-Content file` | `cat file` |
| Remove directory | `Remove-Item -Recurse` | `rm -rf` |

---

## ✅ What To Do Now

### Option 1: Using Explorer (Easiest for Windows Users)

1. **Open File Explorer**
   - Press Windows key + E
   - Navigate to: `c:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable`

2. **Right-click on `start-docker.bat`**
   - Select "Run as administrator"
   - Wait for Docker to start (takes 30-60 seconds)

3. **Check Console Output**
   - You should see:
   ```
   aegis-frontend-dev  | Port 8080 is in use
   aegis-backend-dev   | Server running on port 3001
   ```

### Option 2: Using PowerShell (More Control)

1. **Open PowerShell as Administrator**
   - Press Windows key
   - Type "PowerShell"
   - Right-click → "Run as administrator"

2. **Navigate to project** (copy-paste this exactly):
   ```powershell
   cd 'c:\Users\mudau\Desktop\New Apps\intelligence-secure-scalable'
   ```

3. **Start application**:
   ```powershell
   docker compose up --build
   ```

4. **Wait for startup** (takes 30-60 seconds first time):
   ```
   aegis-frontend-dev  | Port 8080 is in use
   aegis-backend-dev   | Server running on port 3001
   ```

### Option 3: Using Git Bash (If You Have It)

1. **Open Git Bash**

2. **Navigate to project**:
   ```bash
   cd "/c/Users/mudau/Desktop/New Apps/intelligence-secure-scalable"
   ```

3. **Start application**:
   ```bash
   docker-compose up --build
   ```

### 4. Test in Browser

Once you see "Port 8080 is in use" message:

- **Frontend**: Open http://localhost:8080
  - Should see AEGIS-AI landing page
  
- **Backend**: Open http://localhost:3001/api/health
  - Should see: `{ "status": "ok", "timestamp": "..." }`

---

## 🎯 Next Steps After Startup

1. Read: [`QUICK_START.md`](./QUICK_START.md) (Steps 1-2 complete)
2. Read: [`CRITICAL_ISSUES_SUMMARY.md`](./CRITICAL_ISSUES_SUMMARY.md) (15 min)
3. Follow: [`ROLE_BASED_NAVIGATION.md`](./ROLE_BASED_NAVIGATION.md) for your role

---

## 💾 Stopping & Cleanup (Windows)

```powershell
# Stop services (keep volumes)
docker-compose down

# Stop and remove everything
docker-compose down -v

# Remove Docker images
docker rmi aegis-ai/frontend:1.0.0
docker rmi aegis-ai/backend:1.0.0

# Free up disk space
docker system prune
```

---

## 🆘 Windows-Specific Issues

### WSL (Windows Subsystem for Linux) Users

```powershell
# If using WSL, you might want to use WSL for better performance
wsl -u root

# Then run Linux commands
cd /mnt/c/Users/mudau/Desktop/"New Apps"/intelligence-secure-scalable
docker-compose up --build
```

### Git Bash Users

```bash
# Git Bash supports more Unix-like commands
./scripts/pre-deployment-checklist.sh
./scripts/docker-build.sh --version 1.0.0
```

---

## 📞 Help Resources

- **Docker Desktop Issues**: https://docs.docker.com/desktop/troubleshoot/
- **PowerShell Help**: `Get-Help <command-name>`
- **Docker Logs**: Check Docker Desktop → Troubleshoot
- **Windows Networking**: `ipconfig` to see your IP

---

## ✨ You're Ready!

Your environment is configured correctly. Run the commands above and your AEGIS-AI application will be running locally in 30 seconds.

**Happy coding! 🚀**
