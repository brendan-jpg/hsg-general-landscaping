import ContentPageHeader from "../../../components/frontend/ContentPageHeader";
import BlockRenderer from "../../../components/shared/BlockRenderer";
import TemplatePageRenderer from "../../../components/shared/TemplatePageRenderer";
import { CompanyOverviewSection, OwnerSpotlightSection, TeamGridSection } from "../../../components/frontend/TemplateSections";
import { toTemplatePageContent } from '@/lib/content/templatePages';
import { getActivePageBySlug, getTeamMembers } from '@/lib/content/queries';
import { toBlocks } from '@/lib/frontend/content';
import { getBusiness } from '@/lib/utils/business';

export default async function AboutPage() {
  const [page, business, teamMembers] = await Promise.all([
    getActivePageBySlug('about'),
    getBusiness(),
    getTeamMembers(),
  ]);
  const templateContent = toTemplatePageContent(page?.content);
  const templateHasHero = templateContent?.sections.some((section) => section.type === 'hero_standard') ?? false;
  const blocks = templateContent ? [] : toBlocks(page?.content);
  const owner =
    teamMembers.find((member) => /owner|founder|president|ceo/i.test(member.title ?? '')) ??
    teamMembers[0] ??
    null;
  const remainingTeam = owner ? teamMembers.filter((member) => member.id !== owner.id) : teamMembers;
  const aboutFallback = business
    ? `${business.name} serves ${[business.city, business.state].filter(Boolean).join(', ') || 'its local area'} with a focus on clear communication, reliable scheduling, and quality workmanship.`
    : null;

  return (
    <section className="page page--about">
      {!templateHasHero && (
        <ContentPageHeader
          accent="Company"
          title={page?.title ?? 'About Us'}
          description={page?.meta_description ?? 'Learn about our team, our process, and the standards behind every project.'}
        />
      )}
      <CompanyOverviewSection title="Company">
        <div className="page__content">
          {templateContent ? (
            <TemplatePageRenderer content={templateContent} />
          ) : blocks.length > 0 ? (
            <BlockRenderer blocks={blocks} />
          ) : (
            <p>{aboutFallback ?? 'About content coming soon.'}</p>
          )}
        </div>
      </CompanyOverviewSection>
      <OwnerSpotlightSection owner={owner} title="Owner" />
      <TeamGridSection members={remainingTeam} title="Team Grid" />
    </section>
  );
}
