export type FreeTrialIndustryKey = 'landscaping' | 'contracting';

export type FreeTrialServicePreset = {
  title: string;
  slug: string;
  lede: string;
  body: string;
  featuredImageUrl?: string;
};

export type FreeTrialIndustryPreset = {
  key: FreeTrialIndustryKey;
  label: string;
  services: FreeTrialServicePreset[];
};

export const FREE_TRIAL_INDUSTRY_PRESETS: FreeTrialIndustryPreset[] = [
  {
    key: 'landscaping',
    label: 'Landscaping',
    services: [
      {
        title: 'Landscape Design',
        slug: 'landscape-design',
        featuredImageUrl: '/images/land-1.png',
        lede: 'Thoughtful planning, layout, and plant selection built around how the property will actually be used.',
        body:
          'Our landscape design service focuses on creating outdoor spaces that feel intentional from the first walkthrough to the final install. We help homeowners shape planting plans, layout decisions, circulation, focal points, and material selections so the finished property looks cohesive and functions well season after season.\n\nWhether the goal is a full front-yard refresh, a backyard retreat, or a phased master plan, we build designs around maintenance level, drainage needs, sun exposure, and long-term curb appeal.',
      },
      {
        title: 'Lawn Maintenance',
        slug: 'lawn-maintenance',
        featuredImageUrl: '/images/land-2.png',
        lede: 'Routine lawn care that keeps the property clean, healthy, and consistently presentable.',
        body:
          'Our lawn maintenance service is designed for property owners who want dependable weekly or recurring care without having to manage the details themselves. We handle mowing, trimming, edging, cleanup, and general turf presentation with a focus on consistency and clean finishing work.\n\nA strong maintenance program helps protect the overall look of the property while giving plants, beds, and walkways a cleaner frame. We build schedules around the season and the condition of the site so the property stays sharp over time.',
      },
      {
        title: 'Hardscaping',
        slug: 'hardscaping',
        featuredImageUrl: '/images/land-3.png',
        lede: 'Patios, walkways, retaining features, and outdoor surfaces that add structure and usability to the landscape.',
        body:
          'Our hardscaping work gives outdoor spaces definition, durability, and a stronger sense of layout. We design and build features like patios, paths, sitting areas, edging systems, and retaining elements that improve circulation while making the landscape feel more complete.\n\nWe focus on materials, drainage, grade transitions, and installation details that hold up well and fit the character of the property. The result is an outdoor space that is easier to use and easier to maintain.',
      },
      {
        title: 'Seasonal Cleanup',
        slug: 'seasonal-cleanup',
        featuredImageUrl: '/images/land-4.png',
        lede: 'Spring and fall cleanup services that reset the property and keep overgrowth, debris, and buildup under control.',
        body:
          'Seasonal cleanup is one of the fastest ways to restore the look of a property and prepare it for the next stretch of the year. We remove leaves, cut back overgrowth, refresh bed edges, clear debris, and handle the cleanup work that tends to accumulate between maintenance cycles.\n\nThese visits help protect curb appeal, reduce clutter, and give the property a cleaner starting point before active growing seasons or before winter weather sets in.',
      },
    ],
  },
  {
    key: 'contracting',
    label: 'Contracting',
    services: [
      {
        title: 'Kitchen Remodeling',
        slug: 'kitchen-remodeling',
        lede: 'Layout, finish, and function upgrades that make the kitchen easier to use and better aligned with the home.',
        body:
          'Our kitchen remodeling service is built around improving how the space works day to day while delivering a clean, finished result that fits the style of the home. We help homeowners think through layout changes, cabinet and countertop selections, storage needs, lighting, and the details that make the room feel polished and practical.\n\nFrom focused upgrades to more substantial transformations, we plan around workflow, durability, scheduling, and clear communication so the project stays organized from demolition through final punch work.',
      },
      {
        title: 'Bathroom Remodeling',
        slug: 'bathroom-remodeling',
        lede: 'Bathroom renovations focused on comfort, durability, storage, and a more refined everyday experience.',
        body:
          'Our bathroom remodeling service helps homeowners upgrade worn, outdated, or inefficient spaces with better layouts, better materials, and better use of square footage. We work through fixture selections, tile, vanities, storage solutions, and finish details that improve both appearance and long-term usability.\n\nWhether the goal is a simple refresh or a full redesign, we focus on planning, moisture-prone details, and clean execution so the final space feels durable, functional, and finished.',
      },
      {
        title: 'Basement Finishing',
        slug: 'basement-finishing',
        lede: 'Turn underused basement space into livable square footage with a clear plan and cohesive buildout.',
        body:
          'Our basement finishing service helps convert raw or partially finished lower levels into spaces that support how the household actually lives. Homeowners often use finished basements for family rooms, offices, guest areas, home gyms, or flexible multipurpose zones, and we shape the layout around those needs from the start.\n\nWe focus on comfort, practical flow, durable finishes, and the details required to make the space feel integrated with the rest of the home rather than like an afterthought.',
      },
      {
        title: 'Home Additions',
        slug: 'home-additions',
        lede: 'Expand the home with new square footage that feels connected, intentional, and built for long-term use.',
        body:
          'Our home addition service is for homeowners who need more space without sacrificing the character of the existing home. We help plan additions that improve function while keeping transitions, exterior proportions, and interior flow aligned with the original structure.\n\nFrom extra bedrooms and expanded living areas to targeted functional additions, we manage the project around scope, sequencing, communication, and finish continuity so the new space feels like it belongs there.',
      },
    ],
  },
];

export const FREE_TRIAL_INDUSTRY_PRESET_MAP = new Map(
  FREE_TRIAL_INDUSTRY_PRESETS.map((preset) => [preset.key, preset] as const),
);

export function getFreeTrialIndustryPreset(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase() as FreeTrialIndustryKey;
  return FREE_TRIAL_INDUSTRY_PRESET_MAP.get(normalized) ?? FREE_TRIAL_INDUSTRY_PRESET_MAP.get('landscaping')!;
}
