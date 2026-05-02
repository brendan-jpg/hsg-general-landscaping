import type { NextConfig } from "next";

function getSupabaseImageHosts() {
  const hosts = new Set<string>(["pqdhuovprkicjaucqyjw.supabase.co"]);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (supabaseUrl) {
    try {
      hosts.add(new URL(supabaseUrl).hostname);
    } catch {
      // Ignore invalid env values and keep fallback host(s).
    }
  }

  return Array.from(hosts);
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@brendan-jpg/hsg-sections"],

  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: getSupabaseImageHosts().map((hostname) => ({
      protocol: "https",
      hostname,
      pathname: "/storage/v1/object/**",
    })),
  },
};

export default nextConfig;

