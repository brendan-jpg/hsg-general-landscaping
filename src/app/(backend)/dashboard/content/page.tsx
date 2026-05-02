import Link from 'next/link';
import BackendTabs from '@/components/backend/BackendTabs';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import DataTable from '../../../../components/backend/DataTable';
import PendingSubmitButton from '@/components/backend/PendingSubmitButton';
import Button from '@/components/shared/Button';
import { createGoogleBusinessProfilePostAction, deleteBlogPostsBulk } from '@/lib/actions';
import { getDashboardBlogPosts, getDashboardGoogleBusinessProfileLocalPosts } from '@/lib/content/queries';
import { formatDateTime } from '@/lib/utils';

type ContentTab = 'blogs' | 'google-posts';

interface ContentManagePageProps {
  searchParams?: Promise<{
    tab?: string;
    google_post_new?: string;
    google_post?: string;
    google_post_message?: string;
    google_post_name?: string;
  }>;
}

export default async function ContentManagePage({ searchParams }: ContentManagePageProps) {
  const query = (searchParams ? await searchParams : {}) ?? {};
  const tabParam = (query.tab ?? '').trim();
  const activeTab: ContentTab = tabParam === 'google-posts' ? 'google-posts' : 'blogs';
  const blogPosts = activeTab === 'blogs' ? await getDashboardBlogPosts() : [];
  const contentTabs: Array<{ label: string; value: ContentTab }> = [
    { label: 'Blog Posts', value: 'blogs' },
    { label: 'Google Posts', value: 'google-posts' },
  ];

  let googlePostHistoryError: string | null = null;
  const googlePosts =
    activeTab === 'google-posts'
      ? await getDashboardGoogleBusinessProfileLocalPosts().catch((error) => {
          googlePostHistoryError = error instanceof Error ? error.message : 'Unable to load Google post history';
          return [];
        })
      : [];

  const googlePostSuccess = query.google_post === 'success';
  const googlePostError = query.google_post === 'error';
  const showGooglePostComposer = query.google_post_new === '1' || googlePostSuccess || googlePostError;

  return (
    <ModuleShell
      title="Content"
      description="Manage blogs and Google Business Profile posts"
      toolbar={
        <BackendTabs
          ariaLabel="Content tabs"
          activeValue={activeTab}
          items={contentTabs.map((tab) => {
            const params = new URLSearchParams();
            params.set('tab', tab.value);
            return {
              ...tab,
              href: `/dashboard/content?${params.toString()}`,
            };
          })}
        />
      }
      actions={
        activeTab === 'blogs' ? (
          <Button as="link" href="/dashboard/blog/new">
            New Blog Post
          </Button>
        ) : activeTab === 'google-posts' ? (
          <Button as="link" href="/dashboard/content?tab=google-posts&google_post_new=1#new-google-post">
            New Google Post
          </Button>
        ) : undefined
      }
      footer={
        activeTab === 'blogs' ? <div id="blog-list-bulk-controls" /> : undefined
      }
    >
      {activeTab === 'blogs' && (
        <DataTable
          columns={['Title', 'Status', 'Author', 'Published', 'Read Time']}
          rows={blogPosts.map((post) => ({
            Title: <Link href={`/dashboard/blog/${post.id}`}>{post.title}</Link>,
            Status: post.status,
            Author: post.author_id ? 'Assigned' : '-',
            Published: post.published_at ? new Date(post.published_at).toLocaleDateString() : '-',
            'Read Time': post.read_time_minutes ? `${post.read_time_minutes} min` : '-',
          }))}
          rowHrefs={blogPosts.map((post) => `/dashboard/blog/${post.id}`)}
          bulkDelete={{
            rowIds: blogPosts.map((post) => post.id),
            onDeleteSelected: deleteBlogPostsBulk,
            itemLabel: 'blog posts',
          }}
          bulkDeletePortalTargetId="blog-list-bulk-controls"
          bulkDeleteSelectLabel={`${blogPosts.length} Total`}
          emptyMessage="No blog posts yet"
        />
      )}

      {activeTab === 'google-posts' && (
        <div className="settings__section settings-card google-tools">
          {googlePostSuccess && (
            <p>
              {query.google_post_message || 'Google post created'}
              {query.google_post_name ? ` (${query.google_post_name})` : ''}.
            </p>
          )}
          {googlePostError && (
            <p className="form-error">{query.google_post_message || 'Google post creation failed'}</p>
          )}
          {showGooglePostComposer ? (
            <form
              id="new-google-post"
              action={createGoogleBusinessProfilePostAction}
              className="settings__section google-tools__card google-tools__composer"
            >
              <div className="google-tools__composer-head">
                <h4 className="google-tools__title">Create Google Post</h4>
              </div>
              <div className="google-tools__meta-row">
                <label className="google-tools__field">
                  Post Type
                  <select name="topic_type" defaultValue="STANDARD">
                    <option value="STANDARD">Standard</option>
                    <option value="EVENT">Event</option>
                    <option value="OFFER">Offer</option>
                    <option value="ALERT">Alert</option>
                  </select>
                </label>
                <label className="google-tools__field">
                  CTA Type
                  <select name="cta_action_type" defaultValue="">
                    <option value="">None</option>
                    <option value="BOOK">Book</option>
                    <option value="ORDER">Order</option>
                    <option value="SHOP">Shop</option>
                    <option value="LEARN_MORE">Learn More</option>
                    <option value="SIGN_UP">Sign Up</option>
                    <option value="CALL">Call</option>
                  </select>
                </label>
                <label className="google-tools__field">
                  CTA URL
                  <input name="cta_url" type="url" placeholder="https://example.com/offer" />
                </label>
              </div>
              <label className="google-tools__field google-tools__field--full">
                Summary
                <textarea name="summary" rows={4} placeholder="What should customers know today?" required />
              </label>
              <PendingSubmitButton idleLabel="Publish Post" />
            </form>
          ) : null}

          <div className="settings-card">
            <h4 className="google-tools__title">Recent Google Posts</h4>
            {googlePostHistoryError ? (
              <p className="form-error">{googlePostHistoryError}</p>
            ) : (
              <DataTable
                columns={['Summary', 'Type', 'State', 'Updated', 'CTA', 'Link']}
                rows={googlePosts.map((post) => ({
                  Summary: post.summary || '-',
                  Type: post.topicType || '-',
                  State: post.state || '-',
                  Updated: post.updateTime ? formatDateTime(post.updateTime) : '-',
                  CTA: post.callToActionActionType || '-',
                  Link: post.searchUrl ? (
                    <a href={post.searchUrl} target="_blank" rel="noreferrer">
                      View
                    </a>
                  ) : (
                    '-'
                  ),
                }))}
                emptyMessage="No Google posts found"
              />
            )}
          </div>
        </div>
      )}
    </ModuleShell>
  );
}
