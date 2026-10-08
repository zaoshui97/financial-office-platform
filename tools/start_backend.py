r"""一键启停后端。

使用:
  python tools\start_backend.py start    # 启动
  python tools\start_backend.py stop     # 停止
  python tools\start_backend.py restart  # 重启
  python tools\start_backend.py status   # 看状态
  python tools\start_backend.py tail     # 看日志

进程以后台模式运行（nohup-equivalent），日志写到 logs/uvicorn.log。
"""
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(r"D:\Apexis\financial-office-platform")
LOG = ROOT / "logs" / "uvicorn.log"
PID_FILE = ROOT / "logs" / "uvicorn.pid"
PORT = 8030
HOST = "127.0.0.1"


def _read_pid() -> int | None:
    if not PID_FILE.exists():
        return None
    try:
        return int(PID_FILE.read_text().strip())
    except (ValueError, OSError):
        return None


def _port_listening() -> bool:
    """更可靠地检测 8030 是否在监听。"""
    import socket
    try:
        with socket.create_connection((HOST, PORT), timeout=1.0):
            return True
    except OSError:
        return False


def status():
    pid = _read_pid()
    listening = _port_listening()
    print(f"PID file: {pid or 'none'}")
    print(f"Port {PORT} listening: {listening}")
    if not listening and pid:
        print("⚠️  PID file says running but port is not listening — may be a zombie. Run `restart`.")


def start():
    if _port_listening():
        print(f"✓ Backend already running on port {PORT}.")
        return
    LOG.parent.mkdir(parents=True, exist_ok=True)
    log_fp = open(LOG, "ab", buffering=0)
    proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "app.main:app",
            "--host", HOST,
            "--port", str(PORT),
        ],
        cwd=str(ROOT),
        stdout=log_fp,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
        close_fds=True,
    )
    PID_FILE.write_text(str(proc.pid))
    print(f"✓ Started uvicorn PID={proc.pid}, log → {LOG}")

    # 等待就绪（最多 30s）
    print(f"⏳ Waiting for port {PORT} ...")
    for i in range(30):
        time.sleep(1)
        if _port_listening():
            print(f"✓ Backend ready in {i+1}s")
            return
    print(f"✗ Backend did not start in 30s. Tail: {LOG}")


def stop():
    pid = _read_pid()
    if not pid:
        print("No PID file.")
    else:
        print(f"Killing PID={pid} ...")
        # 优雅杀
        subprocess.run(["taskkill", "/F", "/PID", str(pid)], capture_output=True)
        if PID_FILE.exists():
            PID_FILE.unlink()
    # 兜底杀：port 上所有 LISTENING
    out = subprocess.run(["netstat", "-ano", "-p", "TCP"], capture_output=True, text=True, encoding="gbk", errors="ignore").stdout
    import re
    killed = set()
    for line in out.splitlines():
        if f":{PORT}" in line and "LISTENING" in line:
            m = re.search(r"(\d+)$", line)
            if m:
                p = int(m.group(1))
                if p not in killed:
                    subprocess.run(["taskkill", "/F", "/PID", str(p)], capture_output=True)
                    print(f"  Killed leftover PID={p}")
                    killed.add(p)
    time.sleep(1)
    if _port_listening():
        print(f"⚠️  Port {PORT} still in use. Manual check needed.")
    else:
        print("✓ Stopped.")


def tail():
    if not LOG.exists():
        print("No log file.")
        return
    # 打印最后 50 行
    lines = LOG.read_text(encoding="utf-8", errors="ignore").splitlines()[-50:]
    for line in lines:
        print(line)


def main():
    if len(sys.argv) < 2:
        cmd = "status"
    else:
        cmd = sys.argv[1].lower()
    {
        "start": start,
        "stop": stop,
        "restart": lambda: (stop(), start()),
        "status": status,
        "tail": tail,
    }.get(cmd, lambda: print(f"Unknown cmd: {cmd}"))()


if __name__ == "__main__":
    main()
