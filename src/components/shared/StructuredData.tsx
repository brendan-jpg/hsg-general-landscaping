interface StructuredDataProps {
  data: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined;
}

function sanitizeJsonForHtml(value: string) {
  return value.replace(/</g, "\\u003c");
}

export default function StructuredData({ data }: StructuredDataProps) {
  if (!data || (Array.isArray(data) && data.length === 0)) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: sanitizeJsonForHtml(JSON.stringify(data)),
      }}
    />
  );
}
