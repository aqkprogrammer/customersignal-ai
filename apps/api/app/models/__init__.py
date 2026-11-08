"""Import every model so Alembic autogenerate and relationship resolution see the full metadata."""

from app.models.admin import AdminAuditLog, AdminSession, AdminUser, FeatureFlag, SystemSetting
from app.models.analysis import AIAnalysisResult, AIUsageLog, AnalysisJob
from app.models.base import Base
from app.models.billing import Invoice, Payment, StripeEvent, Subscription, SubscriptionPlan, UsageRecord
from app.models.integration import Integration, IntegrationSyncLog
from app.models.lead import Lead, LeadActivity
from app.models.monitoring import MonitoringEvent, MonitoringRule, Notification
from app.models.project import Business, Competitor, Project
from app.models.report import Report, ReportShare
from app.models.review import (
    ComplaintCluster,
    ProductOpportunity,
    Review,
    ReviewCategory,
    ReviewSentiment,
    ReviewSource,
    ReviewTopic,
)
from app.models.storage import StoredFile
from app.models.support import Announcement, EmailLog, EmailTemplate, SupportMessage, SupportTicket
from app.models.user import AuthToken, User, UserProfile, UserSession
from app.models.workspace import ActivityLog, ApiKey, Workspace, WorkspaceInvitation, WorkspaceMember

__all__ = [
    "Base", "User", "UserProfile", "UserSession", "AuthToken", "Workspace", "WorkspaceMember",
    "WorkspaceInvitation", "ActivityLog", "ApiKey", "Project", "Business", "Competitor", "ReviewSource", "Review",
    "ReviewSentiment", "ReviewCategory", "ReviewTopic", "ComplaintCluster", "ProductOpportunity", "AnalysisJob",
    "AIAnalysisResult", "AIUsageLog", "Report", "ReportShare", "Lead", "LeadActivity", "MonitoringRule",
    "MonitoringEvent", "Notification", "Integration", "IntegrationSyncLog", "SubscriptionPlan", "Subscription",
    "Invoice", "Payment", "UsageRecord", "StripeEvent", "SupportTicket", "SupportMessage", "Announcement",
    "EmailTemplate", "EmailLog", "AdminUser", "AdminSession", "AdminAuditLog", "FeatureFlag", "SystemSetting", "StoredFile",
]
