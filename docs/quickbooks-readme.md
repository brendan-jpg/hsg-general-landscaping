# QuickBooks Multi-Domain Notes

## Goal

Support tenants who use their own domains for:

- `https://tenantdomain.com/login`
- `https://tenantdomain.com/dashboard`
- `https://tenantdomain.com/dashboard/settings`

while keeping QuickBooks OAuth maintainable at scale.

## Recommended Architecture

Use one stable platform domain for the QuickBooks OAuth flow, even if the tenant normally uses their own domain.

Example platform domain:

- `https://app.hsgrowth.com`

Example tenant domain:

- `https://tenantdomain.com`

Recommended flow:

1. User starts on `https://tenantdomain.com/dashboard/settings`
2. Clicking `Connect QuickBooks` sends them to `https://app.hsgrowth.com/api/integrations/quickbooks/connect`
3. Intuit redirects back to `https://app.hsgrowth.com/api/integrations/quickbooks/callback`
4. The callback stores tokens and sync state
5. The callback redirects the user back to `https://tenantdomain.com/dashboard/settings?quickbooks=connected`

## Why This Is Better

- One Intuit app config instead of per-tenant domain management
- One stable callback URL
- Easier production setup
- Easier debugging
- No need to keep changing QuickBooks app settings as tenants add domains

## Intuit App Settings

For the Intuit app, use the stable platform domain:

- Host domain: `app.hsgrowth.com`
- Launch URL: `https://app.hsgrowth.com/dashboard/settings`
- Disconnect URL: `https://app.hsgrowth.com/dashboard/settings?quickbooks=disconnected`
- Connect/Reconnect URL: `https://app.hsgrowth.com/api/integrations/quickbooks/connect`

Redirect URI:

- `https://app.hsgrowth.com/api/integrations/quickbooks/callback`

## App Changes Needed

The QuickBooks connect flow should carry the tenant return URL or tenant domain through state.

Recommended state payload:

- current user id
- timestamp
- tenant business id
- return URL such as `https://tenantdomain.com/dashboard/settings`

Then the callback should:

1. validate state
2. complete token exchange
3. save/update the QuickBooks connection
4. redirect back to the tenant return URL

## Auth Consideration

This only works cleanly if the QuickBooks platform-domain routes do not depend on tenant-domain cookies being shared across domains.

If tenant auth cookies are domain-scoped, then:

- the connect route should either use a platform-domain session
- or use a signed state handoff that contains enough context to finish the callback safely

Do not assume a cookie from `tenantdomain.com` will be available on `app.hsgrowth.com`.

## What To Avoid

Avoid putting each tenant’s custom domain directly into the Intuit app settings as the long-term solution.

That approach:

- does not scale
- makes onboarding harder
- creates callback drift
- becomes painful as tenant domains grow

## Current Direction

If the product keeps tenant dashboards on tenant-owned domains, QuickBooks OAuth should still be centralized on the stable platform domain, then redirect back to the tenant domain after success/failure.
