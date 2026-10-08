# 知识库文本归一化：代码与使用说明

## 交付范围

本功能已接入现有后端的文档上传流程，不需要修改数据库表，也不依赖 Docker 才能使用。交付文件如下：

| 文件 | 用途 |
|---|---|
| `app/features/rag/normalization.py` | 独立的文本归一化规则、解析结果转换和正文 SHA-256 指纹 |
| `app/features/rag/service.py` | 上传解析后调用归一化模块，并给新片段标记规则版本；提供状态查询 |
| `app/features/rag/router.py`、`schemas.py` | 归一化状态只读接口及响应模型 |
| `tests/test_rag_normalization.py` | 规则、来源保留、上传和用户隔离测试 |
| `docs/api-contract-v1.md` | 接口契约补充 |

不要只复制 `normalization.py` 到旧版项目：上传流程与状态接口还依赖上述接入改动。

## 当前规则（`text-v1`）

1. 文本统一为 Unicode NFC；换行统一为 `\n`。
2. 去除 UTF-8 BOM、零宽空格；将不换行空格和全角空格转换为普通空格。
3. 连续的行内空白压缩为一个空格；多余空行最多保留一行。
4. 以解析得到的片段顺序重建正文，同时保留页码、段落序号、标题和表格来源元数据。
5. 不改写金融术语、数字、大小写和标点；不做 Unicode NFKC 折叠。

原始上传文件仍按原方式保存。新上传文档的 `parsed_text` 和分块文本使用归一化后的内容，片段 `chunk_metadata.normalization_version` 标记为 `text-v1`。

## 在后端代码中调用

```python
from app.features.rag.normalization import normalize_parsed_document, normalize_text
from app.integrations.document_parser import parse_document

print(normalize_text("制度\u3000规定  \r\n审批流程"))

parsed = parse_document("policy.docx")
normalized = normalize_parsed_document(parsed)
print(normalized.text)
print(normalized.segments[0].metadata)  # 来源信息仍可用于引用定位
```

这段代码需在已安装项目依赖、配置有效的后端 Python 环境中运行。正常使用时无需手动调用：现有上传接口会自动归一化。

## 前端接入

当前 `frontend/digital-horse/src/pages/Knowledge/index.tsx` 的上传只更新本地演示列表，并未请求后端。前端需先接入登录令牌、真实知识库 ID 和上传接口，再展示归一化状态。登录后上传文档：

```http
POST /api/v1/rag/knowledge-bases/{knowledge_base_id}/documents
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file=<PDF、DOCX 或 TXT 文件>
```

上传响应中的 `id` 是文档 ID。随后查询：

```http
GET /api/v1/rag/documents/{document_id}/normalization
Authorization: Bearer <access_token>
```

返回示例：

```json
{
  "document_id": 1,
  "status": "normalized",
  "normalization_version": "text-v1",
  "content_hash": "64 位 SHA-256 十六进制值",
  "normalized_char_count": 317,
  "chunk_count": 1
}
```

前端建议只在 `status === "normalized"` 时展示“已归一化”及版本号。`legacy_or_unavailable` 表示旧文档、解析失败或尚未完成，不能据此推断旧文档已处理。`content_hash` 是正文核对指纹，**不是**去重或安全审查结果。未登录返回 401；访问其他用户文档返回 404。

如果使用 PowerShell，可在后端服务已经运行时手动检查（把变量替换为自己的测试值，不要把令牌写进仓库）：

```powershell
$base = "http://127.0.0.1:8000/api/v1"
$token = "<登录后取得的 access_token>"
$kbId = 1
curl.exe -sS -H "Authorization: Bearer $token" -F "file=@C:\path\policy.txt" "$base/rag/knowledge-bases/$kbId/documents"
$documentId = 1
curl.exe -sS -H "Authorization: Bearer $token" "$base/rag/documents/$documentId/normalization"
```

如需检索该新文档，仍须沿用现有索引步骤：`POST /api/v1/rag/documents/{document_id}/index`。归一化本身不调用模型或 Qdrant。

## 边界与交接注意

- **只对更新后的后端新上传文档生效。** 已上传的旧文档不会自动重写，也不会自动重建向量索引；如要迁移旧数据，应先备份并另做批量重处理方案。
- 当前仅实现文本层的格式统一和来源保留；尚未实现同义词/金融术语统一、自动分类、跨文档去重或冲突消解。
- 本次未运行 Docker、未执行数据库迁移，也未修改真实 `.env`。交给队友时只分享代码和文档，不要发送真实密钥文件。
