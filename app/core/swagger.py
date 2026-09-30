"""自定义Swagger UI页面，为授权弹窗提供简体中文翻译。"""

from fastapi import FastAPI
from fastapi.openapi.docs import (
    get_swagger_ui_html,
    get_swagger_ui_oauth2_redirect_html,
)
from fastapi.responses import HTMLResponse

SWAGGER_TRANSLATION_SCRIPT = r"""
<script>
(() => {
  const replacements = [
    ["Available authorizations", "可用的身份认证"],
    [
      "Scopes are used to grant an application different levels of access to data " +
        "on behalf of the end user.",
      "权限范围用于允许应用代表当前用户访问不同级别的数据。"
    ],
    ["Each API may declare one or more scopes.", "每个 API 可以声明一个或多个权限范围。"],
    [
      "API requires the following scopes. Select which ones you want to grant to Swagger UI.",
      "当前 API 需要以下权限范围，请选择要授予 Swagger UI 的权限。"
    ],
    ["OAuth2PasswordBearer (OAuth2, password)", "用户登录认证（OAuth2 密码模式）"],
    ["Token URL:", "令牌地址："],
    ["Flow: password", "授权模式：密码"],
    ["username:", "用户名："],
    ["password:", "密码："],
    ["Client credentials location:", "客户端凭证位置："],
    ["Authorization header", "Authorization 请求头"],
    ["Request body", "请求体"],
    ["client_id:", "客户端 ID："],
    ["client_secret:", "客户端密钥："],
    ["Authorized", "已授权"],
    ["Authorize", "登录 / 授权"],
    ["Logout", "退出登录"],
    ["Close", "关闭"]
  ];

  function translateText(value) {
    let translated = value;
    for (const [source, target] of replacements) {
      translated = translated.split(source).join(target);
    }
    return translated;
  }

  function translateElement(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }
    for (const node of textNodes) {
      const translated = translateText(node.nodeValue || "");
      if (translated !== node.nodeValue) {
        node.nodeValue = translated;
      }
    }

    const attributes = ["aria-label", "title", "placeholder"];
    root.querySelectorAll("*").forEach((element) => {
      for (const attribute of attributes) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        const translated = translateText(value);
        if (translated !== value) {
          element.setAttribute(attribute, translated);
        }
      }
    });
  }

  function applyTranslation() {
    if (document.body) translateElement(document.body);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          translateElement(node);
        } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
          translateElement(node.parentElement);
        }
      }
    }
  });

  window.addEventListener("DOMContentLoaded", () => {
    applyTranslation();
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
</script>
"""


def get_chinese_swagger_ui_html(app: FastAPI) -> HTMLResponse:
    """生成包含简体中文翻译脚本的Swagger UI页面。"""
    swagger_response = get_swagger_ui_html(
        openapi_url=app.openapi_url or "/openapi.json",
        title=f"{app.title} - 接口文档",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_ui_parameters={
            "persistAuthorization": True,
            "displayRequestDuration": True,
            "docExpansion": "list",
        },
    )
    html = swagger_response.body.decode("utf-8")
    html = html.replace("</body>", f"{SWAGGER_TRANSLATION_SCRIPT}</body>")
    return HTMLResponse(content=html)


def register_swagger_routes(app: FastAPI) -> None:
    """注册自定义Swagger页面和OAuth2回调页面。"""

    @app.get("/docs", include_in_schema=False)
    def swagger_ui() -> HTMLResponse:
        """返回简体中文增强的Swagger UI。"""
        return get_chinese_swagger_ui_html(app)

    @app.get(app.swagger_ui_oauth2_redirect_url, include_in_schema=False)
    def swagger_ui_redirect() -> HTMLResponse:
        """返回Swagger OAuth2回调页面。"""
        return get_swagger_ui_oauth2_redirect_html()