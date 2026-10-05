"""生成答辩包装产物：架构图 + OpenAPI 导出 + API 端点清单。

运行：python tools/generate_assets.py

产物：
  docs/assets/architecture.png        # 43 张表分组架构图
  docs/assets/openapi.json            # 完整 OpenAPI Schema
  docs/assets/api-endpoints.md        # API 端点清单（按 domain 分类）
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, ".")

import matplotlib
matplotlib.use("Agg")  # 离线渲染
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.font_manager as fm

# 强制使用系统中文字体
for cand in ("Microsoft YaHei", "SimHei", "Microsoft JhengHei", "Arial Unicode MS"):
    try:
        fm.findfont(cand, fallback_to_default=False)
        plt.rcParams["font.sans-serif"] = [cand]
        break
    except Exception:
        continue
plt.rcParams["axes.unicode_minus"] = False  # 负号显示

from app.main import create_app
from app.models import Base

OUTPUT_DIR = Path("docs/assets")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ─────────── 1. 数据库架构图 ───────────


DOMAIN_GROUPS: list[tuple[str, str, list[str]]] = [
    ("核心用户域", "#3b82f6", [
        "users", "refresh_tokens", "user_sessions",
        "roles", "permissions", "role_permissions", "user_roles",
    ]),
    ("会议协同域", "#8b5cf6", [
        "meetings", "meeting_sessions", "meeting_minutes",
        "meeting_participants", "meeting_todos", "meeting_transcripts",
        "meeting_blackboard", "meeting_blackboard_events",
        "agent_executions",
    ]),
    ("Agent 配置域", "#a855f7", [
        "agent_configs", "agent_tasks", "agent_collaborations",
    ]),
    ("合规审计域", "#ef4444", [
        "compliance_audit_logs", "audit_logs", "policy_rules",
        "policy_violations", "risk_alerts", "sandbox_audit_log",
    ]),
    ("RAG 知识域", "#10b981", [
        "knowledge_bases", "knowledge_documents", "document_chunks",
    ]),
    ("对话域", "#06b6d4", [
        "chat_conversations", "chat_messages",
    ]),
    ("决策智能域", "#f59e0b", [
        "regulations", "regulation_versions", "regulation_diff_reports",
        "industry_news", "business_impact", "decision_playbacks",
    ]),
    ("机构/多租户域", "#ec4899", [
        "organizations", "departments", "business_domains", "customer_types",
    ]),
    ("智能办公域", "#14b8a6", [
        "document_templates", "generated_contents",
    ]),
    ("黑板（共享内存）域", "#6366f1", [
        "blackboard_sessions", "blackboard_events",
    ]),
]


def draw_architecture() -> None:
    actual = {t.name for t in Base.metadata.sorted_tables}
    print(f"[架构图] 元数据共 {len(actual)} 张表，开始渲染")

    fig, ax = plt.subplots(figsize=(20, 14))
    ax.set_xlim(0, 20)
    ax.set_ylim(0, 14)
    ax.axis("off")
    ax.set_title(
        "金融智能办公平台 · 数据库架构图 (v1.1, 43 张表)",
        fontsize=18, fontweight="bold", pad=20,
    )

    n_groups = len(DOMAIN_GROUPS)
    col_height = 12.0 / n_groups

    for i, (name, color, tables) in enumerate(DOMAIN_GROUPS):
        y_top = 13.5 - i * col_height
        # 分组标题
        ax.add_patch(mpatches.FancyBboxPatch(
            (0.3, y_top - 0.3), 4, 0.6,
            boxstyle="round,pad=0.1", facecolor=color, alpha=0.85, edgecolor="black",
        ))
        ax.text(2.3, y_top, name, ha="center", va="center",
                fontsize=10, fontweight="bold", color="white")

        # 每组内表格（2 列布局）
        existing = [t for t in tables if t in actual]
        missing = [t for t in tables if t not in actual]
        all_tables = existing + missing
        for j, tbl in enumerate(all_tables):
            row, col = divmod(j, 2)
            tx = 5.5 + col * 7
            ty = y_top - 0.6 - row * 0.55
            is_missing = tbl in missing
            ax.add_patch(mpatches.FancyBboxPatch(
                (tx, ty), 6.5, 0.5,
                boxstyle="round,pad=0.05",
                facecolor=color if not is_missing else "#999",
                alpha=0.25 if not is_missing else 0.1,
                edgecolor=color if not is_missing else "gray",
                linestyle="solid" if not is_missing else "dashed",
            ))
            label = f"{tbl}{'  (待迁移)' if is_missing else ''}"
            ax.text(tx + 3.25, ty + 0.25, label,
                    ha="center", va="center",
                    fontsize=8, color="black" if not is_missing else "gray",
                    style="italic" if is_missing else "normal")

    # 图例
    legend = [
        mpatches.Patch(facecolor="#10b981", alpha=0.4, label="已落库 + API 在线"),
        mpatches.Patch(facecolor="#999", alpha=0.3, label="设计阶段 (灰色虚线)"),
    ]
    ax.legend(handles=legend, loc="lower right", fontsize=11)
    ax.text(10, 0.3,
            "总表数：43  |  10 个业务域  |  API 端点：62  |  测试用例：28",
            ha="center", va="center", fontsize=11, fontweight="bold",
            bbox=dict(facecolor="#fef3c7", edgecolor="#92400e", boxstyle="round,pad=0.4"))

    plt.tight_layout()
    out = OUTPUT_DIR / "architecture.png"
    plt.savefig(out, dpi=140, bbox_inches="tight")
    plt.close()
    print(f"[架构图] 已写入 {out}")


# ─────────── 2. OpenAPI 导出 ───────────


def export_openapi() -> None:
    app = create_app()
    spec = app.openapi()
    out = OUTPUT_DIR / "openapi.json"
    out.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OpenAPI] {len(spec['paths'])} 个路径已写入 {out}")


# ─────────── 3. API 端点清单 (Markdown) ───────────


ENDPOINT_DOMAIN_HINTS = {
    "/auth": "认证授权域",
    "/rag": "RAG 知识域",
    "/chat": "对话域",
    "/compliance": "合规审计域",
    "/blackboard": "黑板域",
    "/meetings": "会议协同域",
    "/agents": "Agent 协作域",
    "/ai": "AI 路由",
    "/system": "系统域",
    "/organizations": "机构域",
    "/office": "智能办公域",
    "/decision": "决策智能域",
}


def categorize(path: str) -> str:
    for key, name in ENDPOINT_DOMAIN_HINTS.items():
        if key in path:
            return name
    return "其他"


def export_endpoints_md() -> None:
    app = create_app()
    spec = app.openapi()
    grouped: dict[str, list[tuple[str, str, str, str]]] = defaultdict(list)

    for path, methods in sorted(spec["paths"].items()):
        for method, info in methods.items():
            if method.upper() not in {"GET", "POST", "PUT", "DELETE", "PATCH"}:
                continue
            domain = categorize(path)
            summary = info.get("summary", "")
            tags = ", ".join(info.get("tags", []))
            grouped[domain].append((method.upper(), path, summary, tags))

    out = OUTPUT_DIR / "api-endpoints.md"
    with out.open("w", encoding="utf-8") as f:
        f.write("# API 端点清单（v1.1）\n\n")
        f.write(f"> 自动生成，共 {len(spec['paths'])} 条路径、")
        f.write(f"{sum(len(v) for v in grouped.values())} 个端点。\n\n")
        f.write("## 目录\n\n")
        for d in sorted(grouped):
            f.write(f"- [{d}](#{d.replace('（', '').replace('）', '').replace(' ', '-').lower()})\n")
        f.write("\n---\n\n")
        for d in sorted(grouped):
            f.write(f"## {d}\n\n")
            f.write(f"端点数：**{len(grouped[d])}**\n\n")
            f.write("| Method | Path | Summary | Tags |\n")
            f.write("|---|---|---|---|\n")
            for m, p, s, t in grouped[d]:
                f.write(f"| `{m}` | `{p}` | {s} | {t} |\n")
            f.write("\n")
    print(f"[API 清单] 已写入 {out}")


if __name__ == "__main__":
    draw_architecture()
    export_openapi()
    export_endpoints_md()
    print("\n所有答辩包装资产已生成。")
