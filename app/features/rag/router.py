"""企业知识库创建、文档上传和解析结果查询API。"""

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.auth.dependencies import CurrentUser
from app.features.rag.indexing import VectorIndexError, index_document
from app.features.rag.schemas import (
    DocumentContentRead,
    DocumentNormalizationRead,
    DocumentRead,
    KnowledgeBaseCreate,
    KnowledgeBaseRead,
    KnowledgeBaseUpdate,
)
from app.features.rag.service import (
    create_knowledge_base,
    delete_document,
    delete_knowledge_base,
    get_document_normalization,
    get_document_status,
    get_owned_knowledge_base,
    list_documents,
    list_knowledge_bases,
    read_document_content,
    update_knowledge_base,
    upload_and_parse_document,
)

router = APIRouter(prefix="/rag", tags=["企业知识库"])


@router.post(
    "/knowledge-bases",
    response_model=KnowledgeBaseRead,
    status_code=status.HTTP_201_CREATED,
    summary="创建知识库",
)
def create_kb(
    data: KnowledgeBaseCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> KnowledgeBaseRead:
    """为当前用户创建私有知识库。"""
    return KnowledgeBaseRead.model_validate(create_knowledge_base(db, current_user.id, data))


@router.get(
    "/knowledge-bases",
    response_model=list[KnowledgeBaseRead],
    summary="知识库列表",
)
def read_knowledge_bases(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[KnowledgeBaseRead]:
    """列出当前用户的知识库。"""
    return [
        KnowledgeBaseRead.model_validate(item)
        for item in list_knowledge_bases(db, current_user.id)
    ]


@router.get(
    "/knowledge-bases/{knowledge_base_id}",
    response_model=KnowledgeBaseRead,
    summary="知识库详情",
)
def read_knowledge_base(
    knowledge_base_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> KnowledgeBaseRead:
    """查询当前用户拥有的知识库详情。"""
    return KnowledgeBaseRead.model_validate(
        get_owned_knowledge_base(db, knowledge_base_id, current_user.id)
    )


@router.patch(
    "/knowledge-bases/{knowledge_base_id}",
    response_model=KnowledgeBaseRead,
    summary="更新知识库",
)
def patch_knowledge_base(
    knowledge_base_id: int,
    data: KnowledgeBaseUpdate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> KnowledgeBaseRead:
    """更新当前用户知识库名称或描述。"""
    return KnowledgeBaseRead.model_validate(
        update_knowledge_base(db, current_user.id, knowledge_base_id, data)
    )


@router.delete(
    "/knowledge-bases/{knowledge_base_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除知识库",
)
def remove_knowledge_base(
    knowledge_base_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """删除知识库及其文档和向量。"""
    delete_knowledge_base(db, current_user.id, knowledge_base_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/knowledge-bases/{knowledge_base_id}/documents",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
    summary="上传并解析文档",
)
def upload_document(
    knowledge_base_id: int,
    file: Annotated[UploadFile, File(description="PDF、DOCX或TXT企业文档")],
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> DocumentRead:
    """保存上传文件，解析文本并写入MySQL。"""
    document = upload_and_parse_document(db, current_user.id, knowledge_base_id, file)
    return DocumentRead.model_validate(document)


@router.get(
    "/knowledge-bases/{knowledge_base_id}/documents",
    response_model=list[DocumentRead],
    summary="知识库文档列表",
)
def read_documents(
    knowledge_base_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[DocumentRead]:
    """列出知识库中的文档及解析状态。"""
    return [
        DocumentRead.model_validate(item)
        for item in list_documents(db, knowledge_base_id, current_user.id)
    ]


@router.get(
    "/documents/{document_id}/normalization",
    response_model=DocumentNormalizationRead,
    summary="查看文档归一化状态",
)
def read_normalization(
    document_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> DocumentNormalizationRead:
    """返回归一化版本和正文指纹，供前端展示与核对。"""
    return DocumentNormalizationRead.model_validate(
        get_document_normalization(db, document_id, current_user.id)
    )


@router.get(
    "/documents/{document_id}/content",
    response_model=DocumentContentRead,
    summary="查看文档解析文本",
)
def read_content(
    document_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> DocumentContentRead:
    """返回当前用户文档的解析全文。"""
    document = read_document_content(db, document_id, current_user.id)
    return DocumentContentRead.model_validate(document)


@router.get(
    "/documents/{document_id}",
    response_model=DocumentRead,
    summary="文档状态",
)
def read_document(
    document_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> DocumentRead:
    """返回文档解析状态和向量索引状态。"""
    return DocumentRead.model_validate(get_document_status(db, document_id, current_user.id))


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除文档",
)
def remove_document(
    document_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """删除文档、持久化Chunk、本地文件和向量。"""
    delete_document(db, document_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _index_document_response(
    document_id: int,
    current_user: CurrentUser,
    db: Session,
) -> DocumentRead:
    """执行同步索引并将安全错误转换为API错误。"""
    try:
        document = index_document(db, current_user.id, document_id)
    except VectorIndexError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return DocumentRead.model_validate(document)


@router.post(
    "/documents/{document_id}/index",
    response_model=DocumentRead,
    summary="建立文档向量索引",
)
def create_document_index(
    document_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> DocumentRead:
    """为已解析文档建立或重建向量索引。"""
    return _index_document_response(document_id, current_user, db)


@router.post(
    "/documents/{document_id}/reindex",
    response_model=DocumentRead,
    summary="重新建立文档向量索引",
)
def reindex_document(
    document_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> DocumentRead:
    """幂等重试失败或重新生成的文档向量。"""
    return _index_document_response(document_id, current_user, db)
