'use client';

/**
 * Plans & Billing Page (Route: /org-admin/plans)
 * Re-exports the unified professional OrgAdminSubscriptionPage component
 * ensuring full feature parity across both /org-admin/plans and /org-admin/subscription.
 */
import OrgAdminSubscriptionPage from '@/app/org-admin/subscription/page';

export default function OrgAdminPlansPage() {
  return <OrgAdminSubscriptionPage />;
}
