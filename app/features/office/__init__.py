"""智能办公域。"""

from app.features.office.schemas import (  # noqa: F401
    DocumentTemplateCreate,
    DocumentTemplateListResponse,
    DocumentTemplateRead,
    GeneratedContentCreate,
    GeneratedContentRead,
)
from app.features.office.service import (  # noqa: F401
    create_generated_content,
    create_template,
    get_template,
    list_generated_contents,
    list_templates,
)
