"""检查所有 RAG 相关表的列结构"""
import sys
sys.path.insert(0, '.')
from sqlalchemy import create_engine, text
import app.core.config as cfg

e = create_engine(cfg.settings.DATABASE_URL)
tables = ['knowledge_bases', 'knowledge_documents', 'document_chunks',
          'regulations', 'industry_news', 'business_impact', 'decision_playbacks',
          'organizations', 'departments',
          'meetings', 'meeting_participants', 'meeting_sessions',
          'compliance_audit_logs', 'document_templates', 'generated_contents',
          'blackboard_sessions', 'blackboard_events',
          'chat_conversations', 'chat_messages']

with e.connect() as c:
    for t in tables:
        try:
            cols = c.execute(text(f'SHOW COLUMNS FROM {t}')).fetchall()
            print(f'\n=== {t} ({len(cols)} cols) ===')
            for col in cols:
                print(f'  {col[0]:35s} {col[1]}')
        except Exception as ex:
            print(f'\n=== {t}: ERROR {ex} ===')